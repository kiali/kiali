package business

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

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
	"github.com/kiali/kiali/util/httputil"
)

const (
	AllowAny = "ALLOW_ANY"
)

// MeshService is a support service for retrieving data about the mesh environment
// when Istio is installed with multi-cluster enabled. Prefer initializing this
// type via the NewMeshService function.
type MeshService struct {
	conf                config.Config
	homeClusterSAClient kubernetes.ClientInterface
	layer               *Layer
	kialiCache          cache.KialiCache
	kialiSAClients      map[string]kubernetes.ClientInterface
}

type meshTrafficPolicyConfig struct {
	OutboundTrafficPolicy struct {
		Mode string `yaml:"mode,omitempty"`
	} `yaml:"outboundTrafficPolicy,omitempty"`
}

// NewMeshService initializes a new MeshService structure with the given k8s clients.
func NewMeshService(kialiSAClients map[string]kubernetes.ClientInterface, cache cache.KialiCache, layer *Layer, conf config.Config) MeshService {
	return MeshService{
		conf:                conf,
		kialiSAClients:      kialiSAClients,
		homeClusterSAClient: kialiSAClients[conf.KubernetesConfig.ClusterName],
		layer:               layer,
		kialiCache:          cache,
	}
}

// GetClusters resolves the Kubernetes clusters that are hosting the mesh. Resolution
// is done as best-effort using the resources that are present in the cluster.
func (in *MeshService) GetClusters(r *http.Request) ([]kubernetes.Cluster, error) {
	if clusters := in.kialiCache.GetClusters(); clusters != nil {
		return clusters, nil
	}

	// Even if somehow there are no clusters found, which there should always be at least the homecluster,
	// setting this to an empty slice will prevent us from trying to resolve again.
	clusters := []kubernetes.Cluster{}
	for cluster, client := range in.kialiSAClients {
		info := client.ClusterInfo()
		meshCluster := kubernetes.Cluster{
			Name:       cluster,
			SecretName: info.SecretName,
		}
		if info.ClientConfig != nil {
			meshCluster.ApiEndpoint = info.ClientConfig.Host
		}

		meshCluster.KialiInstances = in.discoverKiali(context.TODO(), cluster, r)
		meshCluster.Network = in.resolveNetwork(cluster)

		if cluster == in.conf.KubernetesConfig.ClusterName {
			meshCluster.IsKialiHome = true
			// The "cluster_id" is set in an environment variable of
			// the "istiod" deployment. Let's try to fetch it.
			// TODO: Support multi-primary instead of using home cluster.
			_, gatewayToNamespace, err := kubernetes.ClusterInfoFromIstiod(in.conf, in.homeClusterSAClient)
			if err != nil {
				// We didn't find it. This may mean that Istio is not setup with multi-cluster enabled.
				return nil, err
			}
			meshCluster.IsGatewayToNamespace = gatewayToNamespace
		}
		clusters = append(clusters, meshCluster)
	}

	in.kialiCache.SetClusters(clusters)

	return clusters, nil
}

// convertKialiServiceToInstance converts a svc Service data structure of the
// Kubernetes client to a KialiInstance data structure.
func convertKialiServiceToInstance(svc *core_v1.Service) kubernetes.KialiInstance {
	return kubernetes.KialiInstance{
		ServiceName:      svc.Name,
		Namespace:        svc.Namespace,
		OperatorResource: svc.Annotations["operator-sdk/primary-resource"],
		Version:          svc.Labels["app.kubernetes.io/version"],
		Url:              svc.Annotations["kiali.io/external-url"],
	}
}

// findKialiInNamespace tries to find a Kiali installation certain namespace of a cluster.
// The clientSet argument should be an already initialized REST client to the API server of the
// cluster. The namespace argument specifies the namespace where a Kiali instance will be looked for.
// The clusterName argument is for logging purposes only.
func (in *MeshService) discoverKiali(ctx context.Context, clusterName string, r *http.Request) []kubernetes.KialiInstance {
	// Not using the cache since it doesn't support cross cluster querying. Perhaps it should.
	client, ok := in.kialiSAClients[clusterName]
	if !ok {
		log.Warningf("Discovery for Kiali instances in cluster [%s] failed. Unable to find SA client for cluster [%s]", clusterName, clusterName)
		return nil
	}

	// The operator and the helm charts set this fixed label. It's also
	// present in the Istio addon manifest of Kiali.
	kialiAppLabel := "app.kubernetes.io/part-of=kiali"
	services, err := client.Kube().CoreV1().Services(metav1.NamespaceAll).List(ctx, metav1.ListOptions{LabelSelector: kialiAppLabel})
	if err != nil {
		log.Warningf("Discovery for Kiali instances in cluster [%s] failed: %s", clusterName, err.Error())
		return nil
	}

	var instances []kubernetes.KialiInstance
	for _, d := range services.Items {
		kiali := convertKialiServiceToInstance(&d)
		// If URL is already populated (because of an annotation), trust that because it's user configuration.
		// Only guess ourselves on our own cluster.
		if kiali.Url == "" && clusterName == in.conf.KubernetesConfig.ClusterName {
			kiali.Url = httputil.GuessKialiURL(r)
		}
		instances = append(instances, kiali)
	}

	return instances
}

// resolveNetwork tries to resolve the NETWORK_ID (as know by the Control Plane) of the
// cluster that can be accessed using the provided kubeconfig data.
// Also, it's assumed that the control plane on the remote cluster is hosted in the same
// namespace as in Kiali's Home cluster. clusterName argument is only for logging purposes.
//
// No errors are returned because we don't want to block processing of other clusters if
// one fails. So, errors are only logged to let processing continue.
func (in *MeshService) resolveNetwork(clusterName string) string {
	var network string
	if clusterName == in.conf.KubernetesConfig.ClusterName {
		// Home Cluster

		// Try to resolve the logical Istio's network ID of the cluster where
		// Kiali is installed. This assumes that the mesh Control Plane is installed in the same
		// cluster as Kiali.
		istioSidecarConfig, err := in.kialiCache.GetConfigMap(in.conf.IstioNamespace, in.conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName)
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

		network = typedNetworkConfig
	} else {
		// Remote cluster
		remoteClientSet, ok := in.kialiSAClients[clusterName]
		if !ok {
			log.Warningf("Cannot find a remote client on cluster [%s]: no client set", clusterName)
			return ""
		}

		// Let's assume that the istio namespace has the same name on all clusters in the mesh.
		istioNamespace, getNsErr := remoteClientSet.GetNamespace(in.conf.IstioNamespace)
		if getNsErr != nil {
			log.Warningf("Cannot describe the [%s] namespace on cluster [%s]: %v", in.conf.IstioNamespace, clusterName, getNsErr)
			return ""
		}

		// For Kiali's control plane, we used the istio sidecar injector config map to fetch the network ID. This
		// approach is probably more accurate, because that's what is injected along the sidecar. However,
		// in remote clusters, we don't have privileges to query config maps, so it's not possible to fetch
		// the sidecar injector config map. However, Istio docs say that the Istio namespace must be labeled with
		// the network ID. We use that label to retrieve the network ID.
		networkName, ok := istioNamespace.Labels["topology.istio.io/network"]
		if !ok {
			log.Debugf("Istio namespace [%s] in cluster [%s] does not have network label", in.conf.IstioNamespace, clusterName)
			return ""
		}

		network = networkName
	}

	return network
}

func (in *MeshService) OutboundTrafficPolicy() (*models.OutboundPolicy, error) {
	otp := models.OutboundPolicy{Mode: "ALLOW_ANY"}
	istioConfig, err := in.kialiCache.GetConfigMap(in.conf.IstioNamespace, in.conf.ExternalServices.Istio.ConfigMapName)
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
	_, exists := in.layer.k8sClients[cluster]
	return exists
}
