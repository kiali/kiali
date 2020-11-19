package business

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

// MeshService is a support service for retrieving data about the mesh environment
// when Istio is installed with multi-cluster enabled.
type MeshService struct {
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
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

	// SecretName is the name of the kubernetes "remote secret" where data of this cluster was resolved
	SecretName string `json:"secretName"`
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

	return &Cluster{
		ApiEndpoint: restConfig.Host,
		IsKialiHome: true,
		Name:        myClusterName,
		SecretName:  "",
	}, nil
}

// resolveRemoteClustersFromSecrets resolves the metadata about "other" clusters that are
// visible to the adjacent mesh control plane. This assumes that the mesh Control Plane is
// installed in the same cluster as Kiali.
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

		clusters = append(clusters, meshCluster)
	}

	return clusters, nil
}
