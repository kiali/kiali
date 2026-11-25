package istio

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"path"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/spf13/pflag"
	"golang.org/x/exp/maps"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8syaml "k8s.io/apimachinery/pkg/util/yaml"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/util/sliceutil"
)

// 3 seconds is somewhat arbitrary but mesh discovery expires after 20s so it needs to be less than that.
var getVersionTimeout = time.Second * 3

// meshResolveFailureBackoff is how long a failed rebuild suppresses new attempts.
// Without it, every cache-missing caller after a failure would lead another full,
// equally doomed rebuild (the mesh cache only stores successes), holding the leadership
// and burning the resolve budget back to back. Within the window callers are served the
// retained mesh, or the recorded error when no mesh has ever been built. It stays
// hardcoded rather than configurable because no healthy environment needs a different
// value: the backoff only shapes how Kiali retries its own failed work, and lowering it
// reintroduces the back-to-back doomed rebuilds it exists to prevent. The rebuild's
// overall budget, which a slow-but-healthy mesh can legitimately need raised, is
// configurable (kiali_internal.kubernetes_client.mesh_resolve_timeout).
const meshResolveFailureBackoff = 10 * time.Second

func parseIstioConfigMap(istioConfig *corev1.ConfigMap, into *models.MeshConfigMap) error {
	meshConfigYaml, ok := istioConfig.Data["mesh"]
	if !ok {
		errMsg := "parseIstioConfigMap: Cannot find Istio mesh configuration [%v]"
		log.Warningf(errMsg, istioConfig)
		return fmt.Errorf(errMsg, istioConfig)
	}

	if into.Mesh == nil {
		into.Mesh = &models.MeshConfig{MeshConfig: &istiov1alpha1.MeshConfig{}}
	}
	if err := k8syaml.Unmarshal([]byte(meshConfigYaml), into.Mesh); err != nil {
		log.Warningf("parseIstioConfigMap: Cannot read Istio mesh configuration.")
		return err
	}

	return parseMeshNetworks(istioConfig, into)
}

func parseMeshNetworks(istioConfig *corev1.ConfigMap, into *models.MeshConfigMap) error {
	meshNetworksYAML, ok := istioConfig.Data["meshNetworks"]
	if !ok {
		log.Debugf("parseIstioConfigMap: Cannot find Istio mesh networks [%v]", istioConfig)
		return nil
	}
	if into.MeshNetworks == nil {
		into.MeshNetworks = &istiov1alpha1.MeshNetworks{}
	}
	if err := k8syaml.Unmarshal([]byte(meshNetworksYAML), into.MeshNetworks); err != nil {
		log.Warningf("parseIstioConfigMap: Cannot read Istio mesh networks configuration.")
		return err
	}

	return nil
}

func parseMeshConfigFile(meshConfigYAML string, into *models.MeshConfigMap) error {
	if into.Mesh == nil {
		into.Mesh = &models.MeshConfig{MeshConfig: &istiov1alpha1.MeshConfig{}}
	}
	if err := k8syaml.Unmarshal([]byte(meshConfigYAML), into.Mesh); err != nil {
		return fmt.Errorf("unable to parse Istio mesh configuration file: %w", err)
	}
	return nil
}

func parseMeshNetworksFile(meshNetworksYAML string, into *models.MeshConfigMap) error {
	if into.MeshNetworks == nil {
		into.MeshNetworks = &istiov1alpha1.MeshNetworks{}
	}
	if err := k8syaml.Unmarshal([]byte(meshNetworksYAML), into.MeshNetworks); err != nil {
		return fmt.Errorf("unable to parse Istio mesh networks file: %w", err)
	}
	return nil
}

func parseIstioControlPlaneCertificate(certConfigMap *corev1.ConfigMap) models.Certificate {
	cert := models.Certificate{}
	cert.Parse([]byte(certConfigMap.Data[certificateName]))
	cert.ConfigMapName = certificatesConfigMapName
	return cert
}

// sets the mesh configuration for a controlplane from the istio configmap(s).
// The ctx is the mesh-resolve budget: the network lookup's live namespace fetch
// must not outlive it (see resolveMesh).
func (in *Discovery) setControlPlaneConfig(ctx context.Context, kubeCache ctrlclient.Reader, controlPlane *models.ControlPlane) error {
	configMapName := istioConfigMapName(controlPlane.Revision)

	controlPlaneConf := &models.ControlPlaneConfiguration{
		Network: in.resolveNetwork(ctx, kubeCache, controlPlane),
		StandardConfig: &models.MeshConfigSource{
			Cluster:   controlPlane.Cluster.Name,
			ConfigMap: &models.MeshConfigMap{},
			Name:      configMapName,
			Namespace: controlPlane.IstiodNamespace,
		},
		EffectiveConfig: &models.MeshConfigSource{ConfigMap: &models.MeshConfigMap{}},
	}

	// Ensure controlPlane.Config is always assigned even if we return early due to errors.
	// This prevents nil pointer dereferences in the frontend when accessing config fields.
	defer func() { controlPlane.Config = *controlPlaneConf }()

	// Istiod loads shared configuration from the config cluster before applying its local
	// standard ConfigMap or mounted mesh file, which takes precedence.
	if controlPlane.SharedMeshConfig != "" {
		log.Tracef("Shared mesh config '%s' is present", controlPlane.SharedMeshConfig)
		sharedConfigCluster := controlPlane.Cluster.Name
		sharedConfigCache := kubeCache
		if controlPlane.ManagesExternal && controlPlane.ID != controlPlane.Cluster.Name {
			sharedConfigCluster = controlPlane.ID
			var err error
			sharedConfigCache, err = in.kialiCache.GetKubeCache(sharedConfigCluster)
			if err != nil {
				log.Errorf("Unable to access Shared Mesh ConfigMap cluster [%s]: %s", sharedConfigCluster, err)
				appendConfigWarning(controlPlane, fmt.Sprintf("Unable to load shared mesh configuration from cluster [%s]: %s", sharedConfigCluster, err))
				sharedConfigCache = nil
			}
		}
		if sharedConfigCache != nil {
			if err := setSharedConfig(controlPlane, controlPlaneConf, sharedConfigCache, sharedConfigCluster); err != nil {
				log.Errorf("There was a problem with the Shared Mesh ConfigMap. istio configuration may not be accurate: %s", err)
				appendConfigWarning(controlPlane, fmt.Sprintf("Unable to load shared mesh configuration: %s", err))
			}
		}
	}

	loadedFileConfig := false
	if shouldLoadMeshConfigFile(controlPlane, configMapName) {
		if err := setFileConfig(controlPlane, controlPlaneConf, kubeCache); err != nil {
			log.Warningf("Unable to load mounted mesh configuration file; falling back to the standard ConfigMap: %s", err)
			appendConfigWarning(controlPlane, fmt.Sprintf("Unable to load mounted mesh configuration file; displaying the standard ConfigMap instead: %s", err))
		} else {
			loadedFileConfig = true
		}
	}
	if !loadedFileConfig {
		standardConfigMap, err := in.kialiSAClients[controlPlane.Cluster.Name].GetConfigMap(controlPlane.IstiodNamespace, configMapName)
		if err != nil {
			return err
		}

		if err := parseIstioConfigMap(standardConfigMap, controlPlaneConf.StandardConfig.ConfigMap); err != nil {
			return err
		}

		// Unmarshal again into effective.
		if err := parseIstioConfigMap(standardConfigMap, controlPlaneConf.EffectiveConfig.ConfigMap); err != nil {
			return err
		}
	}

	// When using the SHARED_MESH_CONFIG env var, istio merges the ProxyConfig unlike the other settings that are overridden.
	if controlPlaneConf.SharedConfig != nil && controlPlane.SharedMeshConfig != "" {
		if err := fusionMeshConfigs(controlPlaneConf.SharedConfig.ConfigMap.Mesh, controlPlaneConf.EffectiveConfig.ConfigMap.Mesh); err != nil {
			return err
		}
	}

	// The rest of the configs are all shown to the user and don't have defaults applied. Internally
	// in the Kiali backend we want the defaults applied and we don't care about MeshNetworks so we
	// use a separate controlPlane.MeshConfig field rather than using EffectiveConfig. It's a lot of
	// unmarshaling though...
	if err := mergeMeshConfigs(controlPlaneConf.EffectiveConfig.ConfigMap.Mesh, controlPlane.MeshConfig); err != nil {
		return err
	}
	controlPlane.MeshConfig.PrepareServiceEntryVisibility()

	certConfigMap, err := in.kialiSAClients[controlPlane.Cluster.Name].GetConfigMap(controlPlane.IstiodNamespace, certificatesConfigMapName)
	if err != nil {
		log.Warningf("Unable to get certificate configmap [%s/%s]. Err: %s", controlPlane.IstiodNamespace, certificatesConfigMapName, err)
	} else {
		cert := parseIstioControlPlaneCertificate(certConfigMap)
		controlPlaneConf.Certificates = append(controlPlaneConf.Certificates, cert)
	}

	return nil
}

func appendConfigWarning(controlPlane *models.ControlPlane, warning string) {
	if controlPlane.ConfigWarning == "" {
		controlPlane.ConfigWarning = warning
		return
	}
	controlPlane.ConfigWarning += "\n" + warning
}

func shouldLoadMeshConfigFile(controlPlane *models.ControlPlane, standardConfigMapName string) bool {
	if controlPlane.MeshConfigFile == nil {
		return false
	}
	return controlPlane.ID != controlPlane.Cluster.Name ||
		controlPlane.MeshConfigFile.ConfigMapName != standardConfigMapName ||
		controlPlane.MeshConfigFile.ConfigMapKey != "mesh"
}

func setFileConfig(controlPlane *models.ControlPlane, controlPlaneConf *models.ControlPlaneConfiguration, kubeCache ctrlclient.Reader) error {
	fileRef := controlPlane.MeshConfigFile
	fileConfig := &models.MeshConfigSource{
		Cluster:   controlPlane.Cluster.Name,
		ConfigMap: &models.MeshConfigMap{},
		Name:      fileRef.ConfigMapName,
		Namespace: controlPlane.IstiodNamespace,
		Path:      fileRef.Path,
	}

	configMap := &corev1.ConfigMap{}
	if err := kubeCache.Get(
		context.Background(),
		ctrlclient.ObjectKey{Name: fileRef.ConfigMapName, Namespace: controlPlane.IstiodNamespace},
		configMap,
	); err != nil {
		return fmt.Errorf("unable to get mesh configuration file ConfigMap [%s] in namespace [%s] on cluster [%s]: %w", fileRef.ConfigMapName, controlPlane.IstiodNamespace, controlPlane.Cluster.Name, err)
	}

	meshConfigYAML, ok := configMap.Data[fileRef.ConfigMapKey]
	if !ok {
		return fmt.Errorf("unable to find key [%s] for mesh configuration file [%s] in ConfigMap [%s/%s] on cluster [%s]", fileRef.ConfigMapKey, fileRef.Path, controlPlane.IstiodNamespace, fileRef.ConfigMapName, controlPlane.Cluster.Name)
	}
	if err := parseMeshConfigFile(meshConfigYAML, fileConfig.ConfigMap); err != nil {
		return fmt.Errorf("unable to parse mesh configuration file [%s] from ConfigMap [%s/%s] on cluster [%s]: %w", fileRef.Path, controlPlane.IstiodNamespace, fileRef.ConfigMapName, controlPlane.Cluster.Name, err)
	}
	if err := parseMeshConfigFile(meshConfigYAML, controlPlaneConf.EffectiveConfig.ConfigMap); err != nil {
		return fmt.Errorf("unable to parse mesh configuration file [%s] into EffectiveConfig: %w", fileRef.Path, err)
	}
	if err := setFileMeshNetworks(controlPlane, controlPlaneConf, fileConfig, kubeCache, configMap); err != nil {
		return err
	}

	controlPlaneConf.FileConfig = fileConfig
	controlPlaneConf.StandardConfig = nil
	return nil
}

func setFileMeshNetworks(controlPlane *models.ControlPlane, controlPlaneConf *models.ControlPlaneConfiguration, fileConfig *models.MeshConfigSource, kubeCache ctrlclient.Reader, meshConfigMap *corev1.ConfigMap) error {
	fileRef := controlPlane.MeshNetworksConfigFile
	if fileRef == nil {
		return nil
	}

	networksConfigMap := meshConfigMap
	if fileRef.ConfigMapName != meshConfigMap.Name {
		networksConfigMap = &corev1.ConfigMap{}
		if err := kubeCache.Get(
			context.Background(),
			ctrlclient.ObjectKey{Name: fileRef.ConfigMapName, Namespace: controlPlane.IstiodNamespace},
			networksConfigMap,
		); err != nil {
			return fmt.Errorf("unable to get mesh networks file ConfigMap [%s] in namespace [%s] on cluster [%s]: %w", fileRef.ConfigMapName, controlPlane.IstiodNamespace, controlPlane.Cluster.Name, err)
		}
	}

	meshNetworksYAML, ok := networksConfigMap.Data[fileRef.ConfigMapKey]
	if !ok {
		return nil
	}
	if err := parseMeshNetworksFile(meshNetworksYAML, fileConfig.ConfigMap); err != nil {
		return fmt.Errorf("unable to parse mesh networks file [%s] from ConfigMap [%s/%s] on cluster [%s]: %w", fileRef.Path, controlPlane.IstiodNamespace, fileRef.ConfigMapName, controlPlane.Cluster.Name, err)
	}
	if err := parseMeshNetworksFile(meshNetworksYAML, controlPlaneConf.EffectiveConfig.ConfigMap); err != nil {
		return fmt.Errorf("unable to parse mesh networks file [%s] into EffectiveConfig: %w", fileRef.Path, err)
	}
	return nil
}

func setSharedConfig(controlPlane *models.ControlPlane, controlPlaneConf *models.ControlPlaneConfiguration, kubeCache ctrlclient.Reader, cluster string) error {
	sharedConfig := &models.MeshConfigSource{
		Cluster:   cluster,
		ConfigMap: &models.MeshConfigMap{},
		Name:      controlPlane.SharedMeshConfig,
		Namespace: controlPlane.IstiodNamespace,
	}

	sharedUserConfigMap := &corev1.ConfigMap{}
	if err := kubeCache.Get(
		context.Background(),
		ctrlclient.ObjectKey{Name: controlPlane.SharedMeshConfig, Namespace: controlPlane.IstiodNamespace},
		sharedUserConfigMap,
	); err != nil {
		return fmt.Errorf("unable to get Shared User ConfigMap [%s] in namespace [%s] on cluster [%s]: %w", controlPlane.SharedMeshConfig, controlPlane.IstiodNamespace, cluster, err)
	}

	if err := parseIstioConfigMap(sharedUserConfigMap, sharedConfig.ConfigMap); err != nil {
		return fmt.Errorf("unable to parse Shared User ConfigMap [%s] in namespace [%s] on cluster [%s]: %w", controlPlane.SharedMeshConfig, controlPlane.IstiodNamespace, cluster, err)
	}

	// Unmarshal again into effective.
	if err := parseIstioConfigMap(sharedUserConfigMap, controlPlaneConf.EffectiveConfig.ConfigMap); err != nil {
		return fmt.Errorf("unable to parse Shared User ConfigMap [%s] in namespace [%s] on cluster [%s] into EffectiveConfig: %w", controlPlane.SharedMeshConfig, controlPlane.IstiodNamespace, cluster, err)
	}

	controlPlaneConf.SharedConfig = sharedConfig
	return nil
}

func findMeshConfigFile(container corev1.Container, volumes []corev1.Volume, meshConfigPath string) *models.MeshConfigFileReference {
	if !isValidContainerPath(meshConfigPath) {
		return nil
	}
	cleanConfigPath := cleanContainerPath(meshConfigPath)
	var configFile *models.MeshConfigFileReference
	longestMountPath := -1
	for _, mount := range container.VolumeMounts {
		cleanMountPath := cleanContainerPath(mount.MountPath)
		relativePath := ""
		switch {
		case cleanConfigPath == cleanMountPath:
			relativePath = path.Base(cleanConfigPath)
		case cleanMountPath == "/" && strings.HasPrefix(cleanConfigPath, "/"):
			relativePath = strings.TrimPrefix(cleanConfigPath, "/")
		case strings.HasPrefix(cleanConfigPath, cleanMountPath+"/"):
			relativePath = strings.TrimPrefix(cleanConfigPath, cleanMountPath+"/")
		default:
			continue
		}

		if mount.SubPath != "" {
			if cleanConfigPath != cleanMountPath {
				continue
			}
			relativePath = mount.SubPath
		}

		for _, volume := range volumes {
			if volume.Name != mount.Name || volume.ConfigMap == nil {
				continue
			}
			configMapKey := relativePath
			if len(volume.ConfigMap.Items) > 0 {
				configMapKey = ""
				for _, item := range volume.ConfigMap.Items {
					if path.Clean(item.Path) == path.Clean(relativePath) {
						configMapKey = item.Key
						break
					}
				}
				if configMapKey == "" {
					continue
				}
			}
			if len(cleanMountPath) > longestMountPath {
				configFile = &models.MeshConfigFileReference{
					ConfigMapKey:  configMapKey,
					ConfigMapName: volume.ConfigMap.Name,
					Path:          cleanConfigPath,
				}
				longestMountPath = len(cleanMountPath)
			}
		}
	}
	return configFile
}

func isValidContainerPath(filePath string) bool {
	if !path.IsAbs(filePath) && !strings.HasPrefix(filePath, "./") {
		return false
	}
	for _, segment := range strings.Split(filePath, "/") {
		if segment == ".." {
			return false
		}
	}
	return true
}

func cleanContainerPath(filePath string) string {
	// Reject paths with traversal sequences before cleaning
	if strings.Contains(filePath, "..") {
		return ""
	}

	if strings.HasPrefix(filePath, "./") {
		filePath = strings.TrimPrefix(filePath, ".")
	}
	if !path.IsAbs(filePath) {
		filePath = "/" + filePath
	}
	cleaned := path.Clean(filePath)

	// Validate the cleaned path is absolute
	if !path.IsAbs(cleaned) {
		return ""
	}

	return cleaned
}

func deepMerge(dst, src map[string]interface{}) {
	for k, v := range src {
		if vMap, ok := v.(map[string]interface{}); ok {
			if dstMap, found := dst[k].(map[string]interface{}); found {
				deepMerge(dstMap, vMap)
				continue
			}
		}
		if dst[k] == nil {
			dst[k] = v
		}
	}
}

func mergeExtensionProviders(shared, local []*istiov1alpha1.MeshConfig_ExtensionProvider) []*istiov1alpha1.MeshConfig_ExtensionProvider {
	merged := make([]*istiov1alpha1.MeshConfig_ExtensionProvider, len(shared))
	copy(merged, shared)

	providerIndexes := make(map[string]int, len(merged))
	for i, provider := range merged {
		providerIndexes[provider.Name] = i
	}
	for _, provider := range local {
		if i, found := providerIndexes[provider.Name]; found {
			merged[i] = provider
			continue
		}
		providerIndexes[provider.Name] = len(merged)
		merged = append(merged, provider)
	}
	return merged
}

func mergeTrustDomainAliases(shared, local []string) []string {
	aliases := make(map[string]struct{}, len(shared)+len(local))
	for _, alias := range shared {
		aliases[alias] = struct{}{}
	}
	for _, alias := range local {
		aliases[alias] = struct{}{}
	}

	merged := make([]string, 0, len(aliases))
	for alias := range aliases {
		merged = append(merged, alias)
	}
	slices.Sort(merged)
	return merged
}

func fusionMeshConfigs(mesh *models.MeshConfig, into *models.MeshConfig) error {
	mergedExtensionProviders := mergeExtensionProviders(mesh.ExtensionProviders, into.ExtensionProviders)
	mergedTrustDomainAliases := mergeTrustDomainAliases(mesh.TrustDomainAliases, into.TrustDomainAliases)

	a, err := into.MarshalJSON()
	if err != nil {
		return err
	}
	b, err := mesh.MarshalJSON()
	if err != nil {
		return err
	}
	var baseMap, overlayMap map[string]interface{}
	if err := json.Unmarshal(a, &baseMap); err != nil {
		return err
	}
	if err := json.Unmarshal(b, &overlayMap); err != nil {
		return err
	}
	deepMerge(baseMap, overlayMap)

	mergedJSON, err := json.Marshal(baseMap)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(mergedJSON, &into); err != nil {
		return err
	}
	into.ExtensionProviders = mergedExtensionProviders
	into.TrustDomainAliases = mergedTrustDomainAliases
	return nil
}

func mergeMeshConfigs(mesh *models.MeshConfig, into *models.MeshConfig) error {
	b, err := mesh.MarshalJSON()
	if err != nil {
		return err
	}

	return into.UnmarshalJSON(b)
}

func revisionedConfigMapName(base string, revision string) string {
	// If the revision is set, we should use the revisioned configmap name
	// otherwise the hardcoded base value is used.
	if revision == "" || revision == models.DefaultRevisionLabel {
		return base
	}
	return fmt.Sprintf("%s-%s", base, revision)
}

// istioConfigMapName guesses the istio configmap name.
func istioConfigMapName(revision string) string {
	return revisionedConfigMapName(baseIstioConfigMapName, revision)
}

// sidecarInjectorConfigMapName guesses the istio sidecar injector configmap name.
func sidecarInjectorConfigMapName(revision string) string {
	return revisionedConfigMapName(baseIstioSidecarInjectorConfigMapName, revision)
}

type MeshDiscovery interface {
	ClusterInventory() []models.KubeCluster
	Clusters() []models.KubeCluster
	GetControlPlaneNamespaces(ctx context.Context, cluster string) []string
	GetRootNamespace(ctx context.Context, cluster, namespace string) string
	IsControlPlane(ctx context.Context, cluster, namespace string) bool
	Mesh(ctx context.Context) (*models.Mesh, error)
}

// getVersionFunc is a function type that matches the signature of GetVersion
type getVersionFunc func(ctx context.Context, conf *config.Config, client kubernetes.ClientInterface, kubeCache ctrlclient.Reader, controlPlane models.ControlPlane) (*models.ExternalServiceInfo, error)

// Discovery detects istio infrastructure and configuration across clusters.
type Discovery struct {
	conf           *config.Config
	kialiCache     cache.KialiCache
	kialiSAClients map[string]kubernetes.ClientInterface
	// meshLeadership serializes mesh rebuilds: exactly one leader rebuilds at a time.
	// It is acquired with TryLock and held only for the duration of a rebuild - callers
	// are never blocked waiting on it (see Mesh).
	meshLeadership sync.Mutex
	// meshStateMu guards the rebuild-completion signal and the failure marks below.
	meshStateMu sync.Mutex
	// meshRebuildDone is closed when the in-flight rebuild (if any) finishes; it is nil
	// when no rebuild is running. Only cold-start callers (no mesh has ever been built)
	// wait on it - everyone else is served the retained mesh (see Mesh).
	meshRebuildDone chan struct{}
	// meshResolveFailedAt and meshResolveErr record the last rebuild failure for the
	// failure backoff (see meshResolveFailureBackoff).
	meshResolveFailedAt time.Time
	meshResolveErr      error
	// namespaceMap provides quick lookup from Namespace to ControlPlane key="cluster:namespace", set during Mesh discovery
	namespaceMap map[string]*models.ControlPlane
	// namespaceMapMu guards namespaceMap: the rebuild swaps in a fully built replacement
	// (see resolveMesh) while readers such as GetRootNamespace consult it.
	namespaceMapMu sync.RWMutex
	getVersion     getVersionFunc
}

// NewDiscovery initializes a new Discovery.
func NewDiscovery(clients map[string]kubernetes.ClientInterface, cache cache.KialiCache, conf *config.Config) *Discovery {
	var getVersion getVersionFunc

	// Set the getVersion function based on run mode
	if conf.RunMode == config.RunModeOffline {
		// Offline mode function that reads version from controlPlane labels
		getVersion = func(ctx context.Context, conf *config.Config, client kubernetes.ClientInterface, kubeCache ctrlclient.Reader, controlPlane models.ControlPlane) (*models.ExternalServiceInfo, error) {
			if version, exists := controlPlane.Labels[config.KubernetesVersionLabel]; exists && version != "" {
				return &models.ExternalServiceInfo{
					Name:    "Istio",
					Version: version,
				}, nil
			}
			return nil, fmt.Errorf("version label %s not found or empty in controlPlane labels", config.KubernetesVersionLabel)
		}
	} else {
		// Use the actual GetVersion function for non-offline modes
		getVersion = GetVersion
	}

	return &Discovery{
		conf:           conf,
		kialiCache:     cache,
		kialiSAClients: clients,
		getVersion:     getVersion,
	}
}

// GetControlPlaneNamespaces returns control plane namespaces for the cluster. If cluster == "" then
// it is for all clusters. it returns an empty slice.
func (in *Discovery) GetControlPlaneNamespaces(ctx context.Context, cluster string) []string {
	namespaces := map[string]bool{}

	mesh, err := in.Mesh(ctx)
	if err != nil {
		log.Debugf("Unable to get mesh to determine control plane namespaces for cluster [%s]. Err: %s", cluster, err)
		return maps.Keys(namespaces)
	}

	for _, cp := range mesh.ControlPlanes {
		if cluster == "" || cluster == cp.Cluster.Name {
			namespaces[cp.IstiodNamespace] = true
		}
	}

	return maps.Keys(namespaces)
}

// IsControlPlane returns true if the cluster-namespace is an istio control plane. If cluster == "" it
// is ignored, and only the namespace is considered. Otherwise false.
func (in *Discovery) IsControlPlane(ctx context.Context, cluster, namespace string) bool {
	for _, cpns := range in.GetControlPlaneNamespaces(ctx, cluster) {
		if namespace == cpns {
			return true
		}
	}

	return false
}

// HasControlPlane returns true if the control plane is in the namespace of the provided cluster.
func (in *Discovery) HasControlPlane(ctx context.Context, cluster string, ns string, istiod string) bool {
	mesh, err := in.Mesh(ctx)
	if err != nil {
		log.Errorf("Unable to get mesh to determine HasControlPlane for cluster [%s] namespace [%s]. Err: %s", cluster, ns, err)
		return false
	}

	for _, controlPlane := range mesh.ControlPlanes {
		if controlPlane.IstiodNamespace == ns && controlPlane.IstiodName == istiod && controlPlane.Cluster.Name == cluster {
			return true
		}
	}

	return false
}

// GetRootNamespace returns the Istio root namespace for the control plane managing the given namespace.
// If the namespace is not managed by any control plane, it returns an empty string.
func (in *Discovery) GetRootNamespace(ctx context.Context, cluster, namespace string) string {
	// The map is swapped atomically by the rebuild (see resolveMesh); a miss falls back
	// to the cached mesh below, so the read does not need to exclude a rebuild.
	in.namespaceMapMu.RLock()
	cp := in.namespaceMap[in.namespaceMapKey(cluster, namespace)]
	in.namespaceMapMu.RUnlock()
	if cp != nil {
		return cp.RootNamespace
	}

	// Namespace is not in the map, which means it's not a data plane namespace.
	// However, it might BE a root namespace itself (e.g., istio-system without injection).
	// Check the cache to see if this namespace is the root namespace for any control plane.
	mesh, ok := in.kialiCache.GetMesh()
	if ok {
		for _, controlPlane := range mesh.ControlPlanes {
			if controlPlane.Cluster.Name == cluster && controlPlane.RootNamespace == namespace {
				// This namespace IS a root namespace, return it
				return namespace
			}
		}
	}

	// Namespace is not in the mesh and not a root namespace.
	// Return empty string to indicate the namespace is not part of the mesh.
	log.Debugf("GetRootNamespace: namespace [%s] in cluster [%s] is not part of the mesh", namespace, cluster)
	return ""
}

// IsRemoteCluster determines if the cluster has a controlplane or if it's a remote cluster without one.
// Clusters that do not exist or are not accessible are considered remote clusters.
func (in *Discovery) IsRemoteCluster(ctx context.Context, cluster string) bool {
	mesh, err := in.Mesh(ctx)
	if err != nil {
		log.Debugf("Unable to get mesh to determine if cluster [%s] is remote. Err: %s", cluster, err)
		return false
	}

	// If there's a controlplane for the cluster then it's not a remote cluster.
	for _, controlPlane := range mesh.ControlPlanes {
		if controlPlane.Cluster.Name == cluster {
			return false
		}
	}

	return true
}

// ClusterInventory returns the known inventory without waiting for Kubernetes discovery.
func (in *Discovery) ClusterInventory() []models.KubeCluster {
	if clusters := in.kialiCache.GetClusters(); clusters != nil {
		return clusters
	}

	return in.configuredClusters()
}

func (in *Discovery) configuredClusters() []models.KubeCluster {
	// Even if somehow there are no clusters found, setting this to an empty slice will prevent us
	// from trying to resolve again.
	clustersByName := map[string]models.KubeCluster{}
	for cluster, client := range in.kialiSAClients {
		info := client.ClusterInfo()
		meshCluster := models.KubeCluster{
			// If there's a client for this cluster then it's accessible.
			Accessible: true,
			Name:       cluster,
			SecretName: info.SecretName,
		}
		if info.ClientConfig != nil {
			meshCluster.ApiEndpoint = info.ClientConfig.Host
		}

		if cluster == in.conf.KubernetesConfig.ClusterName {
			meshCluster.IsKialiHome = true
		}
		clustersByName[cluster] = meshCluster
	}

	// Add clusters from config. A cluster skipped at startup (definitively broken
	// registration) must not be re-introduced here as accessible: it has no cache and no
	// clients, and publishing it would send clients at a cluster Kiali cannot serve.
	// A config-only entry whose configured secret could not be read is the same
	// situation: the actual clients are authoritative, and advertising the cluster as
	// accessible would put the console into multicluster mode for a cluster whose
	// reads can only fail (ErrClusterNotCached).
	unreadableSecrets := in.kialiCache.UnreadableRemoteSecrets()
	for _, cluster := range in.conf.Clustering.Clusters {
		if in.kialiCache.IsClusterSkipped(cluster.Name) {
			continue
		}
		if _, found := clustersByName[cluster.Name]; !found {
			clustersByName[cluster.Name] = models.KubeCluster{
				Name: cluster.Name,
				// Clusters without a SecretName are not accessible
				// because we don't have a kubeconfig for them. Neither is one whose
				// secret is recorded unreadable: no client was built from it.
				Accessible: cluster.SecretName != "" && !slices.Contains(unreadableSecrets, cluster.SecretName),
			}
		}
	}

	clusters := maps.Values(clustersByName)

	if len(clusters) == 0 {
		log.Warning("No clusters found. This likely means that Kiali is misconfigured. Ensure that kiali is configured to access at least one cluster.")
	}

	return clusters
}

// orderedSAClusterNames returns the SA client cluster names with the home cluster first,
// for serial per-cluster passes whose budget a dead remote must not spend ahead of the
// mandatory cluster (see resolveMesh).
func (in *Discovery) orderedSAClusterNames() []string {
	names := maps.Keys(in.kialiSAClients)
	home := in.conf.KubernetesConfig.ClusterName
	slices.SortFunc(names, func(a, b string) int { return homeFirst(a, b, home) })
	return names
}

// homeFirst is the comparator behind the home-first ordering: a serial per-cluster
// pass whose budget a dead remote must not spend ahead of the mandatory cluster
// (see resolveMesh and orderedSAClusterNames).
func homeFirst(a, b, home string) int {
	switch {
	case a == home:
		return -1
	case b == home:
		return 1
	default:
		return 0
	}
}

// Clusters resolves the Kubernetes clusters that are hosting the mesh. Resolution
// is done as best-effort using the resources that are present in the cluster.
// TODO: should this go in kubernetes package?
func (in *Discovery) Clusters() []models.KubeCluster {
	if clusters := in.kialiCache.GetClusters(); clusters != nil {
		return clusters
	}
	clusters := in.configuredClusters()
	// TODO: Separate KialiInstance from Cluster model.
	for i := range clusters {
		// need the actual object for update, so use the index, not the copy
		cluster := &clusters[i]
		instances, err := in.getKialiInstances(*cluster)
		if err != nil {
			log.Warningf("Unable to get Kiali instances for cluster [%s]: %v", cluster.Name, err)
			continue
		}
		cluster.KialiInstances = instances
	}

	// Log discovered clusters for debugging
	for _, cluster := range clusters {
		log.Infof("Discovered cluster: Name=[%s], Accessible=%t, IsKialiHome=%t, ApiEndpoint=[%s], SecretName=[%s]",
			cluster.Name, cluster.Accessible, cluster.IsKialiHome, cluster.ApiEndpoint, cluster.SecretName)
	}

	in.kialiCache.SetClusters(clusters)

	return clusters
}

type clusterRevisionKey struct {
	Cluster  string
	Revision string
}

// Mesh gathers information about the mesh and controlplanes running in the mesh
// from various sources e.g. istio configmap, istiod deployment envvars, etc.
// Do not edit the mesh object returned from here directly. It is shared across threads.
//
// Mesh serves stale-while-revalidate: a caller that misses the mesh cache is served the
// retained last mesh (see cache.KialiCache.LastMesh) immediately, while at most one
// background rebuild runs per expiry. Rebuilds are detached from every caller - a request
// disconnecting, or the control-plane monitor's polling deadline, must not kill a result
// that other callers and the next monitor tick depend on - and each rebuild resolves the
// home cluster first within its own budget, so a dead remote cannot starve the mandatory
// cluster's resolution. Only before the first successful build (cold start, no retained
// mesh) does a caller wait for the in-flight rebuild, bounded by its own context.
func (in *Discovery) Mesh(ctx context.Context) (*models.Mesh, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "Mesh",
		observability.Attribute("package", "istio"),
	)
	defer end()

	if mesh, ok := in.kialiCache.GetMesh(); ok {
		return mesh, nil
	}

	for {
		// A retained mesh is served immediately while a rebuild refreshes the cache: no
		// request ever waits on a rebuild once the first mesh exists. The staleness is
		// bounded by the mesh cache expiration plus one rebuild, the same data the graph
		// and detail views already serve from their own caches during an outage.
		if last := in.kialiCache.LastMesh(); last != nil {
			in.ensureMeshRebuild()
			return last, nil
		}

		// Cold start: no mesh has ever been built. Try to lead the initial rebuild
		// ourselves; if one is already in flight, wait for it and re-evaluate.
		if in.meshLeadership.TryLock() {
			// Re-check: a rebuild may have completed between the cache check and the
			// lock acquisition.
			if mesh, ok := in.kialiCache.GetMesh(); ok {
				in.meshLeadership.Unlock()
				return mesh, nil
			}
			if in.meshResolveInBackoff() {
				err := in.meshResolveErrSnapshot()
				in.meshLeadership.Unlock()
				// No mesh has ever been built and the last attempt failed recently:
				// fail fast rather than lead another immediately-doomed rebuild.
				if err == nil {
					err = fmt.Errorf("mesh resolution failed recently and is being retried")
				}
				return nil, err
			}
			mesh, err := in.leadMeshResolve()
			in.meshLeadership.Unlock()
			return mesh, err
		}

		done := in.meshRebuildDoneSnapshot()
		if done == nil {
			// The in-flight rebuild finished between the TryLock and the snapshot;
			// loop to re-check the cache and the leadership.
			continue
		}
		select {
		case <-done:
			// Loop: the cache and the retained mesh are re-checked with the rebuild's
			// result in place.
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}

// ensureMeshRebuild starts a background rebuild if none is running and no failure
// backoff is in effect. It never blocks: callers are served the retained mesh while
// the rebuild it triggers runs.
func (in *Discovery) ensureMeshRebuild() {
	if !in.meshLeadership.TryLock() {
		return // a rebuild is already in flight
	}
	go func() {
		defer in.meshLeadership.Unlock()
		if _, ok := in.kialiCache.GetMesh(); ok {
			return // re-checked under the leadership: the cache was refreshed
		}
		if in.meshResolveInBackoff() {
			return // a recent failure is being backed off; the next expiry retries
		}
		// Errors are logged and recorded by leadMeshResolve for the backoff; callers
		// keep being served the retained mesh in the meantime.
		_, _ = in.leadMeshResolve()
	}()
}

// leadMeshResolve runs one full mesh rebuild while holding the mesh leadership,
// publishing the result to the mesh cache on success or recording the failure for
// the backoff. The rebuild runs detached from any caller with meshResolveTimeout as
// its overall budget.
func (in *Discovery) leadMeshResolve() (*models.Mesh, error) {
	done := make(chan struct{})
	in.meshStateMu.Lock()
	in.meshRebuildDone = done
	in.meshStateMu.Unlock()
	defer func() {
		in.meshStateMu.Lock()
		close(done)
		in.meshRebuildDone = nil
		in.meshStateMu.Unlock()
	}()

	// The budget is kiali_internal.kubernetes_client.mesh_resolve_timeout; 0 disables
	// it (an unguarded WithTimeout with 0 would expire instantly instead).
	resolveCtx := context.Background()
	var cancel context.CancelFunc = func() {}
	if timeout := in.conf.KialiInternal.KubernetesClient.MeshResolveTimeout; timeout > 0 {
		resolveCtx, cancel = context.WithTimeout(resolveCtx, timeout)
	}
	defer cancel()

	mesh, err := in.resolveMesh(resolveCtx)
	if err != nil {
		log.Errorf("Unable to resolve the mesh; keeping the previously retained mesh. Retrying no sooner than %s. Err: %s", meshResolveFailureBackoff, err)
		in.meshStateMu.Lock()
		in.meshResolveFailedAt = time.Now()
		in.meshResolveErr = err
		in.meshStateMu.Unlock()
		return nil, err
	}

	in.kialiCache.SetMesh(mesh)
	in.meshStateMu.Lock()
	in.meshResolveFailedAt = time.Time{}
	in.meshResolveErr = nil
	in.meshStateMu.Unlock()
	return mesh, nil
}

// meshResolveInBackoff reports whether the last rebuild failed within the backoff window.
func (in *Discovery) meshResolveInBackoff() bool {
	in.meshStateMu.Lock()
	defer in.meshStateMu.Unlock()
	return !in.meshResolveFailedAt.IsZero() && time.Since(in.meshResolveFailedAt) < meshResolveFailureBackoff
}

// meshResolveErrSnapshot returns the error recorded by the last failed rebuild, if any.
func (in *Discovery) meshResolveErrSnapshot() error {
	in.meshStateMu.Lock()
	defer in.meshStateMu.Unlock()
	return in.meshResolveErr
}

// meshRebuildDoneSnapshot returns the completion signal of the in-flight rebuild, or
// nil when no rebuild is running.
func (in *Discovery) meshRebuildDoneSnapshot() chan struct{} {
	in.meshStateMu.Lock()
	defer in.meshStateMu.Unlock()
	return in.meshRebuildDone
}

// resolveMesh builds the mesh from the clusters Kiali can see. It must only be called
// through Mesh/ensureMeshRebuild (exactly one caller holds the mesh leadership), and it
// owns the namespaceMap swap-in.
func (in *Discovery) resolveMesh(ctx context.Context) (*models.Mesh, error) {
	clusters := in.Clusters()
	// The home cluster is resolved first: a remote that is not answering must not
	// consume the rebuild budget ahead of the mandatory cluster and make the home
	// resolution fail with a spurious context-deadline error (map iteration order
	// would otherwise decide whether home is starved by a dead remote).
	home := in.conf.KubernetesConfig.ClusterName
	slices.SortStableFunc(clusters, func(a, b models.KubeCluster) int { return homeFirst(a.Name, b.Name, home) })

	// One scoped read per cluster for the whole mesh resolution: several passes below need
	// the same per-cluster namespace lists - and the same failures, so a remote whose scan
	// fails is not rescanned (at its full timeout) by the next pass.
	namespacesInScopeMemo := map[string]scopedNamespaces{}

	mesh := &models.Mesh{}
	var remoteClusters []*models.KubeCluster
	for _, cluster := range clusters {
		// We can't get anything from an inaccessible cluster.
		if !cluster.Accessible {
			continue
		}

		cluster := cluster
		// A remote cluster that can't be read is skipped so it doesn't take down the whole mesh,
		// including views that only need the home cluster. The home cluster is not skippable.
		isHomeCluster := cluster.Name == in.conf.KubernetesConfig.ClusterName
		kubeCache, skip, err := in.kialiCache.SkipUnavailableCluster(cluster.Name, "resolving the mesh", cache.SkipModeAggregate)
		if skip {
			// err is only the skip's cause here; the cache already logged it.
			continue
		}
		if err != nil {
			return nil, err
		}

		// if this is an external kiali cluster, don't look for control planes but ensure that Kiali is found
		if in.conf.Clustering.IgnoreHomeCluster && in.conf.KubernetesConfig.ClusterName == cluster.Name {
			log.Tracef("Cluster [%s] is an external Kiali cluster. Adding the external management cluster.", cluster.Name)
			externalKialis := in.discoverKiali(cluster)
			if len(externalKialis) != 0 {
				mesh.ExternalKiali = &models.ExternalKialiInstance{
					Cluster: &cluster,
					Kiali:   &externalKialis[0],
				}
			} else {
				log.Errorf("cluster [%s] is an external Kiali cluster. But a Kiali instance was not found", cluster.Name)
			}
			continue
		}

		// If there's an istiod on it, then it's a controlplane cluster. Otherwise it is a remote mesh cluster
		labels := map[string]string{config.IstioAppLabel: istiodAppLabelValue}
		depList := &appsv1.DeploymentList{}
		if err := cache.ListReadable(ctx, kubeCache, in.conf, in.kialiCache, cluster.Name, depList,
			ctrlclient.MatchingLabels(labels)); err != nil {
			if isHomeCluster {
				return nil, err
			}
			log.Warningf("Skipping cluster [%s] when resolving the mesh: %s", cluster.Name, err)
			continue
		}
		istiods := depList.Items

		if len(istiods) == 0 {
			log.Tracef("Cluster [%s] is a remote cluster. Skipping adding a controlplane.", cluster.Name)
			remoteClusters = append(remoteClusters, &cluster)
			continue
		}

		for _, istiod := range istiods {
			log.Tracef("Found controlplane [%s/%s] on cluster [%s].", istiod.Name, istiod.Namespace, cluster.Name)
			controlPlane := newControlPlane(istiod, &cluster)

			if containers := istiod.Spec.Template.Spec.Containers; len(containers) > 0 {
				for _, env := range istiod.Spec.Template.Spec.Containers[0].Env {
					switch {
					case kubernetes.EnvVarIsTrue(istiodExternalEnvKey, env):
						controlPlane.ManagesExternal = true
					case kubernetes.EnvVarIsTrue(istiodScopeGatewayEnvKey, env):
						controlPlane.IsGatewayToNamespace = true
					case env.Name == istiodClusterIDEnvKey:
						controlPlane.ID = env.Value
						log.Infof("Control plane [%s/%s] cluster ID set to [%s] (deployed on cluster [%s])",
							istiod.Namespace, istiod.Name, controlPlane.ID, cluster.Name)
					case env.Name == istiodSharedMeshConfigEnvKey:
						controlPlane.SharedMeshConfig = env.Value
					}
				}

				// Parse the deployment args and set fields on the control plane
				parseArgsInto(containers[0].Args, &controlPlane)
				controlPlane.MeshConfigFile = findMeshConfigFile(containers[0], istiod.Spec.Template.Spec.Volumes, controlPlane.MeshConfigFilePath)
				controlPlane.MeshNetworksConfigFile = findMeshConfigFile(containers[0], istiod.Spec.Template.Spec.Volumes, controlPlane.MeshNetworksConfigFilePath)

				controlPlane.Resources = containers[0].Resources
				if memoryLimit := controlPlane.Resources.Limits.Memory(); memoryLimit != nil {
					if thresholds := controlPlane.Thresholds; thresholds == nil {
						controlPlane.Thresholds = &models.IstiodThresholds{}
					}
					controlPlane.Thresholds.Memory = float64(memoryLimit.ScaledValue(resource.Mega))
				}
				if cpuLimit := controlPlane.Resources.Limits.Cpu(); cpuLimit != nil {
					if thresholds := controlPlane.Thresholds; thresholds == nil {
						controlPlane.Thresholds = &models.IstiodThresholds{}
					}
					controlPlane.Thresholds.CPU = cpuLimit.AsApproximateFloat64()
				}
			}

			// Need to get control plane config after reading env vars since reading config
			// relies on reading some env vars.
			if err := in.setControlPlaneConfig(ctx, kubeCache, &controlPlane); err != nil {
				// If this errors the configuration will likely be wrong but Kiali will fallback
				// to the istio defaults for the mesh config values it relies on.
				log.Warningf("Unable to set control plane configuration: %s", err)
			}

			controlPlane.RootNamespace = controlPlane.MeshConfig.RootNamespace
			if controlPlane.RootNamespace == "" {
				controlPlane.RootNamespace = controlPlane.IstiodNamespace
			}

			// If the cluster id that is set on the controlplane matches this cluster's id then it manages the cluster it is deployed on.
			// This is for single cluster deployments and primary-remote where the cluster here is the primary cluster.
			if controlPlane.ID == cluster.Name {
				controlPlane.ManagedClusters = append(controlPlane.ManagedClusters, &cluster)
			} else {
				// It's an "external controlplane" don't add this cluster as a "managed cluster".
				controlPlane.ExternalControlPlane = true
			}

			// If the controlplane doesn't manage an external cluster and the cluster id doesn't
			// match this cluster's name then it's probably a misconfiguration. For primary-remote
			// where the primary could be misconfigured, it's unclear how to detect this.
			if !controlPlane.ManagesExternal && controlPlane.ID != cluster.Name {
				log.Warningf("The controlplane [%s/%s] cluster name ['%s'] does not match the cluster ['%s'] where it is deployed. "+
					"This is likely a misconfiguration. Check your 'values.global.multiCluster.clusterName' setting on your controlplane "+
					"or check your Kiali configuration setting 'kubernetes_config.cluster_name'.",
					controlPlane.IstiodNamespace, controlPlane.IstiodName, controlPlane.ID, cluster.Name)
			}

			// Even if we fail to get the version we should still return the controlplane object.
			func(ctx context.Context) {
				saClient := in.kialiSAClients[cluster.Name]
				if saClient == nil {
					log.Warningf("Unable to get service account client for cluster [%s].", cluster.Name)
					return
				}

				// If this call hangs it can cause the rest of the mesh discovery to timeout.
				// Getting the version shouldn't block discovery.
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, getVersionTimeout)
				defer cancel()
				versionInfo, err := in.getVersion(ctx, in.conf, saClient, kubeCache, controlPlane)
				if err != nil {
					log.Warningf("Unable to get version info for controlplane [%s/%s] on cluster [%s]. Err: %s", controlPlane.IstiodName, controlPlane.IstiodNamespace, cluster.Name, err)
					return
				}
				controlPlane.Version = versionInfo
			}(ctx)

			// Get the status for the control plane.
			if in.conf.ExternalServices.Istio.IstioAPIEnabled {
				status, err := in.canConnectToIstiodForRevision(controlPlane)
				if err != nil {
					log.Warningf("Unable to get status for controlplane [%s/%s] on cluster [%s]. Err: %s", controlPlane.IstiodName, controlPlane.IstiodNamespace, cluster.Name, err)
					if status != nil {
						controlPlane.Status = status.Status
					}
				} else {
					controlPlane.Status = status.Status
				}
			} else {
				// When Istio API is disabled we do not probe istiod; assume healthy
				controlPlane.Status = kubernetes.ComponentHealthy
			}

			mesh.ControlPlanes = append(mesh.ControlPlanes, controlPlane)
		}
	}

	// Convert to Pointers so we can edit them directly later.
	controlPlanes := make([]*models.ControlPlane, len(mesh.ControlPlanes))
	for i := range mesh.ControlPlanes {
		controlPlanes[i] = &mesh.ControlPlanes[i]
	}
	// Convert to map.
	controlPlanesByClusterID := map[string][]*models.ControlPlane{}
	for _, cp := range controlPlanes {
		// Need the id not the cluster name.
		controlPlanesByClusterID[cp.ID] = append(controlPlanesByClusterID[cp.ID], cp)
	}

	// We don't have access to the istio secrets so can't use that to determine what
	// clusters the primaries are connected to. We may be able to use the '/debug/clusterz' endpoint.
	for _, cluster := range remoteClusters {
		cluster := cluster
		// TODO: There may be a way to know the namespace so that we don't have to iterate over all of them
		// looking for one with the controlplane annotation.
		// How does this work with revisions?
		// Is this managed by an "External Controlplane"? If so then don't look for this label because we know what manages it.
		hasExternalControlPlane := false
		for _, controlPlane := range controlPlanes {
			if controlPlane.ExternalControlPlane && controlPlane.ID == cluster.Name {
				controlPlane.ManagedClusters = append(controlPlane.ManagedClusters, cluster)
				hasExternalControlPlane = true
			}
		}
		if hasExternalControlPlane {
			continue
		}

		// In non-cluster-wide-access mode a cluster-scoped namespace list is not readable;
		// resolve the cluster's namespaces within its own effective scope instead, so remote
		// clusters are processed (their external-controlplane associations included) rather
		// than skipped.
		namespaces, err := in.getClusterNamespacesInScope(ctx, cluster.Name, namespacesInScopeMemo)
		if err != nil {
			log.Errorf("unable to process remote clusters for cluster [%s]. Err: %s", cluster.Name, err)
			continue
		}

		// There's no control plane annotation for the config clusters that are being managed by an external controlplane.
		// Find the control plane namespace i.e. the namespace with the controlplane annotation.
		controlPlaneNamespaceIdx := slices.IndexFunc(namespaces, func(namespace corev1.Namespace) bool {
			_, ok := namespace.Annotations[istioControlPlaneClustersLabel]
			return ok
		})
		if controlPlaneNamespaceIdx == -1 {
			log.Debugf("No controlplane namespace found for cluster [%s].", cluster.Name)
			continue
		}

		namespace := namespaces[controlPlaneNamespaceIdx]

		if controlClusters := namespace.Annotations[istioControlPlaneClustersLabel]; controlClusters != "" {
			// First check for '*' which means all controlplane clusters that are part of the mesh
			// and can manage external controlplanes will be able to manage this remote cluster.
			if controlClusters == "*" {
				for _, controlPlane := range controlPlanes {
					if controlPlane.ManagesExternal {
						controlPlane.ManagedClusters = append(controlPlane.ManagedClusters, cluster)
					}
				}
			} else {
				for _, controlPlaneClusterName := range strings.Split(controlClusters, ",") {
					if controlPlanes, ok := controlPlanesByClusterID[controlPlaneClusterName]; ok {
						for _, controlPlane := range controlPlanes {
							if controlPlane.ManagesExternal {
								controlPlane.ManagedClusters = append(controlPlane.ManagedClusters, cluster)
							}
						}
					}
				}
			}
		}
	}

	// Get the tags for the mesh.
	tags := in.revisionTags(ctx)

	namespacesByClusterAndRev := map[clusterRevisionKey][]models.Namespace{}
	// In non-cluster-wide-access mode the namespaces come from each cluster's own effective
	// scope (override-aware), not just the home cluster's default list: the revision map and
	// the managed-namespace associations must cover remote scopes too.
	// TODO: Namespace list / caching is probably something that other parts of Kiali need.
	// This probably should moved outside of discovery.
	if !in.conf.AllNamespacesAccessible() {
		for _, cluster := range clusters {
			if !cluster.Accessible {
				continue
			}

			k8sNamespaces, err := in.getClusterNamespacesInScope(ctx, cluster.Name, namespacesInScopeMemo)
			if err != nil {
				log.Errorf("unable to get namespaces for cluster [%s]. Err: %s", cluster.Name, err)
				continue
			}

			for _, ns := range k8sNamespaces {
				n := models.CastNamespace(ns, cluster.Name)
				rev := GetRevision(n)
				if rev == "" {
					// No revision label means there's no controlplane managing it.
					// This happens is injection is not enabled for this namespace and it's not ambient.
					continue
				}
				key := clusterRevisionKey{Cluster: cluster.Name, Revision: rev}
				namespacesByClusterAndRev[key] = append(namespacesByClusterAndRev[key], n)
			}
		}
	} else {
		for _, cluster := range clusters {
			if !cluster.Accessible {
				continue
			}

			client, ok := in.kialiSAClients[cluster.Name]
			if !ok {
				log.Errorf("unable to get client for cluster [%s].", cluster.Name)
				continue
			}

			k8sNamespaces, err := client.GetNamespaces(ctx, "")
			if err != nil {
				log.Errorf("unable to get namespaces for cluster [%s]. Err: %s", cluster.Name, err)
				continue
			}

			namespaces := FilterNamespacesWithDiscoverySelectors(
				models.CastNamespaceCollection(k8sNamespaces, cluster.Name),
				GetKialiDiscoverySelectors([]string{}, cluster.Name, in.conf),
			)
			// add control plane namespaces, which should always be included
			for _, cp := range controlPlanesByClusterID[cluster.Name] {
				if !sliceutil.Some(namespaces, func(ns models.Namespace) bool {
					return ns.Name == cp.IstiodNamespace
				}) {
					namespaces = append(namespaces, models.Namespace{Cluster: cluster.Name, Name: cp.IstiodNamespace})
				}
			}

			for _, n := range namespaces {
				rev := GetRevision(n)
				if rev == "" {
					// No revision label means there's no controlplane managing it.
					// This happens is injection is not enabled for this namespace and it's not ambient.
					continue
				}
				key := clusterRevisionKey{Cluster: cluster.Name, Revision: rev}
				namespacesByClusterAndRev[key] = append(namespacesByClusterAndRev[key], n)
			}
		}
	}

	for _, cp := range controlPlanes {
		for _, cluster := range cp.ManagedClusters {
			key := clusterRevisionKey{Cluster: cluster.Name, Revision: cp.Revision}
			clusterTags := tags[key]
			// The API exposes one display tag. Prefer the host cluster, then a
			// stable cluster and tag name for an externally managed control plane.
			preferCluster := cp.Tag == nil || cluster.Name == cp.Cluster.Name || (cp.Tag.Cluster != cp.Cluster.Name && cluster.Name < cp.Tag.Cluster)
			if len(clusterTags) > 0 && preferCluster {
				cp.Tag = clusterTags[0]
			}
			if cp.IsMaistra() {
				// In maistra the Revision is actually the maistra.io/member-of label which is the namespace where the controlplane lives.
				key := clusterRevisionKey{Cluster: cluster.Name, Revision: cp.IstiodNamespace}
				if namespaces, ok := namespacesByClusterAndRev[key]; ok {
					for _, namespace := range namespaces {
						// Exclude the namespace where the controlplane lives
						if namespace.Name != cp.IstiodNamespace {
							cp.ManagedNamespaces = append(cp.ManagedNamespaces, namespace)
						}
					}
				}
				continue
			}
			cp.ManagedNamespaces = append(cp.ManagedNamespaces, namespacesByClusterAndRev[key]...)
			for _, tag := range clusterTags {
				if tag.Name != cp.Revision {
					tagged := clusterRevisionKey{Cluster: cluster.Name, Revision: tag.Name}
					cp.ManagedNamespaces = append(cp.ManagedNamespaces, namespacesByClusterAndRev[tagged]...)
				}
			}
		}
	}

	// Check if there are discovery selectors set and filter namespaces if there are.
	for _, cp := range controlPlanes {
		if cp.MeshConfig.DiscoverySelectors != nil {
			cp.ManagedNamespaces = FilterNamespacesWithDiscoverySelectors(cp.ManagedNamespaces, convertToDiscoverySelectors(cp.MeshConfig.DiscoverySelectors))
		}
	}

	// set the NamespaceMap, any previous map will get gc'd
	// Use the namespaces already collected in namespacesByClusterAndRev which respects cluster_wide_access
	// Build it fully before the swap so readers never observe a partially filled map.
	namespaceMap := map[string]*models.ControlPlane{}
	for _, cp := range controlPlanes {
		for _, ns := range cp.ManagedNamespaces {
			namespaceMap[in.namespaceMapKey(ns.Cluster, ns.Name)] = cp
		}
	}
	in.namespaceMapMu.Lock()
	in.namespaceMap = namespaceMap
	in.namespaceMapMu.Unlock()

	return mesh, nil
}

// key returns "cluster:namespace"
func (in *Discovery) namespaceMapKey(cluster, namespace string) string {
	return cluster + ":" + namespace
}

func newControlPlane(istiod appsv1.Deployment, cluster *models.KubeCluster) models.ControlPlane {
	return models.ControlPlane{
		Cluster:                    cluster,
		IstiodName:                 istiod.Name,
		IstiodNamespace:            istiod.Namespace,
		Labels:                     istiod.Labels,
		MeshConfig:                 models.NewMeshConfig(),
		MeshConfigFilePath:         defaultMeshConfigPath,
		MeshNetworksConfigFilePath: defaultMeshNetworksConfigPath,
		MonitoringPort:             defaultMonitoringPort, // Default monitoring port, will be overridden by parseArgsInto if --monitoringAddr is found
		Revision:                   istiod.Labels[config.IstioRevisionLabel],
	}
}

func convertToDiscoverySelectors(istioSelectors []*istiov1alpha1.LabelSelector) config.DiscoverySelectorsType {
	var ds config.DiscoverySelectorsType
	for _, s := range istioSelectors {
		var reqs []metav1.LabelSelectorRequirement
		for _, exp := range s.MatchExpressions {
			reqs = append(reqs, metav1.LabelSelectorRequirement{
				Key:      exp.Key,
				Operator: metav1.LabelSelectorOperator(exp.Operator),
				Values:   exp.Values,
			})
		}
		labelSelector := config.DiscoverySelectorType(metav1.LabelSelector{
			MatchExpressions: reqs,
			MatchLabels:      s.MatchLabels,
		})
		ds = append(ds, &labelSelector)
	}
	return ds
}

// getClusterNamespacesInScope lists the cluster's namespaces the way its access allows: one
// cluster-scoped list in cluster-wide-access mode, or - in non-cluster-wide-access mode,
// where the SA cannot list namespaces - one get per namespace in the cluster's effective
// scope (its discovery selector override when one is defined, otherwise the default
// accessible namespaces). A namespace that is missing or forbidden contributes nothing; a
// transport failure (timeout, unreachable) aborts the cluster's scan so one dead remote
// cannot cost its timeout once per scoped namespace while Mesh holds its mutex. The memo
// caches the result per cluster within one mesh resolution, so the multiple passes over the
// same cluster read it once.
// scopedNamespaces is one per-cluster scoped read within a mesh resolution: the namespaces
// or the error that stopped the scan, memoized so every pass over the cluster observes the
// same result.
type scopedNamespaces struct {
	namespaces []corev1.Namespace
	err        error
}

func (in *Discovery) getClusterNamespacesInScope(ctx context.Context, cluster string, memo map[string]scopedNamespaces) ([]corev1.Namespace, error) {
	if cached, found := memo[cluster]; found {
		return cached.namespaces, cached.err
	}

	client, ok := in.kialiSAClients[cluster]
	if !ok {
		return nil, fmt.Errorf("no SA client for cluster [%s]", cluster)
	}

	var namespaces []corev1.Namespace
	var err error
	if in.conf.AllNamespacesAccessible() {
		namespaces, err = client.GetNamespaces(ctx, "")
	} else {
		scope := cache.AccessibleNamespacesForCluster(in.conf, cluster)
		namespaces = make([]corev1.Namespace, 0, len(scope))
		for _, name := range scope {
			var ns *corev1.Namespace
			ns, err = client.GetNamespace(ctx, name)
			if err != nil {
				if k8serrors.IsNotFound(err) || k8serrors.IsForbidden(err) {
					// The namespace does not exist on this cluster or the SA cannot read
					// it; either way it contributes nothing to the mesh resolution.
					err = nil
					continue
				}
				// A transport failure says nothing about the namespace: abort the scan
				// rather than silently skip the rest of the scope.
				break
			}
			namespaces = append(namespaces, *ns)
		}
	}
	memo[cluster] = scopedNamespaces{namespaces: namespaces, err: err}
	if err != nil {
		return nil, err
	}
	return namespaces, nil
}

func (in *Discovery) revisionTags(ctx context.Context) map[clusterRevisionKey][]*models.Tag {
	tagsByClusterRev := map[clusterRevisionKey][]*models.Tag{}
	// Home cluster first (see resolveMesh): a dead remote's webhook list must not run
	// ahead of the home cluster's within the rebuild budget.
	for _, cluster := range in.orderedSAClusterNames() {
		client := in.kialiSAClients[cluster]
		if !in.kialiCache.CanListWebhooks(cluster) {
			log.Debugf("Unable to list webhooks for cluster [%s]. Give Kiali permission to read 'mutatingwebhookconfigurations'. Skipping getting tags.", cluster)
			continue
		}

		webhooks, err := client.Kube().AdmissionregistrationV1().MutatingWebhookConfigurations().List(
			ctx, metav1.ListOptions{LabelSelector: models.IstioTagLabel},
		)
		if err != nil {
			// Tags are cosmetic; a cluster whose webhooks can't be listed (e.g. access was
			// revoked after startup, or it is unreachable) must not fail the whole mesh.
			log.Warningf("Unable to list webhooks for tags on cluster [%s]. Skipping tags for that cluster. err=%s", cluster, err)
			continue
		}

		for _, webhook := range webhooks.Items {
			log.Tracef("Found webhook [%s/%s] on cluster: [%s].", webhook.Namespace, webhook.Name, cluster)
			tag := models.Tag{
				Cluster:  cluster,
				Name:     webhook.Labels[models.IstioTagLabel],
				Revision: webhook.Labels[config.IstioRevisionLabel],
			}
			key := clusterRevisionKey{Cluster: cluster, Revision: tag.Revision}
			if tag.Name != "" && !slices.ContainsFunc(tagsByClusterRev[key], func(t *models.Tag) bool { return t.Name == tag.Name }) {
				tagsByClusterRev[key] = append(tagsByClusterRev[key], &tag)
			}
		}
	}
	for _, tags := range tagsByClusterRev {
		slices.SortFunc(tags, func(a, b *models.Tag) int { return strings.Compare(a.Name, b.Name) })
	}
	return tagsByClusterRev
}

func (in *Discovery) getKialiInstances(cluster models.KubeCluster) ([]models.KialiInstance, error) {
	kialiConfigURLsForCluster := []config.KialiURL{}
	for _, cfgurl := range in.conf.Clustering.KialiURLs {
		if cfgurl.ClusterName == cluster.Name {
			kialiConfigURLsForCluster = append(kialiConfigURLsForCluster, cfgurl)
		}
	}

	var instances []models.KialiInstance
	instances = append(instances, in.discoverKiali(cluster)...)
	for _, cfgURL := range kialiConfigURLsForCluster {
		instances = appendKialiInstancesFromConfig(instances, cfgURL)
	}

	return instances, nil
}

// convertKialiServiceToInstance converts a svc Service data structure of the
// Kubernetes client to a KialiInstance data structure.
func convertKialiServiceToInstance(svc *corev1.Service) models.KialiInstance {
	return models.KialiInstance{
		ServiceName:      svc.Name,
		Namespace:        svc.Namespace,
		OperatorResource: svc.Annotations["operator-sdk/primary-resource"],
		Version:          svc.Labels["app.kubernetes.io/version"],
		Url:              svc.Annotations["kiali.io/external-url"],
	}
}

// discoverKiali tries to find a Kiali installation on the cluster.
func (in *Discovery) discoverKiali(cluster models.KubeCluster) []models.KialiInstance {
	clusterName := cluster.Name
	kubeCache, err := in.kialiCache.GetKubeCache(clusterName)
	if err != nil {
		log.Warningf("Discovery for Kiali instances in cluster [%s] failed. Unable to find kube cache for cluster [%s]", clusterName, clusterName)
		return nil
	}

	// The operator and the helm charts set this fixed label. It's also
	// present in the Istio addon manifest of Kiali.
	svcList := &corev1.ServiceList{}
	if err := cache.ListReadable(context.Background(), kubeCache, in.conf, in.kialiCache, clusterName, svcList,
		ctrlclient.MatchingLabels{"app.kubernetes.io/part-of": "kiali"}); err != nil {
		log.Warningf("Discovery for Kiali instances in cluster [%s] failed: %s", clusterName, err.Error())
		return nil
	}
	services := svcList.Items

	var instances []models.KialiInstance
	for _, d := range services {
		kiali := convertKialiServiceToInstance(&d)
		// If URL is already populated (because of an annotation), trust that because it's user configuration.
		// But if Kiali URL configured per cluster name, instance name and namespace, then use that URL.
		for _, cfgurl := range in.conf.Clustering.KialiURLs {
			if cfgurl.ClusterName == clusterName && cfgurl.InstanceName == kiali.ServiceName && cfgurl.Namespace == kiali.Namespace {
				kiali.Url = cfgurl.URL
			}
		}
		instances = append(instances, kiali)
	}
	return instances
}

// appendKialiInstancesFromConfig appends the rest of Kiali instances which are configured in KialiFeatureFlags.Clustering.KialiURLs into existing list of instances.
func appendKialiInstancesFromConfig(instances []models.KialiInstance, cfgurl config.KialiURL) []models.KialiInstance {
	found := false
	for _, kiali := range instances {
		if cfgurl.InstanceName == kiali.ServiceName && cfgurl.Namespace == kiali.Namespace {
			found = true
			// skip already appended instance
			break
		}
	}
	// When configured Kiali is not found, still show that instance.
	if !found {
		instances = append(instances, models.KialiInstance{
			ServiceName: cfgurl.InstanceName,
			Namespace:   cfgurl.Namespace,
			Url:         cfgurl.URL,
		})
	}
	return instances
}

func (in *Discovery) getNetworkFromSidecarInejctorConfigMap(kubeCache ctrlclient.Reader, namespace, revision string) string {
	// Try to resolve the logical Istio's network ID of the cluster where
	// Kiali is installed. This assumes that the mesh Control Plane is installed in the same
	// cluster as Kiali.
	configMapName := sidecarInjectorConfigMapName(revision)

	istioSidecarConfig := &corev1.ConfigMap{}
	err := kubeCache.Get(context.Background(), ctrlclient.ObjectKey{Name: configMapName, Namespace: namespace}, istioSidecarConfig)
	if err != nil {
		// Don't return an error, as this may mean that Kiali is not installed along the control plane.
		// This setup is OK, it's just that it's not within our multi-cluster assumptions.
		log.Warningf("Cannot resolve the network ID of the cluster where Kiali is hosted: cannot get the sidecar injector config map :%v", err)
		return ""
	}

	parsedConfig := make(map[string]interface{})
	err = json.Unmarshal([]byte(istioSidecarConfig.Data["values"]), &parsedConfig)
	if err != nil {
		// This does not return an error, because it's probably valid that the configmap does not have the "values" key.
		// So, tell that the network wasn't found by returning blank values
		log.Debugf("Cannot resolve the network ID of the cluster where Kiali is hosted: no configuration found for the sidecar injector. Err: %v", err)
		return ""
	}

	globalConfig, ok := parsedConfig["global"]
	if !ok {
		// This does not return an error, because it's probably valid that the configmap does not have the "values.global" key.
		// So, tell that the network wasn't found by returning blank values
		log.Debugf("Cannot resolve the network ID of the cluster where Kiali is hosted: no global configuration found for the sidecar injector.")
		return ""
	}

	typedGlobalConfig, ok := globalConfig.(map[string]interface{})
	if !ok {
		log.Debug("cannot parse the config map of the Istio sidecar injector")
		return ""
	}

	networkConfig, ok := typedGlobalConfig["network"]
	if !ok {
		// This does not return an error, because it's valid that the configmap does not have the "values.global.network" key, which most
		// likely means that Istio is not setup for multi-clustering.
		// So, tell that the network wasn't found by returning blank values
		log.Debugf("Cannot resolve the network ID of the cluster where Kiali is hosted: multi-cluster is probably turned off.")
		return ""
	}

	typedNetworkConfig, ok := networkConfig.(string)
	if !ok {
		// It's probably invalid that the network id is not a string
		return ""
	}

	return typedNetworkConfig
}

// resolveNetwork tries to resolve the NETWORK_ID (as known by the Control Plane) of the
// cluster that can be accessed using the provided kubeconfig data.
// Also, it's assumed that the control plane on the remote cluster is hosted in the same
// namespace as in Kiali's Home cluster.
//
// No errors are returned because we don't want to block processing of other clusters if
// one fails. So, errors are only logged to let processing continue.
func (in *Discovery) resolveNetwork(ctx context.Context, kubeCache ctrlclient.Reader, controlPlane *models.ControlPlane) string {
	clusterName := controlPlane.Cluster.Name
	if network := in.getNetworkFromSidecarInejctorConfigMap(kubeCache, controlPlane.IstiodNamespace, controlPlane.Revision); network != "" {
		return network
	}

	// Network id wasn't found in the config. Try to find it on the istio namespace.

	// Let's assume that the istio namespace has the same name on all clusters in the mesh.
	istioNamespace, err := in.kialiSAClients[clusterName].GetNamespace(ctx, controlPlane.IstiodNamespace)
	if err != nil {
		log.Warningf("Cannot describe the [%s] namespace on cluster [%s]: %v", controlPlane.IstiodNamespace, clusterName, err)
		return ""
	}

	// For Kiali's control plane, we used the istio sidecar injector config map to fetch the network ID. This
	// approach is probably more accurate, because that's what is injected along the sidecar. However,
	// in remote clusters, we don't have privileges to query config maps, so it's not possible to fetch
	// the sidecar injector config map. However, Istio docs say that the Istio namespace must be labeled with
	// the network ID. We use that label to retrieve the network ID.
	network, ok := istioNamespace.Labels["topology.istio.io/network"]
	if !ok {
		log.Debugf("Istio namespace [%s] in cluster [%s] does not have network label", controlPlane.IstiodNamespace, clusterName)
		return ""
	}

	return network
}

// canConnectToIstiodForRevision checks if Kiali can reach the istiod pod(s) via port
// fowarding through the k8s api server or via http if the registry is
// configured with a remote url. An error does not indicate that istiod
// cannot be reached. The kubernetes.IstioComponentStatus must be checked.
func (in *Discovery) canConnectToIstiodForRevision(controlPlane models.ControlPlane) (*kubernetes.ComponentStatus, error) {
	client := in.kialiSAClients[controlPlane.Cluster.Name]
	if client == nil {
		return nil, fmt.Errorf("unable to get service account client for cluster [%s]", controlPlane.Cluster.Name)
	}

	kubeCache, err := in.kialiCache.GetKubeCache(client.ClusterInfo().Name)
	if err != nil {
		return nil, err
	}

	istiodPods, err := GetHealthyIstiodPods(kubeCache, controlPlane.Revision, controlPlane.IstiodNamespace)
	if err != nil {
		return nil, err
	}

	if len(istiodPods) == 0 {
		// aligned with GetWorkloadStatus logic (DesiredReplicas == 0), show 'Not Ready' when 0 istiod pods
		return &kubernetes.ComponentStatus{
			Cluster:   controlPlane.Cluster.Name,
			Name:      controlPlane.IstiodName,
			Namespace: controlPlane.IstiodNamespace,
			Status:    kubernetes.ComponentNotReady,
			IsCore:    true,
		}, fmt.Errorf("no healthy istiod pods found for revision [%s]", controlPlane.Revision)
	}

	// Assuming that all pods are running the same version, we only need to get the version from one healthy istiod pod.
	// Sort by creation time stamp to return the "latest" pod.
	slices.SortFunc(istiodPods, func(a, b *corev1.Pod) int {
		return a.CreationTimestamp.Compare(b.CreationTimestamp.Time)
	})
	istiodPod := GetLatestPod(istiodPods)
	status := kubernetes.ComponentHealthy
	// The 8080 port is not accessible from outside of the pod. However, it is used for kubernetes to do the live probes.
	// Using the proxy method to make sure that K8s API has access to the Istio Control Plane namespace.
	// By proxying one Istiod, we ensure that the following connection is allowed:
	// Kiali -> K8s API (proxy) -> istiod
	// This scenario is not obvious for private clusters (like GKE private cluster)
	if _, err := client.ForwardGetRequest(istiodPod.Namespace, istiodPod.Name, 8080, "/ready"); err != nil {
		log.Warningf("Unable to get ready status of istiod: %s/%s. Err: %s", istiodPod.Namespace, istiodPod.Name, err)
		status = kubernetes.ComponentUnreachable
	}

	return &kubernetes.ComponentStatus{
		Cluster:   controlPlane.Cluster.Name,
		Name:      controlPlane.IstiodName,
		Namespace: controlPlane.IstiodNamespace,
		Status:    status,
		IsCore:    true,
	}, nil
}

func parseArgsInto(args []string, controlPlane *models.ControlPlane) {
	if controlPlane == nil {
		return
	}

	flagSet := pflag.NewFlagSet("istiod", pflag.ContinueOnError)
	flagSet.ParseErrorsAllowlist.UnknownFlags = true

	monitoringAddr := flagSet.String("monitoringAddr", "", "Monitoring address in format :port")
	meshConfigPath := flagSet.String("meshConfig", defaultMeshConfigPath, "File name for Istio mesh configuration")
	meshNetworksConfigPath := flagSet.String("networksConfigFile", defaultMeshNetworksConfigPath, "File name for Istio mesh networks configuration")

	if err := flagSet.Parse(args); err != nil {
		log.Debugf("Unable to parse args from control plane: %s", err)
		return
	}

	if *monitoringAddr != "" {
		if _, port, err := net.SplitHostPort(*monitoringAddr); err == nil {
			if portNum, err := strconv.Atoi(port); err == nil {
				controlPlane.MonitoringPort = portNum
			} else {
				log.Debugf("Invalid --monitoringAddr port '%s', expected valid port number. Using default port %d: %s", port, defaultMonitoringPort, err)
			}
		} else {
			log.Debugf("Invalid --monitoringAddr format '%s', expected 'host:port' or ':port'. Using default port %d: %s", *monitoringAddr, defaultMonitoringPort, err)
		}
	}
	if isValidContainerPath(*meshConfigPath) {
		controlPlane.MeshConfigFilePath = cleanContainerPath(*meshConfigPath)
	} else {
		log.Debugf("Invalid --meshConfig path '%s'. Using default path %s", *meshConfigPath, defaultMeshConfigPath)
		controlPlane.MeshConfigFilePath = defaultMeshConfigPath
	}
	if isValidContainerPath(*meshNetworksConfigPath) {
		controlPlane.MeshNetworksConfigFilePath = cleanContainerPath(*meshNetworksConfigPath)
	} else {
		log.Debugf("Invalid --networksConfigFile path '%s'. Using default path %s", *meshNetworksConfigPath, defaultMeshNetworksConfigPath)
		controlPlane.MeshNetworksConfigFilePath = defaultMeshNetworksConfigPath
	}
}
