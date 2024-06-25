package business

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
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

func (in *MeshService) OutboundTrafficPolicy() (*models.OutboundPolicy, error) {
	mesh, err := in.discovery.Mesh(context.TODO())
	if err != nil {
		return nil, err
	}

	// TODO: Support multi-primary
	policy := &models.OutboundPolicy{}
	for _, cp := range mesh.ControlPlanes {
		if cp.Cluster.IsKialiHome {
			policy = &cp.Config.OutboundTrafficPolicy
			break
		}
	}

	if policy.Mode == "" {
		policy.Mode = AllowAny
	}

	return policy, nil
}

func (in *MeshService) IstiodResourceThresholds() (*models.IstiodThresholds, error) {
	istioDeploymentConfig := in.conf.ExternalServices.Istio.IstiodDeploymentName
	homeClusterCache, err := in.kialiCache.GetKubeCache(in.conf.KubernetesConfig.ClusterName)
	if err != nil {
		return nil, err
	}

	istioDeployment, err := homeClusterCache.GetDeployment(in.conf.IstioNamespace, istioDeploymentConfig)
	if err != nil {
		if errors.IsNotFound(err) {
			log.Debugf("Istiod deployment [%s] not found in namespace [%s]", istioDeploymentConfig, in.conf.IstioNamespace)
		}
		return nil, err
	}

	thresholds := models.IstiodThresholds{}
	deploymentContainers := istioDeployment.Spec.Template.Spec.Containers
	// Assuming that the first container is the istiod container.
	if len(deploymentContainers) > 0 {
		if memoryLimit := deploymentContainers[0].Resources.Limits.Memory(); memoryLimit != nil {
			thresholds.Memory = float64(memoryLimit.ScaledValue(resource.Mega))
		}
		if cpuLimit := deploymentContainers[0].Resources.Limits.Cpu(); cpuLimit != nil {
			thresholds.CPU = cpuLimit.AsApproximateFloat64()
		}
	}

	return &thresholds, nil
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
