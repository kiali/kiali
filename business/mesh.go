package business

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"golang.org/x/exp/maps"
	"gopkg.in/yaml.v2"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
)

const (
	IstiodExternalEnvKey           = "EXTERNAL_ISTIOD"
	IstiodScopeGatewayEnvKey       = "PILOT_SCOPE_GATEWAY_TO_NAMESPACE"
	IstioInjectionLabel            = "istio-injection"
	IstioRevisionLabel             = "istio.io/rev"
	IstioControlPlaneClustersLabel = "topology.istio.io/controlPlaneClusters"
)

// Mesh is one or more controlplanes (primaries) managing a dataplane across one or more clusters.
// There can be multiple primaries on a single cluster when istio revisions are used. A single
// primary can also manage multiple clusters (primary-remote deployment).
type Mesh struct {
	// ControlPlanes that share the same mesh ID.
	ControlPlanes []ControlPlane
}

// ControlPlane manages the dataplane for one or more kube clusters.
// It's expected to manage the cluster that it is deployed in.
// It has configuration for all the clusters/namespaces associated with it.
type ControlPlane struct {
	// Cluster the kube cluster that the controlplane is running on.
	Cluster *kubernetes.Cluster

	// ManagedClusters are the clusters that this controlplane manages.
	// This could include the cluster that the controlplane is running on.
	ManagedClusters []*kubernetes.Cluster

	// Revision is the revision of the controlplane.
	// Can be empty when it's the default revision.
	Revision string

	// ManagesExternal indicates if the controlplane manages an external cluster.
	// It could also manage the cluster that it is running on.
	ManagesExternal bool

	// Config
	Config ControlPlaneConfiguration
}

// ControlPlaneConfiguration is the configuration for the controlplane and any associated dataplanes.
type ControlPlaneConfiguration struct {
	// IsGatewayToNamespace specifies the PILOT_SCOPE_GATEWAY_TO_NAMESPACE environment variable in Control Plane
	// This is not currently used by the frontend so excluding it from the API response.
	IsGatewayToNamespace bool `json:"-"`

	// OutboundTrafficPolicy is the outbound traffic policy for the controlplane.
	OutboundTrafficPolicy models.OutboundPolicy

	// Network is the name of the network that the controlplane is using.
	Network string

	// IstioMeshConfig comes from the istio configmap.
	kubernetes.IstioMeshConfig
}

// gets the mesh configuration for a controlplane from a variety of sources.
func getControlPlaneConfiguration(kubeCache cache.KubeCache, namespace string, name string) (*ControlPlaneConfiguration, error) {
	cfg, err := kubeCache.GetConfigMap(namespace, name)
	if err != nil {
		return nil, err
	}

	istioConfigMapInfo, err := kubernetes.GetIstioConfigMap(cfg)
	if err != nil {
		return nil, err
	}

	return &ControlPlaneConfiguration{
		IstioMeshConfig: *istioConfigMapInfo,
	}, nil
}

// IsRemoteCluster determines if the cluster has a controlplane or if it's a remote cluster without one.
func (in *MeshService) IsRemoteCluster(cluster string) (bool, error) {
	istioNamespace, err := in.namespaceService.GetClusterNamespace(context.TODO(), in.conf.IstioNamespace, cluster)
	if err != nil {
		return false, err
	}

	// TODO: Is checking for this annotation the only way to tell if something is a remote cluster?
	// Are there other things we should check like the webhooks?
	if _, hasAnnotation := istioNamespace.Annotations[IstioControlPlaneClustersLabel]; hasAnnotation {
		return true, nil
	}

	return false, nil
}

// GetMesh gathers information about the mesh and controlplanes running in the mesh
// from various sources e.g. istio configmap, istiod deployment envvars, etc.
func (in *MeshService) GetMesh(ctx context.Context) (*Mesh, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetMesh",
		observability.Attribute("package", "business"),
	)
	defer end()

	clusters, err := in.GetClusters()
	if err != nil {
		return nil, fmt.Errorf("unable to get mesh clusters: %w", err)
	}

	mesh := &Mesh{}
	var remoteClusters []*kubernetes.Cluster
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

		isRemoteCluster, err := in.IsRemoteCluster(cluster.Name)
		if err != nil {
			return nil, err
		}

		if isRemoteCluster {
			log.Debugf("Cluster [%s] is a remote cluster. Skipping adding a controlplane.", cluster.Name)
			remoteClusters = append(remoteClusters, &cluster)
		} else {
			// Not a remote cluster so add controlplane(s)
			// It must be a primary.
			istiods, err := kubeCache.GetDeploymentsWithSelector(in.conf.IstioNamespace, "app=istiod")
			if err != nil {
				return nil, err
			}

			for _, istiod := range istiods {
				log.Debugf("Found controlplane [%s/%s] on cluster [%s].", istiod.Name, istiod.Namespace, cluster.Name)
				controlPlane := ControlPlane{
					Cluster:  &cluster,
					Revision: istiod.Labels[IstioRevisionLabel],
				}

				configMapName := IstioConfigMapName(in.conf, controlPlane.Revision)

				controlPlaneConfig, err := getControlPlaneConfiguration(kubeCache, istiod.Namespace, configMapName)
				if err != nil {
					return nil, err
				}
				controlPlane.Config = *controlPlaneConfig

				if containers := istiod.Spec.Template.Spec.Containers; len(containers) > 0 {
					for _, env := range istiod.Spec.Template.Spec.Containers[0].Env {
						switch {
						case envVarIsSet(IstiodExternalEnvKey, env):
							controlPlane.ManagesExternal = true
						case envVarIsSet(IstiodScopeGatewayEnvKey, env):
							controlPlane.Config.IsGatewayToNamespace = true
						}
					}
				}

				// Assume this controlplane also manages the cluster it is deployed on.
				controlPlane.ManagedClusters = append(controlPlane.ManagedClusters, &cluster)
				mesh.ControlPlanes = append(mesh.ControlPlanes, controlPlane)
			}
		}
	}

	// We don't have access to the istio secrets so can't use that to determine what
	// clusters the primaries are connected to. We may be able to use the '/debug/clusterz' endpoint.
	for _, cluster := range remoteClusters {
		namespace, err := in.namespaceService.GetClusterNamespace(ctx, in.conf.IstioNamespace, cluster.Name)
		if err != nil {
			log.Errorf("unable to process remote clusters for cluster [%s]. Err: %s", cluster.Name, err)
			continue
		}

		if controlClusters := namespace.Annotations[IstioControlPlaneClustersLabel]; controlClusters != "" {
			// First check for '*' which means all controlplane clusters that are part of the mesh
			// and can managed external controlplanes will be able to manage this remote cluster.
			if controlClusters == "*" {
				for idx := range mesh.ControlPlanes {
					if mesh.ControlPlanes[idx].ManagesExternal {
						mesh.ControlPlanes[idx].ManagedClusters = append(mesh.ControlPlanes[idx].ManagedClusters, cluster)
					}
				}
			} else {
				for _, controlPlaneClusterName := range strings.Split(controlClusters, ",") {
					for idx := range mesh.ControlPlanes {
						if controlPlane := mesh.ControlPlanes[idx]; controlPlane.ManagesExternal &&
							controlPlane.Cluster.Name == controlPlaneClusterName {
							mesh.ControlPlanes[idx].ManagedClusters = append(mesh.ControlPlanes[idx].ManagedClusters, cluster)
						}
					}
				}
			}
		}
	}

	return mesh, nil
}

// IstioConfigMapName guesses the istio configmap name.
func IstioConfigMapName(conf config.Config, revision string) string {
	// If the config map name is explicitly set and it's not the default value, we should always use that.
	// Note that this means that the revision is ignored and every controlplane
	// will use this configmap regardless of which configmap actually corresponds
	// to the revision.
	if conf.ExternalServices.Istio.ConfigMapName != "" && conf.ExternalServices.Istio.ConfigMapName != "istio" {
		return conf.ExternalServices.Istio.ConfigMapName
	}

	// If the revision is set, we should use the revisioned configmap name
	// otherwise the hardcoded 'istio' value is used.
	configMapName := "istio" // As of 1.19 this is hardcoded in the helm charts.
	if revision != "default" && revision != "" {
		configMapName = configMapName + "-" + revision
	}

	return configMapName
}

func envVarIsSet(key string, env core_v1.EnvVar) bool {
	return env.Name == key && env.Value == "true"
}

const (
	AllowAny = "ALLOW_ANY"
)

// MeshService is a support service for retrieving data about the mesh environment
// when Istio is installed with multi-cluster enabled. Prefer initializing this
// type via the NewMeshService function.
type MeshService struct {
	conf                config.Config
	homeClusterSAClient kubernetes.ClientInterface
	kialiCache          cache.KialiCache
	kialiSAClients      map[string]kubernetes.ClientInterface
	namespaceService    NamespaceService
}

type meshTrafficPolicyConfig struct {
	OutboundTrafficPolicy struct {
		Mode string `yaml:"mode,omitempty"`
	} `yaml:"outboundTrafficPolicy,omitempty"`
}

// NewMeshService initializes a new MeshService structure with the given k8s clients.
func NewMeshService(kialiSAClients map[string]kubernetes.ClientInterface, cache cache.KialiCache, namespaceService NamespaceService, conf config.Config) MeshService {
	return MeshService{
		conf:                conf,
		homeClusterSAClient: kialiSAClients[conf.KubernetesConfig.ClusterName],
		kialiCache:          cache,
		kialiSAClients:      kialiSAClients,
		namespaceService:    namespaceService,
	}
}

// GetClusters resolves the Kubernetes clusters that are hosting the mesh. Resolution
// is done as best-effort using the resources that are present in the cluster.
func (in *MeshService) GetClusters() ([]kubernetes.Cluster, error) {
	if clusters := in.kialiCache.GetClusters(); clusters != nil {
		return clusters, nil
	}

	// Even if somehow there are no clusters found, which there should always be at least the homecluster,
	// setting this to an empty slice will prevent us from trying to resolve again.
	clustersByName := map[string]kubernetes.Cluster{}
	for cluster, client := range in.kialiSAClients {
		info := client.ClusterInfo()
		meshCluster := kubernetes.Cluster{
			// If there's a client for this cluster then it's accessible.
			Accessible: true,
			Name:       cluster,
			SecretName: info.SecretName,
		}
		if info.ClientConfig != nil {
			meshCluster.ApiEndpoint = info.ClientConfig.Host
		}

		meshCluster.Network = in.resolveNetwork(cluster)

		if cluster == in.conf.KubernetesConfig.ClusterName {
			meshCluster.IsKialiHome = true
		}
		clustersByName[cluster] = meshCluster
	}

	// Add clusters from config.
	for _, cluster := range in.conf.Clustering.Clusters {
		if _, found := clustersByName[cluster.Name]; !found {
			clustersByName[cluster.Name] = kubernetes.Cluster{
				Name:       cluster.Name,
				Accessible: cluster.Accessible,
			}
		}
	}

	clusters := maps.Values(clustersByName)

	// TODO: Separate KialiInstance from Cluster model.
	for idx := range clusters {
		cluster := &clusters[idx]
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

func (in *MeshService) getKialiInstances(cluster kubernetes.Cluster) ([]kubernetes.KialiInstance, error) {
	kialiConfigURLsForCluster := []config.KialiURL{}
	for _, cfgurl := range in.conf.Clustering.KialiURLs {
		if cfgurl.ClusterName == cluster.Name {
			kialiConfigURLsForCluster = append(kialiConfigURLsForCluster, cfgurl)
		}
	}

	var instances []kubernetes.KialiInstance
	instances = append(instances, in.discoverKiali(cluster)...)
	for _, cfgURL := range kialiConfigURLsForCluster {
		instances = appendKialiInstancesFromConfig(instances, cfgURL)
	}

	return instances, nil
}

// convertKialiServiceToInstance converts a svc Service data structure of the
// Kubernetes client to a KialiInstance data structure.
func convertKialiServiceToInstance(svc *core_v1.Service, cluster kubernetes.Cluster) kubernetes.KialiInstance {
	return kubernetes.KialiInstance{
		ServiceName:      svc.Name,
		Namespace:        svc.Namespace,
		OperatorResource: svc.Annotations["operator-sdk/primary-resource"],
		Version:          svc.Labels["app.kubernetes.io/version"],
		Url:              svc.Annotations["kiali.io/external-url"],
	}
}

// discoverKiali tries to find a Kiali installation on the cluster.
func (in *MeshService) discoverKiali(cluster kubernetes.Cluster) []kubernetes.KialiInstance {
	clusterName := cluster.Name
	kubeCache, err := in.kialiCache.GetKubeCache(clusterName)
	if err != nil {
		log.Warningf("Discovery for Kiali instances in cluster [%s] failed. Unable to find kube cache for cluster [%s]", clusterName, clusterName)
		return nil
	}

	// The operator and the helm charts set this fixed label. It's also
	// present in the Istio addon manifest of Kiali.
	kialiAppLabel := "app.kubernetes.io/part-of=kiali"
	services, err := kubeCache.GetServices(metav1.NamespaceAll, kialiAppLabel)
	if err != nil {
		log.Warningf("Discovery for Kiali instances in cluster [%s] failed: %s", clusterName, err.Error())
		return nil
	}

	var instances []kubernetes.KialiInstance
	for _, d := range services {
		kiali := convertKialiServiceToInstance(&d, cluster)
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
func appendKialiInstancesFromConfig(instances []kubernetes.KialiInstance, cfgurl config.KialiURL) []kubernetes.KialiInstance {
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
		instances = append(instances, kubernetes.KialiInstance{
			ServiceName: cfgurl.InstanceName,
			Namespace:   cfgurl.Namespace,
			Url:         cfgurl.URL,
		})
	}
	return instances
}

func (in *MeshService) getNetworkFromSidecarInejctorConfigMap(kubeCache cache.KubeCache) string {
	// Try to resolve the logical Istio's network ID of the cluster where
	// Kiali is installed. This assumes that the mesh Control Plane is installed in the same
	// cluster as Kiali.
	// TODO: This doesn't take into account revisions.
	istioSidecarConfig, err := kubeCache.GetConfigMap(in.conf.IstioNamespace, in.conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName)
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
func (in *MeshService) resolveNetwork(clusterName string) string {
	kubeCache, err := in.kialiCache.GetKubeCache(clusterName)
	if err != nil {
		log.Warningf("Cannot resolve the network ID of the cluster [%s]: cannot get the kube cache: %v", clusterName, err)
		return ""
	}

	if network := in.getNetworkFromSidecarInejctorConfigMap(kubeCache); network != "" {
		return network
	}

	// Network id wasn't found in the config. Try to find it on the istio namespace.

	// Let's assume that the istio namespace has the same name on all clusters in the mesh.
	istioNamespace, err := in.namespaceService.GetClusterNamespace(context.TODO(), in.conf.IstioNamespace, clusterName)
	if err != nil {
		log.Warningf("Cannot describe the [%s] namespace on cluster [%s]: %v", in.conf.IstioNamespace, clusterName, err)
		return ""
	}

	// For Kiali's control plane, we used the istio sidecar injector config map to fetch the network ID. This
	// approach is probably more accurate, because that's what is injected along the sidecar. However,
	// in remote clusters, we don't have privileges to query config maps, so it's not possible to fetch
	// the sidecar injector config map. However, Istio docs say that the Istio namespace must be labeled with
	// the network ID. We use that label to retrieve the network ID.
	network, ok := istioNamespace.Labels["topology.istio.io/network"]
	if !ok {
		log.Debugf("Istio namespace [%s] in cluster [%s] does not have network label", in.conf.IstioNamespace, clusterName)
		return ""
	}

	return network
}

func (in *MeshService) OutboundTrafficPolicy() (*models.OutboundPolicy, error) {
	otp := models.OutboundPolicy{Mode: "ALLOW_ANY"}
	istioConfig, err := in.kialiCache.GetConfigMap(in.conf.IstioNamespace, IstioConfigMapName(in.conf, ""))
	if err != nil {
		return nil, err
	}

	meshConfigYaml, ok := istioConfig.Data["mesh"]
	if !ok {
		log.Warning("Istio config not found when resolving if mesh-id is set. Falling back to mesh-id not configured.")
		return &otp, nil
	}

	meshConfig := meshTrafficPolicyConfig{}
	err = yaml.Unmarshal([]byte(meshConfigYaml), &meshConfig)
	if err != nil {
		return nil, err
	}

	if len(meshConfig.OutboundTrafficPolicy.Mode) > 0 {
		otp.Mode = meshConfig.OutboundTrafficPolicy.Mode
	}

	return &otp, nil
}

func (in *MeshService) IstiodResourceThresholds() (*models.IstiodThresholds, error) {
	istioDeploymentConfig := in.conf.ExternalServices.Istio.IstiodDeploymentName
	istioDeployment, err := in.kialiCache.GetDeployment(in.conf.IstioNamespace, istioDeploymentConfig)
	if err != nil {
		if errors.IsNotFound(err) {
			log.Debugf("Istiod deployment [%s] not found in namespace [%s]", istioDeploymentConfig, in.conf.IstioNamespace)
		}
		return nil, err
	}

	thresholds := models.IstiodThresholds{}
	deploymentContainers := istioDeployment.Spec.Template.Spec.Containers
	// Assuming that the first container is the istiod container.
	if len(deploymentContainers) > 0 {
		if memoryLimit := deploymentContainers[0].Resources.Limits.Memory(); memoryLimit != nil {
			thresholds.Memory = float64(memoryLimit.ScaledValue(resource.Mega))
		}
		if cpuLimit := deploymentContainers[0].Resources.Limits.Cpu(); cpuLimit != nil {
			thresholds.CPU = cpuLimit.AsApproximateFloat64()
		}
	}

	return &thresholds, nil
}

func (in *MeshService) CanaryUpgradeStatus() (*models.CanaryUpgradeStatus, error) {
	upgrade := in.conf.ExternalServices.Istio.IstioCanaryRevision.Upgrade
	current := in.conf.ExternalServices.Istio.IstioCanaryRevision.Current
	migratedNsList := []string{}
	pendingNsList := []string{}

	// If there is no canary configured, return empty lists
	if upgrade == "" {
		return &models.CanaryUpgradeStatus{MigratedNamespaces: migratedNsList, PendingNamespaces: pendingNsList}, nil
	}

	// Get migrated and pending namespaces
	// TODO: Support multi-primary
	migratedNss, err := in.homeClusterSAClient.GetNamespaces(fmt.Sprintf("istio.io/rev=%s", upgrade))
	if err != nil {
		return nil, err
	}
	for _, ns := range migratedNss {
		migratedNsList = append(migratedNsList, ns.Name)
	}

	pendingNss, err := in.homeClusterSAClient.GetNamespaces(fmt.Sprintf("%s=enabled", in.conf.IstioLabels.InjectionLabelName))
	if err != nil {
		return nil, err
	}
	for _, ns := range pendingNss {
		pendingNsList = append(pendingNsList, ns.Name)
	}

	pendingNss, err = in.homeClusterSAClient.GetNamespaces(fmt.Sprintf("%s=%s", in.conf.IstioLabels.InjectionLabelRev, current))
	if err != nil {
		return nil, err
	}
	for _, ns := range pendingNss {
		pendingNsList = append(pendingNsList, ns.Name)
	}

	status := &models.CanaryUpgradeStatus{
		CurrentVersion:     current,
		UpgradeVersion:     upgrade,
		MigratedNamespaces: migratedNsList,
		PendingNamespaces:  pendingNsList,
	}

	return status, nil
}

// Checks if a cluster exist
func (in *MeshService) IsValidCluster(cluster string) bool {
	_, exists := in.kialiSAClients[cluster]
	return exists
}
