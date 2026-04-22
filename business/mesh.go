package business

import (
	"context"

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

// GetMesh returns the cached mesh. It wraps discovery.Mesh() so callers outside
// the business package can fetch the mesh once and reuse it without repeated
// mutex acquisition.
func (in *MeshService) GetMesh(ctx context.Context) (*models.Mesh, error) {
	return in.discovery.Mesh(ctx)
}

func (in *MeshService) Clusters() []models.KubeCluster {
	return in.discovery.Clusters()
}

// resolveIdentityDomainWithLayer fetches the mesh from the given layer's discovery
// and resolves the effective identity domain for the given cluster.
// layer may be nil (e.g. in unit tests); discovery is extracted safely.
func resolveIdentityDomainWithLayer(ctx context.Context, layer *Layer, cluster, configured string) string {
	var disc istio.MeshDiscovery
	if layer != nil {
		disc = layer.Mesh.discovery
	}
	return resolveIdentityDomainWithDiscovery(ctx, disc, cluster, configured)
}

// resolveIdentityDomainWithDiscovery is the low-level variant that accepts
// a MeshDiscovery directly, for services that hold their own discovery
// reference (TLSService, ProxyStatusService).
func resolveIdentityDomainWithDiscovery(ctx context.Context, discovery istio.MeshDiscovery, cluster, configured string) string {
	var mesh *models.Mesh
	if discovery != nil {
		var err error
		mesh, err = discovery.Mesh(ctx)
		if err != nil {
			log.Debugf("Failed to fetch mesh for identity domain resolution on cluster [%s]: %v", cluster, err)
		}
	}
	return ResolveClusterIdentityDomain(mesh, cluster, configured)
}

// ResolveClusterIdentityDomain extracts the trust domain for a specific cluster
// from the mesh and returns the effective identity domain. This is the single
// implementation of the control-plane lookup that all business services share.
func ResolveClusterIdentityDomain(mesh *models.Mesh, cluster, configured string) string {
	var trustDomain string
	if mesh != nil {
		for i := range mesh.ControlPlanes {
			cp := &mesh.ControlPlanes[i]
			if cp.Cluster != nil && cp.Cluster.Name == cluster && cp.MeshConfig != nil {
				trustDomain = cp.MeshConfig.TrustDomain
				break
			}
		}
	}
	return config.ResolveIdentityDomain(configured, trustDomain)
}
