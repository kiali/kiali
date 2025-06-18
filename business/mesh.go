package business

import (
	"context"

	istiov1alpha1 "istio.io/api/mesh/v1alpha1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

const (
	IstiodClusterIDEnvKey          = "CLUSTER_ID"
	IstiodExternalEnvKey           = "EXTERNAL_ISTIOD"
	IstiodScopeGatewayEnvKey       = "PILOT_SCOPE_GATEWAY_TO_NAMESPACE"
	IstioInjectionLabel            = "istio-injection"
	IstioControlPlaneClustersLabel = "topology.istio.io/controlPlaneClusters"
)

const (
	AllowAny = "ALLOW_ANY"
)

// MeshService is a support service for retrieving data about the mesh environment
// when Istio is installed with multi-cluster enabled. Prefer initializing this
// type via the NewMeshService function.
type MeshService struct {
	conf           *config.Config
	discovery      istio.MeshDiscovery
	kialiSAClients map[string]kubernetes.ClientInterface
}

// NewMeshService initializes a new MeshService structure with the given k8s clients.
func NewMeshService(
	conf *config.Config,
	discovery istio.MeshDiscovery,
	kialiSAClients map[string]kubernetes.ClientInterface,
) MeshService {
	return MeshService{
		conf:           conf,
		discovery:      discovery,
		kialiSAClients: kialiSAClients,
	}
}

// Checks if a cluster exist
func (in *MeshService) IsValidCluster(cluster string) bool {
	_, exists := in.kialiSAClients[cluster]
	return exists
}

// GetMeshConfig returns the local cluster's mesh config.
// TODO: Remove when validations can read from a specific controlplane.
func (in *MeshService) GetMeshConfig() *models.MeshConfig {
	mesh, err := in.discovery.Mesh(context.TODO())
	if err != nil {
		log.Errorf("Error getting mesh config: %s", err)
		return &models.MeshConfig{MeshConfig: &istiov1alpha1.MeshConfig{}}
	}

	localClusterName := in.conf.KubernetesConfig.ClusterName

	// TODO: Multi-primary support
	for _, controlPlane := range mesh.ControlPlanes {
		if controlPlane.Cluster.Name == localClusterName {
			return controlPlane.MeshConfig
		}
	}

	// If no controlplane found for local cluster, try to return any controlplane's mesh config
	// This is a fallback for cases where the local cluster might not have a controlplane
	if len(mesh.ControlPlanes) > 0 {
		log.Warningf("No controlplane found for local cluster [%s], using mesh config from cluster [%s]",
			localClusterName, mesh.ControlPlanes[0].Cluster.Name)
		return mesh.ControlPlanes[0].MeshConfig
	}

	// This should not happen
	log.Warningf("No controlplanes found while getting mesh config")
	return &models.MeshConfig{MeshConfig: &istiov1alpha1.MeshConfig{}}
}
