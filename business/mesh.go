package business

import (
	"fmt"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
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
	upgrade := in.conf.ExternalServices.Istio.IstioCanaryRevision.Upgrade
	current := in.conf.ExternalServices.Istio.IstioCanaryRevision.Current
	migratedNsList := []string{}
	pendingNsList := []string{}

	// If there is no canary configured, return empty lists
	if upgrade == "" {
		return &models.CanaryUpgradeStatus{MigratedNamespaces: migratedNsList, PendingNamespaces: pendingNsList}, nil
	}

	// Get migrated and pending namespaces
	// TODO: Support multi-primary
	migratedNss, err := in.homeClusterSAClient.GetNamespaces(fmt.Sprintf("istio.io/rev=%s", upgrade))
	if err != nil {
		return nil, err
	}
	for _, ns := range migratedNss {
		migratedNsList = append(migratedNsList, ns.Name)
	}

	pendingNss, err := in.homeClusterSAClient.GetNamespaces(fmt.Sprintf("%s=enabled", in.conf.IstioLabels.InjectionLabelName))
	if err != nil {
		return nil, err
	}
	for _, ns := range pendingNss {
		pendingNsList = append(pendingNsList, ns.Name)
	}

	pendingNss, err = in.homeClusterSAClient.GetNamespaces(fmt.Sprintf("%s=%s", in.conf.IstioLabels.InjectionLabelRev, current))
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
	_, exists := in.kialiSAClients[cluster]
	return exists
}
