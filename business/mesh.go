package business

import (
	"fmt"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/models"
	"golang.org/x/exp/maps"
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

// TODO: move meshDiscovery here.

// MeshService is a support service for retrieving data about the mesh environment
// when Istio is installed with multi-cluster enabled. Prefer initializing this
// type via the NewMeshService function.
type MeshService struct {
	conf                *config.Config
	discovery           meshDiscovery
	homeClusterSAClient kubernetes.ClientInterface
	kialiCache          cache.KialiCache
	kialiSAClients      map[string]kubernetes.ClientInterface
	namespaceService    NamespaceService
}

// NewMeshService initializes a new MeshService structure with the given k8s clients.
func NewMeshService(
	kialiSAClients map[string]kubernetes.ClientInterface,
	cache cache.KialiCache,
	namespaceService NamespaceService,
	conf *config.Config,
	discovery meshDiscovery,
) MeshService {
	return MeshService{
		conf:                conf,
		discovery:           discovery,
		homeClusterSAClient: kialiSAClients[conf.KubernetesConfig.ClusterName],
		kialiCache:          cache,
		kialiSAClients:      kialiSAClients,
		namespaceService:    namespaceService,
	}
}

func (in *MeshService) CanaryUpgradeStatus() (*models.CanaryUpgradeStatus, error) {
	kubeCache, err := in.kialiCache.GetKubeCache(in.conf.KubernetesConfig.ClusterName)
	if err != nil {
		return nil, err
	}

	revisions, err := istio.GetHealthyIstiodRevisions(kubeCache, in.conf.IstioNamespace)
	if err != nil {
		return nil, err
	}
	namespacesPerRevision := make(map[string][]string)

	if len(revisions) == 1 {
		return &models.CanaryUpgradeStatus{
			NamespacesPerRevision: namespacesPerRevision,
		}, nil
	}

	for _, revision := range revisions {
		nsList := make(map[string]bool)
		// Get namespaces for revision
		// TODO: Support multi-primary
		nss, err := in.homeClusterSAClient.GetNamespaces(fmt.Sprintf("%s=%s", in.conf.IstioLabels.InjectionLabelRev, revision))
		if err != nil {
			return nil, err
		}
		for _, ns := range nss {
			nsList[ns.Name] = true
		}

		// include not revision labeled namespaces into default ones
		if revision == istio.DefaultRevisionLabel {
			pendingNss, err := in.homeClusterSAClient.GetNamespaces(fmt.Sprintf("%s=enabled", in.conf.IstioLabels.InjectionLabelName))
			if err != nil {
				return nil, err
			}
			for _, ns := range pendingNss {
				nsList[ns.Name] = true
			}
		}
		namespacesPerRevision[revision] = maps.Keys(nsList)
	}
	status := &models.CanaryUpgradeStatus{
		NamespacesPerRevision: namespacesPerRevision,
	}

	return status, nil
}

// Checks if a cluster exist
func (in *MeshService) IsValidCluster(cluster string) bool {
	_, exists := in.kialiSAClients[cluster]
	return exists
}
