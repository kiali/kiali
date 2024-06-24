package istio

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	"golang.org/x/exp/maps"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	k8syaml "k8s.io/apimachinery/pkg/util/yaml"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
)

const (
	istioControlPlaneClustersLabel = "topology.istio.io/controlPlaneClusters"
	istiodAppNameLabelKey          = "app"
	istiodAppNameLabelValue        = "istiod"
	istiodClusterIDEnvKey          = "CLUSTER_ID"
	istiodExternalEnvKey           = "EXTERNAL_ISTIOD"
	istiodScopeGatewayEnvKey       = "PILOT_SCOPE_GATEWAY_TO_NAMESPACE"
)

const (
	// DefaultRevisionLabel is the value for the default revision.
	DefaultRevisionLabel = "default"
	// IstioInjectionLabel is the value for the istio injection label on a namespace.
	IstioInjectionLabel = "istio-injection"
)

func parseIstioConfigMap(istioConfig *corev1.ConfigMap) (*models.IstioMeshConfig, error) {
	meshConfig := &models.IstioMeshConfig{}

	meshConfigYaml, ok := istioConfig.Data["mesh"]
	if !ok {
		errMsg := "parseIstioConfigMap: Cannot find Istio mesh configuration [%v]"
		log.Warningf(errMsg, istioConfig)
		return nil, fmt.Errorf(errMsg, istioConfig)
	}

	if err := k8syaml.Unmarshal([]byte(meshConfigYaml), meshConfig); err != nil {
		log.Warningf("parseIstioConfigMap: Cannot read Istio mesh configuration.")
		return nil, err
	}

	return meshConfig, nil
}

// gets the mesh configuration for a controlplane from the istio configmap.
func getControlPlaneConfiguration(kubeCache cache.KubeCache, namespace string, revision string, conf *config.Config) (*models.ControlPlaneConfiguration, error) {
	var configMap *corev1.ConfigMap
	// If the config map name is explicitly set we should always use that
	// until the config option is removed.
	if conf.ExternalServices.Istio.ConfigMapName != "" {
		cm, err := kubeCache.GetConfigMap(namespace, conf.ExternalServices.Istio.ConfigMapName)
		if err != nil {
			return nil, err
		}
		configMap = cm
	} else {
		selector := labels.Set(map[string]string{models.IstioRevisionLabel: revision}).AsSelector().String()
		configMaps, err := kubeCache.GetConfigMaps(namespace, selector)
		if err != nil {
			return nil, err
		}

		istioConfigMapName := istioConfigMapName(conf, revision)
		idx := slices.IndexFunc(configMaps, func(cm corev1.ConfigMap) bool {
			return cm.Name == istioConfigMapName
		})
		if idx == -1 {
			return nil, fmt.Errorf("no istio configmap named [%s] found for revision [%s] in namespace [%s] and cluster [%s]", istioConfigMapName, revision, namespace, kubeCache.Client().ClusterInfo().Name)
		}
		configMap = &configMaps[idx]
	}

	istioConfigMapInfo, err := parseIstioConfigMap(configMap)
	if err != nil {
		return nil, err
	}

	return &models.ControlPlaneConfiguration{
		IstioMeshConfig: *istioConfigMapInfo,
	}, nil
}

// istioConfigMapName guesses the istio configmap name.
func istioConfigMapName(conf *config.Config, revision string) string {
	if conf.ExternalServices.Istio.ConfigMapName != "" {
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

// Discovery detects istio infrastructure and configuration across clusters.
type Discovery struct {
	conf           *config.Config
	kialiCache     cache.KialiCache
	kialiSAClients map[string]kubernetes.ClientInterface
}

// NewDiscovery initializes a new Discovery.
func NewDiscovery(kialiSAClients map[string]kubernetes.ClientInterface, cache cache.KialiCache, conf *config.Config) *Discovery {
	return &Discovery{
		conf:           conf,
		kialiCache:     cache,
		kialiSAClients: kialiSAClients,
	}
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

	// Even if somehow there are no clusters found, which there should always be at least the homecluster,
	// setting this to an empty slice will prevent us from trying to resolve again.
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

		meshCluster.Network = in.resolveNetwork(cluster)

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

// Mesh gathers information about the mesh and controlplanes running in the mesh
// from various sources e.g. istio configmap, istiod deployment envvars, etc.
func (in *Discovery) Mesh(ctx context.Context) (*models.Mesh, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "Mesh",
		observability.Attribute("package", "business"),
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

		// If there's an istiod on it, then it's a controlplane cluster. Otherwise it is a remote cluster.
		istiods, err := kubeCache.GetDeploymentsWithSelector(metav1.NamespaceAll, istiodAppNameLabelKey+"="+istiodAppNameLabelValue)
		if err != nil {
			return nil, err
		}

		if len(istiods) == 0 {
			log.Debugf("Cluster [%s] is a remote cluster. Skipping adding a controlplane.", cluster.Name)
			remoteClusters = append(remoteClusters, &cluster)
			continue
		}

		for _, istiod := range istiods {
			log.Debugf("Found controlplane [%s/%s] on cluster [%s].", istiod.Name, istiod.Namespace, cluster.Name)
			controlPlane := models.ControlPlane{
				Cluster:         &cluster,
				IstiodName:      istiod.Name,
				IstiodNamespace: istiod.Namespace,
				Revision:        istiod.Labels[models.IstioRevisionLabel],
			}

			controlPlaneConfig, err := getControlPlaneConfiguration(kubeCache, istiod.Namespace, controlPlane.Revision, in.conf)
			if err != nil {
				return nil, err
			}
			controlPlane.Config = *controlPlaneConfig

			if containers := istiod.Spec.Template.Spec.Containers; len(containers) > 0 {
				for _, env := range istiod.Spec.Template.Spec.Containers[0].Env {
					switch {
					case kubernetes.EnvVarIsTrue(istiodExternalEnvKey, env):
						controlPlane.ManagesExternal = true
					case kubernetes.EnvVarIsTrue(istiodScopeGatewayEnvKey, env):
						controlPlane.Config.IsGatewayToNamespace = true
					case env.Name == istiodClusterIDEnvKey:
						controlPlane.ID = env.Value
					}
				}
			}

			// If the cluster id set on the controlplane matches the cluster's id then it manages the cluster it is deployed on.
			if controlPlane.ID == cluster.Name {
				controlPlane.ManagedClusters = append(controlPlane.ManagedClusters, &cluster)
			} else {
				// It's an "external controlplane".
				controlPlane.ExternalControlPlane = true
			}

			// Even if we fail to get the version we should still return the controlplane object.
			func() {
				saClient := in.kialiSAClients[cluster.Name]
				if saClient == nil {
					log.Warningf("Unable to get service account client for cluster [%s].", cluster.Name)
					return
				}

				versionInfo, err := GetVersion(ctx, in.conf, saClient, kubeCache, controlPlane.Revision, controlPlane.IstiodNamespace)
				if err != nil {
					log.Warningf("Unable to get version info for controlplane [%s/%s] on cluster [%s]. Err: %s", controlPlane.IstiodName, controlPlane.IstiodNamespace, cluster.Name, err)
					return
				}
				controlPlane.Version = versionInfo
			}()

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

	in.kialiCache.SetMesh(mesh)

	return mesh, nil
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
	kialiAppLabel := "app.kubernetes.io/part-of=kiali"
	services, err := kubeCache.GetServices(metav1.NamespaceAll, kialiAppLabel)
	if err != nil {
		log.Warningf("Discovery for Kiali instances in cluster [%s] failed: %s", clusterName, err.Error())
		return nil
	}

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

func (in *Discovery) getNetworkFromSidecarInejctorConfigMap(kubeCache cache.KubeCache) string {
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
func (in *Discovery) resolveNetwork(clusterName string) string {
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
	istioNamespace, err := in.kialiSAClients[clusterName].GetNamespace(in.conf.IstioNamespace)
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
