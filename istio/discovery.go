package istio

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/pflag"
	"golang.org/x/exp/maps"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
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

	meshNetworksYAML, ok := istioConfig.Data["meshNetworks"]
	if !ok {
		log.Debugf("parseIstioConfigMap: Cannot find Istio mesh networks [%v]", istioConfig)
	} else {
		if into.MeshNetworks == nil {
			into.MeshNetworks = &istiov1alpha1.MeshNetworks{}
		}
		if err := k8syaml.Unmarshal([]byte(meshNetworksYAML), into.MeshNetworks); err != nil {
			log.Warningf("parseIstioConfigMap: Cannot read Istio mesh configuration.")
			return err
		}
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
func (in *Discovery) setControlPlaneConfig(kubeCache ctrlclient.Reader, controlPlane *models.ControlPlane) error {
	var configMapName string
	// If the config map name is explicitly set we should always use that
	// until the config option is removed.
	if in.conf.ExternalServices.Istio.ConfigMapName != "" {
		configMapName = in.conf.ExternalServices.Istio.ConfigMapName
	} else {
		configMapName = istioConfigMapName(controlPlane.Revision)
	}

	controlPlaneConf := &models.ControlPlaneConfiguration{
		Network: in.resolveNetwork(kubeCache, controlPlane),
		StandardConfig: &models.MeshConfigSource{
			Cluster:   controlPlane.Cluster.Name,
			ConfigMap: &models.MeshConfigMap{},
			Name:      configMapName,
			Namespace: controlPlane.IstiodNamespace,
		},
		EffectiveConfig: &models.MeshConfigSource{ConfigMap: &models.MeshConfigMap{}},
	}

	// First take the shared user configmap if the env var is set.
	// Then unmarshal the standard configmap over the shared user
	// config since the standard one takes precedence. When you unmarshal
	// one config into another, you override the values that are present
	// and the ones that aren't present remain unchanged.
	// TODO: Skipping external controlplane for now (ID != cluster).
	// For this to work with external controlplane,
	// we would need to pass in the controlplane.ClusterID kubecache and to merge
	// with the local /etc/istio/config file.
	if controlPlane.SharedMeshConfig != "" && controlPlane.ID == controlPlane.Cluster.Name {
		log.Tracef("Shared mesh config '%s' is present", controlPlane.SharedMeshConfig)
		if err := setSharedConfig(controlPlane, controlPlaneConf, kubeCache); err != nil {
			log.Errorf("There was a problem with the Shared Mesh ConfigMap. istio configuration may not be accurate: %s", err)
		}
	}

	standardConfigMap := &corev1.ConfigMap{}
	if err := kubeCache.Get(
		context.Background(),
		ctrlclient.ObjectKey{Name: configMapName, Namespace: controlPlane.IstiodNamespace},
		standardConfigMap,
	); err != nil {
		return err
	}

	if err := parseIstioConfigMap(standardConfigMap, controlPlaneConf.StandardConfig.ConfigMap); err != nil {
		return err
	}

	// Unmarshal again into effective.
	if err := parseIstioConfigMap(standardConfigMap, controlPlaneConf.EffectiveConfig.ConfigMap); err != nil {
		return err
	}

	// When using the SHARED_MESH_CONFIG env var, istio merges the ProxyConfig unlike the other settings that are overridden
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

	certConfigMap := &corev1.ConfigMap{}
	if err := kubeCache.Get(
		context.Background(),
		ctrlclient.ObjectKey{Name: certificatesConfigMapName, Namespace: controlPlane.IstiodNamespace},
		certConfigMap,
	); err != nil {
		log.Warningf("Unable to get certificate configmap [%s/%s]. Err: %s", controlPlane.IstiodNamespace, certificatesConfigMapName, err)
	} else {
		cert := parseIstioControlPlaneCertificate(certConfigMap)
		controlPlaneConf.Certificates = append(controlPlaneConf.Certificates, cert)
	}

	controlPlane.Config = *controlPlaneConf

	return nil
}

func setSharedConfig(controlPlane *models.ControlPlane, controlPlaneConf *models.ControlPlaneConfiguration, kubeCache ctrlclient.Reader) error {
	sharedConfig := &models.MeshConfigSource{
		Cluster:   controlPlane.Cluster.Name,
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
		return fmt.Errorf("unable to get Shared User ConfigMap [%s] in namespace [%s] on cluster [%s]: %s", controlPlane.SharedMeshConfig, controlPlane.IstiodNamespace, controlPlane.Cluster.Name, err)
	}

	if err := parseIstioConfigMap(sharedUserConfigMap, sharedConfig.ConfigMap); err != nil {
		return fmt.Errorf("unable to parse Shared User ConfigMap [%s] in namespace [%s] on cluster [%s]: %s", controlPlane.SharedMeshConfig, controlPlane.IstiodNamespace, controlPlane.Cluster.Name, err)
	}

	// Unmarshal again into effective.
	if err := parseIstioConfigMap(sharedUserConfigMap, controlPlaneConf.EffectiveConfig.ConfigMap); err != nil {
		return fmt.Errorf("unable to parse Shared User ConfigMap [%s] in namespace [%s] on cluster [%s] into EffectiveConfig: %s", controlPlane.SharedMeshConfig, controlPlane.IstiodNamespace, controlPlane.Cluster.Name, err)
	}

	controlPlaneConf.SharedConfig = sharedConfig
	return nil
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

func fusionMeshConfigs(mesh *models.MeshConfig, into *models.MeshConfig) error {
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
	return json.Unmarshal(mergedJSON, &into)
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
	Clusters() ([]models.KubeCluster, error)
	GetControlPlaneNamespaces(ctx context.Context, cluster string) []string
	IsControlPlane(ctx context.Context, cluster, namespace string) bool
	Mesh(ctx context.Context) (*models.Mesh, error)
}

// Discovery detects istio infrastructure and configuration across clusters.
type Discovery struct {
	conf           *config.Config
	kialiCache     cache.KialiCache
	kialiSAClients map[string]kubernetes.ClientInterface
}

// NewDiscovery initializes a new Discovery.
func NewDiscovery(clients map[string]kubernetes.ClientInterface, cache cache.KialiCache, conf *config.Config) *Discovery {
	return &Discovery{
		conf:           conf,
		kialiCache:     cache,
		kialiSAClients: clients,
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

// Clusters resolves the Kubernetes clusters that are hosting the mesh. Resolution
// is done as best-effort using the resources that are present in the cluster.
// TODO: should this go in kubernetes package?
func (in *Discovery) Clusters() ([]models.KubeCluster, error) {
	if clusters := in.kialiCache.GetClusters(); clusters != nil {
		return clusters, nil
	}

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

	// Add clusters from config.
	for _, cluster := range in.conf.Clustering.Clusters {
		if _, found := clustersByName[cluster.Name]; !found {
			clustersByName[cluster.Name] = models.KubeCluster{
				Name: cluster.Name,
				// Clusters without a SecretName are not accessible
				// because we don't have a kubeconfig for them.
				Accessible: cluster.SecretName != "",
			}
		}
	}

	clusters := maps.Values(clustersByName)

	if len(clusters) == 0 {
		log.Warning("No clusters found. This likely means that Kiali is misconfigured. Ensure that kiali is configured to access at least one cluster.")
	}

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

	in.kialiCache.SetClusters(clusters)

	return clusters, nil
}

type clusterRevisionKey struct {
	Cluster  string
	Revision string
}

// Mesh gathers information about the mesh and controlplanes running in the mesh
// from various sources e.g. istio configmap, istiod deployment envvars, etc.
// Do not edit the mesh object returned from here directly. It is shared across threads.
func (in *Discovery) Mesh(ctx context.Context) (*models.Mesh, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "Mesh",
		observability.Attribute("package", "istio"),
	)
	defer end()

	if mesh, ok := in.kialiCache.GetMesh(); ok {
		return mesh, nil
	}

	clusters, err := in.Clusters()
	if err != nil {
		return nil, fmt.Errorf("unable to get mesh clusters: %w", err)
	}

	mesh := &models.Mesh{}
	var remoteClusters []*models.KubeCluster
	for _, cluster := range clusters {
		// We can't get anything from an inaccessible cluster.
		if !cluster.Accessible {
			continue
		}

		cluster := cluster
		kubeCache, err := in.kialiCache.GetKubeCache(cluster.Name)
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
		err = kubeCache.List(ctx, depList, ctrlclient.MatchingLabels(labels))
		if err != nil {
			return nil, err
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
					case env.Name == istiodSharedMeshConfigEnvKey:
						controlPlane.SharedMeshConfig = env.Value
					}
				}

				// Parse the deployment args and set fields on the control plane
				parseArgsInto(containers[0].Args, &controlPlane)

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
			if err := in.setControlPlaneConfig(kubeCache, &controlPlane); err != nil {
				// If this errors the configuration will likely be wrong but Kiali will fallback
				// to the istio defaults for the mesh config values it relies on.
				log.Warningf("Unable to set control plane configuration: %s", err)
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
				versionInfo, err := GetVersion(ctx, in.conf, saClient, kubeCache, controlPlane)
				if err != nil {
					log.Warningf("Unable to get version info for controlplane [%s/%s] on cluster [%s]. Err: %s", controlPlane.IstiodName, controlPlane.IstiodNamespace, cluster.Name, err)
					return
				}
				controlPlane.Version = versionInfo
			}(ctx)

			// Get the status for the control plane.
			status, err := in.canConnectToIstiodForRevision(controlPlane)
			if err != nil {
				log.Warningf("Unable to get status for controlplane [%s/%s] on cluster [%s]. Err: %s", controlPlane.IstiodName, controlPlane.IstiodNamespace, cluster.Name, err)
				if status != nil {
					controlPlane.Status = status.Status
				}
			} else {
				controlPlane.Status = status.Status
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
	controlPlanesByClusterName := map[string][]*models.ControlPlane{}
	for _, cp := range controlPlanes {
		// Need the id not the cluster name.
		controlPlanesByClusterName[cp.ID] = append(controlPlanesByClusterName[cp.ID], cp)
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

		if !in.conf.AllNamespacesAccessible() {
			log.Infof("All namespaces are not accessible. Skipping processing remote clusters for cluster [%s].", cluster.Name)
			continue
		}

		namespaces, err := in.kialiSAClients[cluster.Name].GetNamespaces("")
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
					if controlPlanes, ok := controlPlanesByClusterName[controlPlaneClusterName]; ok {
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
	if err := in.setTags(ctx, mesh.ControlPlanes); err != nil {
		return nil, err
	}

	namespacesByClusterAndRev := map[clusterRevisionKey][]models.Namespace{}
	// Multi-cluster is not supported without cluster wide access.
	if !in.conf.AllNamespacesAccessible() {
		// TODO: Namespace list / caching is probably something that other parts of Kiali need.
		// This probably should moved outside of discovery.
		for _, name := range in.conf.Deployment.AccessibleNamespaces {
			homeClusterClient, ok := in.kialiSAClients[in.conf.KubernetesConfig.ClusterName]
			if !ok {
				log.Errorf("unable to get client for cluster [%s].", in.conf.KubernetesConfig.ClusterName)
				continue
			}

			ns, err := homeClusterClient.GetNamespace(name)
			if err != nil {
				log.Errorf("unable to get namespace [%s] for cluster [%s]. Err: %s", name, in.conf.KubernetesConfig.ClusterName, err)
				continue
			}

			n := models.CastNamespace(*ns, in.conf.KubernetesConfig.ClusterName)
			rev := GetRevision(n)
			if rev == "" {
				// No revision label means there's no controlplane managing it.
				// This happens is injection is not enabled for this namespace and it's not ambient.
				continue
			}
			key := clusterRevisionKey{Cluster: in.conf.KubernetesConfig.ClusterName, Revision: rev}
			namespacesByClusterAndRev[key] = append(namespacesByClusterAndRev[key], n)
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

			k8sNamespaces, err := client.GetNamespaces("")
			if err != nil {
				log.Errorf("unable to get namespaces for cluster [%s]. Err: %s", cluster.Name, err)
				continue
			}

			namespaces := FilterNamespacesWithDiscoverySelectors(
				models.CastNamespaceCollection(k8sNamespaces, cluster.Name),
				GetKialiDiscoverySelectors([]string{}, cluster.Name, in.conf),
			)
			// add control plane namespaces, which should always be included
			for _, cp := range controlPlanesByClusterName[cluster.Name] {
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
			// Default to controlplane revision but if there's a tag then overwrite with that.
			rev := cp.Revision
			if cp.Tag != nil {
				if cp.Tag.Cluster == cluster.Name && cp.Tag.Revision == cp.Revision {
					rev = cp.Tag.Name
				}
			}
			key := clusterRevisionKey{Cluster: cluster.Name, Revision: rev}
			if namespaces, ok := namespacesByClusterAndRev[key]; ok {
				cp.ManagedNamespaces = append(cp.ManagedNamespaces, namespaces...)
			}
		}
	}

	// Check if there are discovery selectors set and filter namespaces if there are.
	for _, cp := range controlPlanes {
		if cp.MeshConfig.DiscoverySelectors != nil {
			cp.ManagedNamespaces = FilterNamespacesWithDiscoverySelectors(cp.ManagedNamespaces, convertToDiscoverySelectors(cp.MeshConfig.DiscoverySelectors))
		}
	}

	in.kialiCache.SetMesh(mesh)

	return mesh, nil
}

func newControlPlane(istiod appsv1.Deployment, cluster *models.KubeCluster) models.ControlPlane {
	return models.ControlPlane{
		Cluster:         cluster,
		Labels:          istiod.Labels,
		MeshConfig:      models.NewMeshConfig(),
		MonitoringPort:  defaultMonitoringPort, // Default monitoring port, will be overridden by parseArgsInto if --monitoringAddr is found
		IstiodName:      istiod.Name,
		IstiodNamespace: istiod.Namespace,
		Revision:        istiod.Labels[config.IstioRevisionLabel],
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

func (in *Discovery) setTags(ctx context.Context, controlPlanes []models.ControlPlane) error {
	tagsByClusterRev := map[string]*models.Tag{}
	for cluster, client := range in.kialiSAClients {
		if !in.kialiCache.CanListWebhooks(cluster) {
			log.Debugf("Unable to list webhooks for cluster [%s]. Give Kiali permission to read 'mutatingwebhookconfigurations'. Skipping getting tags.", cluster)
			continue
		}

		webhooks, err := client.Kube().AdmissionregistrationV1().MutatingWebhookConfigurations().List(
			ctx, metav1.ListOptions{LabelSelector: models.IstioTagLabel},
		)
		if err != nil {
			return err
		}

		for _, webhook := range webhooks.Items {
			log.Tracef("Found webhook [%s/%s] on cluster: [%s].", webhook.Namespace, webhook.Name, cluster)
			tag := models.Tag{
				Cluster:  cluster,
				Name:     webhook.Labels[models.IstioTagLabel],
				Revision: webhook.Labels[config.IstioRevisionLabel],
			}
			key := tag.Cluster + tag.Revision
			if _, found := tagsByClusterRev[key]; found {
				log.Debugf("Found more than one webhook for tag [%s] pointing to revision: [%s] on cluster: [%s]. This is likely a misconfiguration.", tag.Name, tag.Revision, tag.Cluster)
				continue
			}
			tagsByClusterRev[key] = &tag
		}
	}

	for i := range controlPlanes {
		controlPlane := &controlPlanes[i]
		for _, cluster := range controlPlane.ManagedClusters {
			key := cluster.Name + controlPlane.Revision
			if tag, ok := tagsByClusterRev[key]; ok {
				controlPlane.Tag = tag
			}
		}
	}

	return nil
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
	err = kubeCache.List(context.Background(), svcList, ctrlclient.MatchingLabels{"app.kubernetes.io/part-of": "kiali"})
	if err != nil {
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
	var configMapName string
	if in.conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName != "" {
		configMapName = in.conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName
	} else {
		configMapName = sidecarInjectorConfigMapName(revision)
	}

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
func (in *Discovery) resolveNetwork(kubeCache ctrlclient.Reader, controlPlane *models.ControlPlane) string {
	clusterName := controlPlane.Cluster.Name
	if network := in.getNetworkFromSidecarInejctorConfigMap(kubeCache, controlPlane.IstiodNamespace, controlPlane.Revision); network != "" {
		return network
	}

	// Network id wasn't found in the config. Try to find it on the istio namespace.

	// Let's assume that the istio namespace has the same name on all clusters in the mesh.
	istioNamespace, err := in.kialiSAClients[clusterName].GetNamespace(controlPlane.IstiodNamespace)
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
	flagSet.ParseErrorsWhitelist.UnknownFlags = true

	monitoringAddr := flagSet.String("monitoringAddr", "", "Monitoring address in format :port")

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
}
