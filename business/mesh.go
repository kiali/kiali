package business

import (
	"encoding/json"
	"fmt"
	"time"

	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// MeshService is a support service for retrieving data about the mesh environment
// when Istio is installed with multi-cluster enabled. Prefer initializing this
// type via the NewMeshService function.
type MeshService struct {
	k8s kubernetes.ClientInterface

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

	// Name specifies the CLUSTER_ID as known by the Control Plane
	Name string `json:"name"`

	// Network specifies the logical NETWORK_ID as known by the Control Plane
	Network string `json:"network"`

	// SecretName is the name of the kubernetes "remote secret" where data of this cluster was resolved
	SecretName string `json:"secretName"`
}

// NewMeshService initializes a new MeshService structure with the given k8s client and
// newRemoteClientFunc arguments (see the MeshService struct for details). The newRemoteClientFunc
// can be passed a nil value and a default function will be used.
func NewMeshService(k8s kubernetes.ClientInterface, newRemoteClientFunc func(config *rest.Config) (kubernetes.ClientInterface, error)) MeshService {
	if newRemoteClientFunc == nil {
		newRemoteClientFunc = func(config *rest.Config) (kubernetes.ClientInterface, error) {
			return kubernetes.NewClientFromConfig(config)
		}
	}

	return MeshService{
		k8s:             k8s,
		newRemoteClient: newRemoteClientFunc,
	}
}

// GetClusters resolves the Kubernetes clusters that are hosting the mesh. Resolution
// is done as best-effort using the resources that are present in the cluster.
func (in *MeshService) GetClusters() (clusters []Cluster, errVal error) {
	var err error

	remoteClusters, err := in.resolveRemoteClustersFromSecrets()
	if err != nil {
		return nil, err
	}

	myCluster, err := in.resolveKialiControlPlaneCluster()
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

// resolveKialiControlPlaneCluster tries to resolve the metadata about the cluster where
// Kiali is installed. This assumes that the mesh Control Plane is installed in the
// same cluster as Kiali.
func (in *MeshService) resolveKialiControlPlaneCluster() (*Cluster, error) {
	conf := config.Get()

	// The "cluster_id" is set in an environment variable of
	// the "istiod" deployment. Let's try to fetch it.
	istioDeployment, err := in.k8s.GetDeployment(conf.IstioNamespace, "istiod")
	if err != nil {
		return nil, err
	}

	if istioDeployment == nil {
		return nil, nil
	}

	if len(istioDeployment.Spec.Template.Spec.Containers) == 0 {
		return nil, nil
	}

	myClusterName := ""
	for _, v := range istioDeployment.Spec.Template.Spec.Containers[0].Env {
		if v.Name == "CLUSTER_ID" {
			myClusterName = v.Value
			break
		}
	}

	if len(myClusterName) == 0 {
		// We didn't found it. This may mean that Istio is not setup with multi-cluster enabled.
		return nil, nil
	}

	// Since this is dealing with the "home" cluster, we assume that the API Endpoint
	// is the one that we are querying. So we get the client configuration and we
	// extract the host, which is our API endpoint.
	restConfig, err := kubernetes.ConfigClient()
	if err != nil {
		return nil, err
	}

	kialiNetwork, err := in.resolveKialiNetwork()
	if err != nil {
		return nil, err
	}

	return &Cluster{
		ApiEndpoint: restConfig.Host,
		IsKialiHome: true,
		Name:        myClusterName,
		Network:     kialiNetwork,
		SecretName:  "",
	}, nil
}

// resolveKialiNetwork tries to resolve the logical Istio's network ID of the cluster where
// Kiali is installed. This assumes that the mesh Control Plane is installed in the same
// cluster as Kiali.
func (in *MeshService) resolveKialiNetwork() (string, error) {
	conf := config.Get()

	istioSidecarConfig, err := in.k8s.GetConfigMap(conf.IstioNamespace, "istio-sidecar-injector")
	if err != nil {
		// Don't return an error, as this may mean that Kiali is not installed along the control plane.
		// This setup is OK, it's just that it's not within our multi-cluster assumptions.
		log.Warningf("Cannot resolve the network ID of the cluster where Kiali is hosted: cannot get the sidecar injector config map :%v", err)
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
	conf := config.Get()

	// For the ControlPlane to be able to "see" remote clusters, some "remote secrets" need to be in
	// place. These remote secrets contain <kubeconfig files> that the ControlPlane uses to
	// query the remote clusters. Without them, the control plane is not capable of pushing traffic
	// to the other clusters.

	// So, we use these "remote clusters" as the list of clusters in the mesh (excluding the "home cluster" ,
	// which is resolved in resolveKialiControlPlaneCluster func).
	// Strictly speaking, this list may be incomplete: it's list of visible clusters for a control plane.
	// But, for now, let's use it as the absolute "list of clusters in the mesh (excluding home cluster)".

	// "Remote secrets" are created using the command `istioctl x create-remote-secret` which
	// labels the secrets with istio/multiCluster=true. Let's use that label to fetch the secrets of interest.
	secrets, err := in.k8s.GetSecrets(conf.IstioNamespace, "istio/multiCluster=true")
	if err != nil {
		return []Cluster{}, err
	}

	if len(secrets) == 0 {
		return []Cluster{}, nil
	}

	clusters := make([]Cluster, 0, len(secrets))

	// Inspect the secret to extract the cluster_id and api_endpoint of each remote cluster.
	for _, secret := range secrets {
		clusterName, ok := secret.Annotations["networking.istio.io/cluster"]
		if !ok {
			clusterName = "unknown"
		}

		kubeconfigFile, ok := secret.Data[clusterName]
		if !ok {
			// We are assuming that the cluster name annotation is also indicating which
			// key of the secret should contain the kubeconfig file to access the remote cluster.
			// If there is no such key in the secret, ignore this secret.
			continue
		}

		parsedSecret, parseErr := kubernetes.ParseRemoteSecretBytes(kubeconfigFile)
		if parseErr != nil {
			continue
		}

		if len(parsedSecret.Clusters) != 1 {
			continue
		}

		meshCluster := Cluster{
			Name:        clusterName,
			SecretName:  secret.Name,
			ApiEndpoint: parsedSecret.Clusters[0].Cluster.Server,
		}

		networkName := in.resolveNetwork(clusterName, parsedSecret)
		if len(networkName) != 0 {
			meshCluster.Network = networkName
		}

		clusters = append(clusters, meshCluster)
	}

	return clusters, nil
}

// resolveNetwork tries to resolve the NETWORK_ID (as know by the Control Plane) of the
// cluster that can be accessed using the provided kubeconfig file. This kubeconfig file
// is assumed to be generated by using the `istioctl x create-remote-secret` command.
// Also, it's assumed that the control plane on the remote cluster is hosted in the same
// namespace as in Kiali's Home cluster. clusterName argument is only for logging purposes.
//
// No errors are returned because we don't want to block processing of other clusters if
// one fails. So, errors are only logged to let processing continue.
func (in *MeshService) resolveNetwork(clusterName string, kubeconfig *kubernetes.RemoteSecret) string {
	conf := config.Get()

	restConfig, restConfigErr := kubernetes.UseRemoteCreds(kubeconfig)
	if restConfigErr != nil {
		log.Errorf("Error using remote creds: %v", restConfigErr)
		return ""
	}

	restConfig.Timeout = 15 * time.Second
	restConfig.BearerToken = kubeconfig.Users[0].User.Token
	clientSet, clientSetErr := in.newRemoteClient(restConfig)
	if clientSetErr != nil {
		log.Errorf("Error creating client set: %v", clientSetErr)
		return ""
	}

	// Let's assume that the istio namespace has the same name on all clusters in the mesh.
	istioNamespace, getNsErr := clientSet.GetNamespace(conf.IstioNamespace)
	if getNsErr != nil {
		log.Warningf("Cannot describe the '%s' namespace on cluster '%s': %v", conf.IstioNamespace, clusterName, getNsErr)
		return ""
	}

	// For Kiali's control plane, we used the istio sidecar injector config map to fetch the network ID. This
	// approach is probably more accurate, because that's what is injected along the sidecar. However,
	// in remote clusters, we don't have privileges to query config maps, so it's not possible to fetch
	// the sidecar injector config map. However, Istio docs say that the Istio namespace must be labeled with
	// the network ID. We use that label to retrieve the network ID.
	networkName, ok := istioNamespace.Labels["topology.istio.io/network"]
	if !ok {
		log.Debugf("Istio namespace '%s' in cluster '%s' does not have network label", conf.IstioNamespace, clusterName)
		return ""
	}

	return networkName
}
