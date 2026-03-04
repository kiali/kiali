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

// IsControlPlane is just a convenience method that calls MeshDiscovery.IsControlPlane()
func (in *MeshService) IsControlPlane(ctx context.Context, cluster, namespace string) bool {
	return in.discovery.IsControlPlane(ctx, cluster, namespace)
}

// This returns the home cluster's mesh config, if possible. For external
// Kiali deployments it returns the mesh config of a random control plane.
// If no mesh config can be found, an empty mesh config is returned.
// Prefer GetMeshConfigForNamespace when cluster and namespace are available (multi-primary).
func (in *MeshService) GetMeshConfig() *models.MeshConfig {
	mesh, err := in.discovery.Mesh(context.TODO())
	if err != nil {
		log.Errorf("Error getting mesh config: %s", err)
		return &models.MeshConfig{MeshConfig: &istiov1alpha1.MeshConfig{}}
	}

	for _, controlPlane := range mesh.ControlPlanes {
		if controlPlane.Cluster != nil && controlPlane.Cluster.IsKialiHome {
			return controlPlane.MeshConfig
		}
	}
	if len(mesh.ControlPlanes) > 0 {
		return mesh.ControlPlanes[0].MeshConfig
	}

	return &models.MeshConfig{MeshConfig: &istiov1alpha1.MeshConfig{}}
}

// GetMeshConfigForNamespace returns the mesh config for the control plane that manages the given
// namespace in the cluster. Use this instead of GetMeshConfig() when validating or filtering
// resources for a specific namespace (multi-primary support).
func (in *MeshService) GetMeshConfigForNamespace(cluster, namespace string) *models.MeshConfig {
	mesh, err := in.discovery.Mesh(context.TODO())
	if err != nil {
		log.Errorf("Error getting mesh config for namespace: %s", err)
		return &models.MeshConfig{MeshConfig: &istiov1alpha1.MeshConfig{}}
	}
	cp := mesh.ControlPlaneForNamespace(cluster, namespace)
	if cp != nil && cp.MeshConfig != nil {
		return cp.MeshConfig
	}
	return in.GetMeshConfig()
}

func (in *MeshService) Clusters() []models.KubeCluster {
	return in.discovery.Clusters()
}
