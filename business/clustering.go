package business

import (
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

// HealthService deals with fetching health from various sources and convert to kiali model
type ClusteringService struct {
	// prom          prometheus.ClientInterface
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

type MeshCluster struct {
	ApiEndpoint   string `json:"apiEndpoint"`
	IsHomeCluster bool   `json:"isHomeCluster"`
	Name          string `json:"name"`
	SecretName    string `json:"secretName"`
}

func (in *ClusteringService) GetMeshClusters() ([]MeshCluster, error) {
	var err error

	remoteClusters, err := in.resolveRemoteClustersFromSecrets()
	if err != nil {
		return nil, err
	}

	myCluster, err := in.resolveMyControlPlaneCluster()
	if err != nil {
		return nil, err
	}

	allClusters := append(remoteClusters, *myCluster)

	return allClusters, nil
}

func (in *ClusteringService) resolveMyControlPlaneCluster() (*MeshCluster, error) {
	conf := config.Get()

	istioDeployment, err := in.k8s.GetDeployment(conf.IstioNamespace, "istiod")
	if err != nil {
		return nil, err
	}

	myClusterName := ""
	// TODO: Safety checks
	for _, v := range istioDeployment.Spec.Template.Spec.Containers[0].Env {
		if v.Name == "CLUSTER_ID" {
			myClusterName = v.Value
		}
	}

	if len(myClusterName) == 0 {
		return nil, nil
	}

	restConfig, err := kubernetes.ConfigClient()
	if err != nil {
		return nil, err
	}

	return &MeshCluster{
		ApiEndpoint: restConfig.Host,
		IsHomeCluster: true,
		Name:        myClusterName,
		SecretName:  "",
	}, nil
}

func (in *ClusteringService) resolveRemoteClustersFromSecrets() ([]MeshCluster, error) {
	conf := config.Get()
	secrets, err := in.k8s.GetSecrets(conf.IstioNamespace, "istio/multiCluster=true")
	if err != nil {
		return []MeshCluster{}, err
	}

	if len(secrets) == 0 {
		return []MeshCluster{}, nil
	}

	clusters := make([]MeshCluster, 0, len(secrets))

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

		meshCluster := MeshCluster{
			Name:        clusterName,
			SecretName:  secret.Name,
			ApiEndpoint: parsedSecret.Clusters[0].Cluster.Server,
		}

		clusters = append(clusters, meshCluster)
	}

	return clusters, nil;
}