package business

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"gopkg.in/yaml.v2"
	v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/httputil"
)

const (
	DefaultClusterID = "Kubernetes"
	AllowAny         = "ALLOW_ANY"
)

// MeshService is a support service for retrieving data about the mesh environment
// when Istio is installed with multi-cluster enabled. Prefer initializing this
// type via the NewMeshService function.
type MeshService struct {
	k8s   kubernetes.ClientInterface
	layer *Layer

	// newRemoteClient is a helper variable holding a function that should return an
	// initialized kubernetes client using the specified config argument. This was created,
	// mainly, for tests to set a function returning a mock of the kuberentes client.
	newRemoteClient func(config *rest.Config) (kubernetes.ClientInterface, error)
}

// Cluster holds some metadata about a cluster that is
// part of the mesh.
type Cluster struct {
	// ApiEndpoint is the URL where the Kubernetes/Cluster API Server can be contacted
	ApiEndpoint string `json:"apiEndpoint"`

	// IsKialiHome specifies if this cluster is hosting this Kiali instance (and the observed Mesh Control Plane)
	IsKialiHome bool `json:"isKialiHome"`

	// IsGatewayToNamespace specifies the PILOT_SCOPE_GATEWAY_TO_NAMESPACE environment variable in Control PLane
	IsGatewayToNamespace bool `json:"isGatewayToNamespace"`

	// KialiInstances is the list of Kialis discovered in the cluster.
	KialiInstances []KialiInstance `json:"kialiInstances"`

	// Name specifies the CLUSTER_ID as known by the Control Plane
	Name string `json:"name"`

	// Network specifies the logical NETWORK_ID as known by the Control Plane
	Network string `json:"network"`

	// SecretName is the name of the kubernetes "remote cluster secret" that was mounted to the file system and where data of this cluster was resolved
	SecretName string `json:"secretName"`
}

// KialiInstance represents a Kiali installation. It holds some data about
// where and how Kiali was deployed.
type KialiInstance struct {
	// ServiceName is the name of the Kubernetes service associated to the Kiali installation. The Kiali Service is the
	// entity that is looked for in order to determine if a Kiali instance is available.
	ServiceName string `json:"serviceName"`

	// Namespace is the name of the namespace where is Kiali installed on.
	Namespace string `json:"namespace"`

	// OperatorResource contains the namespace and the name of the Kiali CR that the user
	// created to install Kiali via the operator. This can be blank if the operator wasn't used
	// to install Kiali. This resource is populated from annotations in the Service. It has
	// the format "namespace/resource_name".
	OperatorResource string `json:"operatorResource"`

	// Url is the URI that can be used to access Kiali.
	Url string `json:"url"`

	// Version is the Kiali version as reported by annotations in the Service.
	Version string `json:"version"`
}

type meshIdConfig struct {
	DefaultConfig struct {
		MeshId string `yaml:"meshId,omitempty"`
	} `yaml:"defaultConfig,omitempty"`
}

type meshTrafficPolicyConfig struct {
	OutboundTrafficPolicy struct {
		Mode string `yaml:"mode,omitempty"`
	} `yaml:"outboundTrafficPolicy,omitempty"`
}

// NewMeshService initializes a new MeshService structure with the given k8sClients client and
// newRemoteClientFunc arguments (see the MeshService struct for details). The newRemoteClientFunc
// can be passed a nil value and a default function will be used.
func NewMeshService(k8s kubernetes.ClientInterface, layer *Layer, newRemoteClientFunc func(config *rest.Config) (kubernetes.ClientInterface, error)) MeshService {
	if newRemoteClientFunc == nil {
		newRemoteClientFunc = func(config *rest.Config) (kubernetes.ClientInterface, error) {
			return kubernetes.NewClientFromConfig(config)
		}
	}

	return MeshService{
		k8s:             k8s,
		layer:           layer,
		newRemoteClient: newRemoteClientFunc,
	}
}

// GetClusters resolves the Kubernetes clusters that are hosting the mesh. Resolution
// is done as best-effort using the resources that are present in the cluster.
func (in *MeshService) GetClusters(r *http.Request) (clusters []Cluster, errVal error) {
	var err error

	remoteClusters, err := in.resolveRemoteClustersFromSecrets()
	if err != nil {
		return nil, err
	}

	myCluster, err := in.ResolveKialiControlPlaneCluster(r)
	if err != nil {
		return nil, err
	}

	if myCluster == nil {
		clusters = remoteClusters
	} else {
		clusters = append(remoteClusters, *myCluster)
	}

	return
}

// IsMeshConfigured does not change and can be cached

// isMeshConfiguredCached just indicates whether we have cached the value (because it may be false)
var isMeshConfiguredCached bool

// isMeshConfigured holds the cached value
var isMeshConfigured bool

func (in *MeshService) IsMeshConfigured() (bool, error) {
	if isMeshConfiguredCached {
		return isMeshConfigured, nil
	}

	cfg := config.Get()

	istioConfig, err := in.k8s.GetConfigMap(cfg.IstioNamespace, cfg.ExternalServices.Istio.ConfigMapName)
	if err != nil {
		if errors.IsNotFound(err) {
			err = fmt.Errorf("%w in namespace [%s]", err, cfg.IstioNamespace)
		}
		return false, err
	}

	meshConfigYaml, ok := istioConfig.Data["mesh"]
	if !ok {
		log.Warning("Istio config not found when resolving if mesh-id is set. Falling back to mesh-id not configured.")
		return false, nil
	}

	meshConfig := meshIdConfig{}
	err = yaml.Unmarshal([]byte(meshConfigYaml), &meshConfig)
	if err != nil {
		return false, err
	}

	if len(meshConfig.DefaultConfig.MeshId) > 0 {
		isMeshConfigured = true
	}

	isMeshConfiguredCached = true
	return isMeshConfigured, nil
}

// The Kiali Home Cluster does not change and can be cached

// kialiControlPlaneClusterCached just indicates whether we have cached the home cluster (because it may be nil)
var kialiControlPlaneClusterCached bool

// kialiControlPlaneCluster holds the cached home cluster (it may be nil when mesh is not configured)
var kialiControlPlaneCluster *Cluster

// Global helper used for test mockup
func SetKialiControlPlaneCluster(cluster *Cluster) {
	kialiControlPlaneClusterCached = true
	kialiControlPlaneCluster = cluster
}

// ResolveKialiControlPlaneCluster tries to resolve the metadata about the cluster where
// Kiali is installed. This assumes that the mesh Control Plane is installed in the
// same cluster as Kiali.
func (in *MeshService) ResolveKialiControlPlaneCluster(r *http.Request) (*Cluster, error) {
	if kialiControlPlaneClusterCached {
		return kialiControlPlaneCluster, nil
	}

	conf := config.Get()

	// The "cluster_id" is set in an environment variable of
	// the "istiod" deployment. Let's try to fetch it.
	myClusterName, gatewayToNamespace, err := kubernetes.ClusterInfoFromIstiod(*conf, in.k8s)
	if err != nil {
		// We didn't find it. This may mean that Istio is not setup with multi-cluster enabled.
		kialiControlPlaneClusterCached = true
		return nil, nil
	}

	// Since this is dealing with the "home" cluster, we assume that the API Endpoint
	// is the one that we are querying. So we get the client configuration and we
	// extract the host, which is our API endpoint.
	restConfig, err := kubernetes.GetConfigForLocalCluster()
	if err != nil {
		return nil, err
	}

	kialiNetwork, err := in.resolveKialiNetwork()
	if err != nil {
		return nil, err
	}

	var ctx context.Context
	if r != nil {
		ctx = r.Context()
	} else {
		ctx = context.Background()
	}
	// Discover ourselves
	kialiInstances := findKialiInNamespace(ctx, os.Getenv("ACTIVE_NAMESPACE"), myClusterName, in.layer)
	if len(kialiInstances) > 0 && r != nil {
		for i := range kialiInstances {
			// If URL is already populated (because of an annotation), trust that because it's user configuration.
			if len(kialiInstances[i].Url) == 0 {
				kialiInstances[i].Url = httputil.GuessKialiURL(r)
			}
		}
	}

	kialiControlPlaneClusterCached = true
	kialiControlPlaneCluster = &Cluster{
		ApiEndpoint:          restConfig.Host,
		IsKialiHome:          true,
		IsGatewayToNamespace: gatewayToNamespace,
		KialiInstances:       kialiInstances,
		Name:                 myClusterName,
		Network:              kialiNetwork,
		SecretName:           "",
	}

	return kialiControlPlaneCluster, nil
}

// convertKialiServiceToInstance converts a svc Service data structure of the
// Kubernetes client to a KialiInstance data structure.
func convertKialiServiceToInstance(svc *core_v1.Service) KialiInstance {
	return KialiInstance{
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
func findKialiInNamespace(ctx context.Context, namespace string, clusterName string, layer *Layer) (instances []KialiInstance) {
	kialiNs, getNsErr := layer.Namespace.GetNamespace(ctx, namespace)
	if getNsErr != nil && !errors.IsNotFound(getNsErr) {
		log.Warningf("Discovery for Kiali instances in cluster [%s] failed: %s", clusterName, getNsErr.Error())
		return
	}
	if kialiNs != nil {
		// The operator and the helm charts set this fixed label. It's also
		// present in the Istio addon manifest of Kiali.
		var services []core_v1.Service
		var getSvcErr error
		if IsNamespaceCached(kialiNs.Name) {
			var tmpSvc []core_v1.Service
			tmpSvc, getSvcErr = kialiCache.GetServices(kialiNs.Name, nil)
			if getSvcErr == nil {
				selector := (labels.Set{"app.kubernetes.io/part-of": "kiali"}).AsSelector()
				services = kubernetes.FilterServicesByLabels(selector, tmpSvc)
			}
		} else {
			k8s, ok := layer.k8sClients[clusterName]
			if !ok {
				log.Warningf("Discovery for Kiali instances in cluster [%s] failed: k8s client not found", clusterName)
				return
			}
			services, getSvcErr = k8s.GetServicesByLabels(kialiNs.Name, "app.kubernetes.io/part-of=kiali")
		}
		if getSvcErr != nil && !errors.IsNotFound(getSvcErr) {
			log.Warningf("Discovery for Kiali instances in cluster [%s] failed when finding the service in [%s] namespace: %s", clusterName, namespace, getSvcErr.Error())
			return
		}

		if len(services) > 0 {
			instances = make([]KialiInstance, 0, len(services))
			for _, d := range services {
				instances = append(instances, convertKialiServiceToInstance(&d))
			}
		}
	}

	return
}

// findRemoteKiali tries to find a Kiali installation in a remote cluster. The API endpoint
// and credentials to access the remote cluster should be specified in the kubeconfig data passed in as parameters.
// The clusterName argument is only for logging purposes.
func (in *MeshService) findRemoteKiali(clusterName string, cluster kubernetes.RemoteSecretClusterListItem, user kubernetes.RemoteSecretUser) (kialiInstances []KialiInstance) {
	restConfig, restConfigErr := kubernetes.GetConfigForRemoteCluster(cluster)
	if restConfigErr != nil {
		log.Errorf("Error using remote creds for cluster [%s]: %v", clusterName, restConfigErr)
		return nil
	}

	restConfig.Timeout = 15 * time.Second
	restConfig.BearerToken = user.User.Token
	remoteClientSet, clientSetErr := in.newRemoteClient(restConfig)
	if clientSetErr != nil {
		log.Errorf("Error creating client set for cluster [%s]: %v", clusterName, clientSetErr)
		return nil
	}

	// - The operator and the helm charts set this well
	//   known "app.kubernetes.io/part-of=kiali" label. It's also present in the
	//   Istio addon manifest of Kiali.
	services, getSvcErr := remoteClientSet.GetClusterServicesByLabels("app.kubernetes.io/part-of=kiali")
	if getSvcErr != nil && !errors.IsNotFound(getSvcErr) {
		log.Warningf("Discovery for Kiali instances in cluster [%s] failed when finding the Kiali service: %s", clusterName, getSvcErr.Error())
		return
	}

	if len(services) > 0 {
		kialiInstances = make([]KialiInstance, 0, len(services))
		for _, d := range services {
			kialiInstances = append(kialiInstances, convertKialiServiceToInstance(&d))
		}
	}

	return
}

// resolveKialiNetwork tries to resolve the logical Istio's network ID of the cluster where
// Kiali is installed. This assumes that the mesh Control Plane is installed in the same
// cluster as Kiali.
func (in *MeshService) resolveKialiNetwork() (string, error) {
	conf := config.Get()

	var istioSidecarConfig *core_v1.ConfigMap
	var err error
	if IsNamespaceCached(conf.IstioNamespace) {
		istioSidecarConfig, err = kialiCache.GetConfigMap(conf.IstioNamespace, conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName)
	} else {
		istioSidecarConfig, err = in.k8s.GetConfigMap(conf.IstioNamespace, conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName)
	}
	if err != nil {
		// Don't return an error, as this may mean that Kiali is not installed along the control plane.
		// This setup is OK, it's just that it's not within our multi-cluster assumptions.
		log.Warningf("Cannot resolve the network ID of the cluster where Kiali is hosted: cannot get the sidecar injector config map :%v", err)
		return "", nil
	} else if istioSidecarConfig == nil {
		// Don't return an error, as this may mean that Kiali is not installed along the control plane.
		// This setup is OK, it's just that it's not within our multi-cluster assumptions.
		log.Warningf("Cannot resolve the network ID of the cluster where Kiali is hosted: sidecar injector config map [%s] does not exist", conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName)
		return "", nil
	}

	parsedConfig := make(map[string]interface{})
	err = json.Unmarshal([]byte(istioSidecarConfig.Data["values"]), &parsedConfig)
	if err != nil {
		// This does not return an error, because it's probably valid that the configmap does not have the "values" key.
		// So, tell that the network wasn't found by returning blank values
		log.Debugf("Cannot resolve the network ID of the cluster where Kiali is hosted: no configuration found for the sidecar injector.")
		return "", err
	}

	globalConfig, ok := parsedConfig["global"]
	if !ok {
		// This does not return an error, because it's probably valid that the configmap does not have the "values.global" key.
		// So, tell that the network wasn't found by returning blank values
		log.Debugf("Cannot resolve the network ID of the cluster where Kiali is hosted: no global configuration found for the sidecar injector.")
		return "", nil
	}

	typedGlobalConfig, ok := globalConfig.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("cannot parse the config map of the Istio sidecar injector")
	}

	networkConfig, ok := typedGlobalConfig["network"]
	if !ok {
		// This does not return an error, because it's valid that the configmap does not have the "values.global.network" key, which most
		// likely means that Istio is not setup for multi-clustering.
		// So, tell that the network wasn't found by returning blank values
		log.Debugf("Cannot resolve the network ID of the cluster where Kiali is hosted: multi-cluster is probably turned off.")
		return "", nil
	}

	typedNetworkConfig, ok := networkConfig.(string)
	if !ok {
		// It's probably invalid that the network id is not a string
		return "", fmt.Errorf("invalid network id: %w", err)
	}

	return typedNetworkConfig, nil
}

// resolveRemoteClustersFromSecrets resolves the metadata about "other" clusters that are
// visible to the adjacent mesh control plane. This assumes that the Istio namespace is
// named the same as in Kiali's Cluster.
func (in *MeshService) resolveRemoteClustersFromSecrets() ([]Cluster, error) {
	// For the ControlPlane to be able to "see" remote clusters, some "remote secrets" need to be in
	// place. These remote secrets contain <kubeconfig files> that the ControlPlane uses to
	// query the remote clusters. Without them, the control plane is not capable of pushing traffic
	// to the other clusters.

	// So, we use these "remote clusters" as the list of clusters in the mesh (excluding the "home cluster" ,
	// which is resolved in ResolveKialiControlPlaneCluster func).
	// Strictly speaking, this list may be incomplete: it's list of visible clusters for a control plane.
	// But, for now, let's use it as the absolute "list of clusters in the mesh (excluding home cluster)".

	remoteClusterInfos, err := kubernetes.GetRemoteClusterInfos()
	if err != nil || len(remoteClusterInfos) == 0 {
		return []Cluster{}, err
	}

	clusters := make([]Cluster, 0, len(remoteClusterInfos))

	// Inspect the secret to extract the cluster_id and api_endpoint of each remote cluster.
	for clusterName, remoteClusterInfo := range remoteClusterInfos {

		meshCluster := Cluster{
			Name:        clusterName,
			ApiEndpoint: remoteClusterInfo.Cluster.Cluster.Server,
			SecretName:  remoteClusterInfo.SecretName,
		}

		networkName := in.resolveNetwork(clusterName, remoteClusterInfo.Cluster, remoteClusterInfo.User)
		if len(networkName) != 0 {
			meshCluster.Network = networkName
		}

		meshCluster.KialiInstances = in.findRemoteKiali(clusterName, remoteClusterInfo.Cluster, remoteClusterInfo.User)
		clusters = append(clusters, meshCluster)
	}

	return clusters, nil
}

// resolveNetwork tries to resolve the NETWORK_ID (as know by the Control Plane) of the
// cluster that can be accessed using the provided kubeconfig data.
// Also, it's assumed that the control plane on the remote cluster is hosted in the same
// namespace as in Kiali's Home cluster. clusterName argument is only for logging purposes.
//
// No errors are returned because we don't want to block processing of other clusters if
// one fails. So, errors are only logged to let processing continue.
func (in *MeshService) resolveNetwork(clusterName string, cluster kubernetes.RemoteSecretClusterListItem, user kubernetes.RemoteSecretUser) string {
	conf := config.Get()

	restConfig, restConfigErr := kubernetes.GetConfigForRemoteCluster(cluster)
	if restConfigErr != nil {
		log.Errorf("Error using remote creds for cluster [%s]: %v", clusterName, restConfigErr)
		return ""
	}

	restConfig.Timeout = 15 * time.Second
	restConfig.BearerToken = user.User.Token
	remoteClientSet, clientSetErr := in.newRemoteClient(restConfig)
	if clientSetErr != nil {
		log.Errorf("Error creating client set for cluster [%s]: %v", clusterName, clientSetErr)
		return ""
	}

	// Let's assume that the istio namespace has the same name on all clusters in the mesh.
	istioNamespace, getNsErr := remoteClientSet.GetNamespace(conf.IstioNamespace)
	if getNsErr != nil {
		log.Warningf("Cannot describe the [%s] namespace on cluster [%s]: %v", conf.IstioNamespace, clusterName, getNsErr)
		return ""
	}

	// For Kiali's control plane, we used the istio sidecar injector config map to fetch the network ID. This
	// approach is probably more accurate, because that's what is injected along the sidecar. However,
	// in remote clusters, we don't have privileges to query config maps, so it's not possible to fetch
	// the sidecar injector config map. However, Istio docs say that the Istio namespace must be labeled with
	// the network ID. We use that label to retrieve the network ID.
	networkName, ok := istioNamespace.Labels["topology.istio.io/network"]
	if !ok {
		log.Debugf("Istio namespace [%s] in cluster [%s] does not have network label", conf.IstioNamespace, clusterName)
		return ""
	}

	return networkName
}

func (in *MeshService) OutboundTrafficPolicy() (*models.OutboundPolicy, error) {
	cfg := config.Get()
	otp := models.OutboundPolicy{Mode: "ALLOW_ANY"}
	var istioConfig *core_v1.ConfigMap
	var err error
	if IsNamespaceCached(cfg.IstioNamespace) {
		istioConfig, err = kialiCache.GetConfigMap(cfg.IstioNamespace, cfg.ExternalServices.Istio.ConfigMapName)
	} else {
		istioConfig, err = in.k8s.GetConfigMap(cfg.IstioNamespace, cfg.ExternalServices.Istio.ConfigMapName)
	}
	if err != nil {
		if errors.IsNotFound(err) {
			err = fmt.Errorf("%w in namespace [%s]", err, cfg.IstioNamespace)
		}
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
	conf := config.Get()

	var istioDeployment *v1.Deployment
	istioDeploymentConfig := conf.ExternalServices.Istio.IstiodDeploymentName
	var err error

	if IsNamespaceCached(conf.IstioNamespace) {
		istioDeployment, err = kialiCache.GetDeployment(conf.IstioNamespace, istioDeploymentConfig)
	} else {
		istioDeployment, err = in.k8s.GetDeployment(conf.IstioNamespace, istioDeploymentConfig)
	}
	if err != nil {
		if errors.IsNotFound(err) {
			log.Debugf("Istiod deployment [%s] not found in namespace [%s]", istioDeploymentConfig, conf.IstioNamespace)
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
	conf := config.Get()
	upgrade := conf.ExternalServices.Istio.IstioCanaryRevision.Upgrade
	current := conf.ExternalServices.Istio.IstioCanaryRevision.Current
	migratedNsList := []string{}
	pendingNsList := []string{}

	// If there is no canary configured, return empty lists
	if upgrade == "" {
		return &models.CanaryUpgradeStatus{MigratedNamespaces: migratedNsList, PendingNamespaces: pendingNsList}, nil
	}

	// Get migrated and pending namespaces
	migratedNss, err := in.k8s.GetNamespaces(fmt.Sprintf("istio.io/rev=%s", upgrade))
	if err != nil {
		return nil, err
	}
	for _, ns := range migratedNss {
		migratedNsList = append(migratedNsList, ns.Name)
	}

	pendingNss, err := in.k8s.GetNamespaces("istio-injection=enabled")
	if err != nil {
		return nil, err
	}
	for _, ns := range pendingNss {
		pendingNsList = append(pendingNsList, ns.Name)
	}

	pendingNss, err = in.k8s.GetNamespaces(fmt.Sprintf("istio.io/rev=%s", current))
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
