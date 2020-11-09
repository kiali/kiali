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
	ApiEndpoint string `json:"api_endpoint"`
	Name        string `json:"name"`
	SecretName  string `json:"secret_name"`
}

func (in *ClusteringService) GetMeshClusters() ([]MeshCluster, error) {
	return in.resolveRemoteClustersFromSecrets()
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