package business

import (
	"context"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
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

// IsControlPlane is just a convenience method that calls MeshDiscovery.IsControlPlane()
func (in *MeshService) IsControlPlane(ctx context.Context, cluster, namespace string) bool {
	return in.discovery.IsControlPlane(ctx, cluster, namespace)
}

// GetMeshConfigForNamespace returns the mesh config for the control plane that manages the given
// namespace in the cluster.
func (in *MeshService) GetMeshConfigForNamespace(cluster, namespace string) (*models.MeshConfig, error) {
	mesh, err := in.discovery.Mesh(context.TODO())
	if err != nil {
		return nil, err
	}
	cp, err := mesh.ControlPlaneForNamespace(cluster, namespace)
	if err != nil {
		return nil, err
	}
	return cp.MeshConfig, nil
}

func (in *MeshService) Clusters() []models.KubeCluster {
	return in.discovery.Clusters()
}
