package business

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/business/references"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus/internalmetrics"
	"github.com/kiali/kiali/util/sliceutil"
)

func NewValidationsService(
	istioConfig *IstioConfigService,
	kialiCache cache.KialiCache,
	meshService *MeshService,
	namespaceService *NamespaceService,
	service *SvcService,
	userClients map[string]kubernetes.ClientInterface,
	workloadService *WorkloadService,
) IstioValidationsService {
	return IstioValidationsService{
		istioConfig: istioConfig,
		kialiCache:  kialiCache,
		mesh:        meshService,
		namespace:   namespaceService,
		service:     service,
		userClients: userClients,
		workload:    workloadService,
	}
}

type IstioValidationsService struct {
	istioConfig *IstioConfigService
	kialiCache  cache.KialiCache
	mesh        *MeshService
	namespace   *NamespaceService
	service     *SvcService
	userClients map[string]kubernetes.ClientInterface
	workload    *WorkloadService
}

type ReferenceChecker interface {
	References() models.IstioReferencesMap
}

func validationsForCluster(validations models.IstioValidations, cluster string) models.IstioValidations {
	clusterValidations := models.IstioValidations{}
	for validationKey, validation := range validations {
		if validationKey.Cluster == cluster {
			clusterValidations[validationKey] = validation
		}
	}
	return clusterValidations
}

func (in *IstioValidationsService) GetValidations(ctx context.Context, cluster string) (models.IstioValidations, error) {
	return validationsForCluster(in.kialiCache.Validations().Items(), cluster), nil
}

func (in *IstioValidationsService) GetValidationsForNamespace(ctx context.Context, cluster, namespace string) (models.IstioValidations, error) {
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, err
	}

	namespaceValidations := models.IstioValidations{}
	for validationKey, validation := range in.kialiCache.Validations().Items() {
		if validationKey.Namespace == namespace && validationKey.Cluster == cluster {
			namespaceValidations[validationKey] = validation
		}
	}
	return namespaceValidations, nil
}

func (in *IstioValidationsService) GetValidationsForService(ctx context.Context, cluster, namespace, service string) (models.IstioValidations, error) {
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, err
	}

	// Ensure the service exists
	_, err := in.service.GetService(ctx, cluster, namespace, service)
	if err != nil {
		return nil, fmt.Errorf("service [namespace: %s] [name: %s] doesn't exist for Validations", namespace, service)
	}

	return validationsForCluster(in.kialiCache.Validations().Items(), cluster).FilterBySingleType(schema.GroupVersionKind{Group: "", Version: "", Kind: "service"}, service), nil
}

func (in *IstioValidationsService) GetValidationsForWorkload(ctx context.Context, cluster, namespace, workload string) (models.IstioValidations, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace param should be set for Validations in cluster %s", cluster)
	}
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, err
	}

	return validationsForCluster(in.kialiCache.Validations().Items(), cluster).FilterBySingleType(schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"}, workload), nil
}

type validationNamespaceInfo struct {
	istioConfig *models.IstioConfigList //
	mtlsDetails *kubernetes.MTLSDetails // mtls info for the namespace
	namespace   *models.Namespace       // the [cluster] namespace being validated
	rbacDetails *kubernetes.RBACDetails //
}

type validationClusterInfo struct {
	cluster          string                        // the cluster being validated
	istioConfig      *models.IstioConfigList       // config for the cluster (all namespaces)
	registryServices []*kubernetes.RegistryService // registry services for the cluster (all namespaces)
}

// validationInfo holds information gathered during a single validation reconciliation. It is used to hold information that
// may otherwise need to be recalculated.
type validationInfo struct {
	// cross-cluster information
	clusters []string                                  // all clusters being validated
	mesh     *models.Mesh                              // control plane info
	nsMap    map[string][]models.Namespace             // cluster => namespaces
	saMap    map[string][]string                       // cluster => serviceAccounts
	wlMap    map[string]map[string]models.WorkloadList // cluster => namespace => WorkloadList, all workloads

	// clusterInfo is reset for each cluster being validated
	clusterInfo *validationClusterInfo
	// nsInfo is reset for each namespace being validated (for the cluster being validated)
	nsInfo *validationNamespaceInfo
}

// NewValidationInfo returns an initialized validationInfo structure. This is not a "free" call, the initial structure is
// populated with cross-cluster information to be used during the validation. This structure should then be used throughout
// a validation pass to hold "computed" information, and avoid performing the same work multiple times, when evaluating
// different clusters, or different namespaces for a cluster. Initially unused structures/maps will be set to nil, and
// arrays will be initialized to empty.
func (in *IstioValidationsService) NewValidationInfo(ctx context.Context, clusters []string) (*validationInfo, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "newValidationInfo",
		observability.Attribute("package", "business"),
	)
	defer end()

	vInfo := validationInfo{
		clusters: clusters,
		nsMap:    map[string][]models.Namespace{},
		saMap:    map[string][]string{},
		wlMap:    map[string]map[string]models.WorkloadList{},
	}
	mesh, err := in.mesh.discovery.Mesh(ctx)
	if err != nil {
		return nil, err
	}
	vInfo.mesh = mesh

	for _, cluster := range clusters {
		workloads, err := in.workload.GetAllWorkloads(ctx, cluster, "")
		if err != nil {
			return nil, err
		}
		vInfo.wlMap[cluster] = toWorkloadMap(workloads)

		namespaces, err := in.namespace.GetClusterNamespaces(ctx, cluster)
		if err != nil {
			return nil, err
		}
		vInfo.nsMap[cluster] = namespaces

		vInfo.saMap[cluster] = in.getServiceAccounts(namespaces, vInfo.wlMap[cluster])
	}

	return &vInfo, nil
}

// Validate runs a full validation on all objects. It returns an IstioValidations object with all the checks found when running all
// the enabled checkers.
func (in *IstioValidationsService) Validate(ctx context.Context, cluster string, vInfo *validationInfo) (models.IstioValidations, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "getValidations",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
	)
	defer end()

	timer := internalmetrics.GetValidationProcessingTimePrometheusTimer("", "")
	defer timer.ObserveDuration()

	validations := models.IstioValidations{}
	vInfo.clusterInfo = &validationClusterInfo{
		cluster: cluster,
	}

	if registryStatus := in.kialiCache.GetRegistryStatus(cluster); registryStatus != nil {
		vInfo.clusterInfo.registryServices = registryStatus.Services
	}

	// grab all config for the cluster
	criteria := IstioConfigCriteria{
		IncludeAuthorizationPolicies:  true,
		IncludeDestinationRules:       true,
		IncludeGateways:               true,
		IncludeK8sGateways:            true,
		IncludeK8sGRPCRoutes:          true,
		IncludeK8sHTTPRoutes:          true,
		IncludeK8sReferenceGrants:     true,
		IncludePeerAuthentications:    true,
		IncludeRequestAuthentications: true,
		IncludeServiceEntries:         true,
		IncludeSidecars:               true,
		IncludeVirtualServices:        true,
		IncludeWorkloadEntries:        true,
		IncludeWorkloadGroups:         true,
	}
	istioConfigList, err := in.istioConfig.GetIstioConfigListForCluster(ctx, cluster, meta_v1.NamespaceAll, criteria)
	if err != nil {
		return nil, err
	}
	vInfo.clusterInfo.istioConfig = istioConfigList

	for _, namespace := range vInfo.nsMap[cluster] {
		vInfo.nsInfo = &validationNamespaceInfo{
			namespace: &namespace,
		}

		err := in.setNamespaceIstioConfig(vInfo)
		if err != nil {
			return nil, err
		}

		if err := in.setNonLocalMTLSConfig(vInfo); err != nil {
			return nil, err
		}

		objectCheckers := in.getAllObjectCheckers(vInfo)

		// Get group validations for same kind istio objects
		validations.MergeValidations(runObjectCheckers(objectCheckers))
	}

	return validations, nil
}

// toWorkloadMap takes a list of workloads from different namespaces, and returns a map: namespace => WorkloadList
func toWorkloadMap(workloads models.Workloads) map[string]models.WorkloadList {
	workloadMap := map[string]models.WorkloadList{}

	for _, w := range workloads {
		wItem := &models.WorkloadListItem{Health: *models.EmptyWorkloadHealth()}
		wItem.ParseWorkload(w)
		workloadList, ok := workloadMap[w.Namespace]
		if ok {
			workloadList.Workloads = append(workloadList.Workloads, *wItem)
		} else {
			workloadList = models.WorkloadList{
				Namespace: w.Namespace,
				Workloads: []models.WorkloadListItem{*wItem},
			}
		}
		workloadMap[w.Namespace] = workloadList
	}
	return workloadMap
}

// getAllObjectCheckers returns all of the checkers to be executed for a full validation.
// TODO: we may want to to pass vInfo into all of these, if the checkers themselves are re-computing information
func (in *IstioValidationsService) getAllObjectCheckers(vInfo *validationInfo) []checkers.ObjectChecker {
	cluster := vInfo.clusterInfo.cluster
	namespaces := vInfo.nsMap[cluster]
	istioConfigList := vInfo.nsInfo.istioConfig
	workloadsPerNamespace := vInfo.wlMap[cluster]
	mtlsDetails := vInfo.nsInfo.mtlsDetails
	rbacDetails := vInfo.nsInfo.rbacDetails
	registryServices := vInfo.clusterInfo.registryServices
	return []checkers.ObjectChecker{
		checkers.AuthorizationPolicyChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, WorkloadsPerNamespace: workloadsPerNamespace, MtlsDetails: *mtlsDetails, VirtualServices: istioConfigList.VirtualServices, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny(vInfo.mesh), Cluster: cluster, ServiceAccounts: vInfo.saMap},
		checkers.DestinationRulesChecker{Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, MTLSDetails: *mtlsDetails, ServiceEntries: istioConfigList.ServiceEntries, Cluster: cluster},
		checkers.GatewayChecker{Gateways: istioConfigList.Gateways, WorkloadsPerNamespace: workloadsPerNamespace, IsGatewayToNamespace: in.isGatewayToNamespace(vInfo.mesh), Cluster: cluster},
		checkers.K8sGatewayChecker{K8sGateways: istioConfigList.K8sGateways, Cluster: cluster, GatewayClasses: in.istioConfig.GatewayAPIClasses(cluster)},
		checkers.K8sGRPCRouteChecker{K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes, K8sGateways: istioConfigList.K8sGateways, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, RegistryServices: registryServices, Cluster: cluster},
		checkers.K8sHTTPRouteChecker{K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sGateways: istioConfigList.K8sGateways, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, RegistryServices: registryServices, Cluster: cluster},
		checkers.K8sReferenceGrantChecker{K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, Cluster: cluster},
		checkers.NoServiceChecker{Namespaces: namespaces, IstioConfigList: istioConfigList, WorkloadsPerNamespace: workloadsPerNamespace, AuthorizationDetails: rbacDetails, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny(vInfo.mesh), Cluster: cluster},
		checkers.PeerAuthenticationChecker{PeerAuthentications: mtlsDetails.PeerAuthentications, MTLSDetails: *mtlsDetails, WorkloadsPerNamespace: workloadsPerNamespace, Cluster: cluster},
		checkers.RequestAuthenticationChecker{RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadsPerNamespace: workloadsPerNamespace, Cluster: cluster},
		checkers.ServiceEntryChecker{ServiceEntries: istioConfigList.ServiceEntries, Namespaces: namespaces, WorkloadEntries: istioConfigList.WorkloadEntries, Cluster: cluster},
		checkers.SidecarChecker{Sidecars: istioConfigList.Sidecars, Namespaces: namespaces, WorkloadsPerNamespace: workloadsPerNamespace, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices, Cluster: cluster},
		checkers.TelemetryChecker{Telemetries: istioConfigList.Telemetries, Namespaces: namespaces},
		checkers.VirtualServiceChecker{Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules, Cluster: cluster},
		checkers.WasmPluginChecker{WasmPlugins: istioConfigList.WasmPlugins, Namespaces: namespaces},
		checkers.WorkloadChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, WorkloadsPerNamespace: workloadsPerNamespace, Cluster: cluster},
		checkers.WorkloadGroupsChecker{Cluster: cluster, WorkloadGroups: istioConfigList.WorkloadGroups, ServiceAccounts: vInfo.saMap},
	}
}

// ValidateIstioObject validates a single Istio object of the given type with the given name found in the given namespace. Note that
// even validating a single object requires a fair amount of information, as it may interact with many other configs.
func (in *IstioValidationsService) ValidateIstioObject(ctx context.Context, cluster, namespace string, objectGVK schema.GroupVersionKind, object string) (models.IstioValidations, models.IstioReferencesMap, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetIstioObjectValidations",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", "cluster"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("objectGVK", objectGVK.String()),
		observability.Attribute("object", object),
	)
	defer end()

	istioReferences := models.IstioReferencesMap{}

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	ns, err := in.namespace.GetClusterNamespace(ctx, namespace, cluster)
	if err != nil {
		return nil, istioReferences, err
	}

	// time this function execution so we can capture how long it takes to fully validate this istio object
	timer := internalmetrics.GetSingleValidationProcessingTimePrometheusTimer(namespace, objectGVK.String(), object)
	defer timer.ObserveDuration()

	// validating a single object is not particularly efficient, it still requires a lot of up-front setup
	vInfo, err := in.NewValidationInfo(ctx, in.namespace.GetClusterList())
	if err != nil {
		return nil, models.IstioReferencesMap{}, err
	}

	vInfo.clusterInfo = &validationClusterInfo{
		cluster: cluster,
	}
	vInfo.nsInfo = &validationNamespaceInfo{
		namespace:   ns,
		mtlsDetails: &kubernetes.MTLSDetails{},
	}

	criteria := IstioConfigCriteria{
		IncludeAuthorizationPolicies:  true,
		IncludeDestinationRules:       true,
		IncludeGateways:               true,
		IncludeK8sGateways:            true,
		IncludeK8sGRPCRoutes:          true,
		IncludeK8sHTTPRoutes:          true,
		IncludeK8sReferenceGrants:     true,
		IncludePeerAuthentications:    true,
		IncludeRequestAuthentications: true,
		IncludeServiceEntries:         true,
		IncludeSidecars:               true,
		IncludeVirtualServices:        true,
		IncludeWorkloadEntries:        true,
		IncludeWorkloadGroups:         true,
	}
	clusterIstioConfigList, err := in.istioConfig.GetIstioConfigListForCluster(ctx, cluster, meta_v1.NamespaceAll, criteria)
	if err != nil {
		return nil, istioReferences, err
	}
	vInfo.clusterInfo.istioConfig = clusterIstioConfigList

	if registryStatus := in.kialiCache.GetRegistryStatus(cluster); registryStatus != nil {
		vInfo.clusterInfo.registryServices = registryStatus.Services
	}

	if err := in.setNamespaceIstioConfig(vInfo); err != nil {
		return nil, nil, err
	}

	if err := in.setNonLocalMTLSConfig(vInfo); err != nil {
		return nil, nil, err
	}

	namespaces := vInfo.nsMap[cluster]
	istioConfigList := vInfo.nsInfo.istioConfig
	workloadsPerNamespace := vInfo.wlMap[cluster]
	mtlsDetails := vInfo.nsInfo.mtlsDetails
	rbacDetails := vInfo.nsInfo.rbacDetails
	registryServices := vInfo.clusterInfo.registryServices
	var objectCheckers []checkers.ObjectChecker
	var referenceChecker ReferenceChecker

	noServiceChecker := checkers.NoServiceChecker{Cluster: cluster, Namespaces: namespaces, IstioConfigList: istioConfigList, WorkloadsPerNamespace: workloadsPerNamespace, AuthorizationDetails: rbacDetails, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny(vInfo.mesh)}

	switch objectGVK {
	case kubernetes.Gateways:
		objectCheckers = []checkers.ObjectChecker{
			checkers.GatewayChecker{Cluster: cluster, Gateways: istioConfigList.Gateways, WorkloadsPerNamespace: workloadsPerNamespace, IsGatewayToNamespace: in.isGatewayToNamespace(vInfo.mesh)},
		}
		referenceChecker = references.GatewayReferences{Gateways: istioConfigList.Gateways, VirtualServices: istioConfigList.VirtualServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.VirtualServices:
		virtualServiceChecker := checkers.VirtualServiceChecker{Cluster: cluster, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules}
		objectCheckers = []checkers.ObjectChecker{noServiceChecker, virtualServiceChecker}
		referenceChecker = references.VirtualServiceReferences{Namespace: namespace, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules, AuthorizationPolicies: rbacDetails.AuthorizationPolicies}
	case kubernetes.DestinationRules:
		destinationRulesChecker := checkers.DestinationRulesChecker{Cluster: cluster, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, MTLSDetails: *mtlsDetails, ServiceEntries: istioConfigList.ServiceEntries}
		objectCheckers = []checkers.ObjectChecker{noServiceChecker, destinationRulesChecker}
		referenceChecker = references.DestinationRuleReferences{Namespace: namespace, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, VirtualServices: istioConfigList.VirtualServices, WorkloadsPerNamespace: workloadsPerNamespace, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices}
	case kubernetes.ServiceEntries:
		serviceEntryChecker := checkers.ServiceEntryChecker{Cluster: cluster, ServiceEntries: istioConfigList.ServiceEntries, Namespaces: namespaces, WorkloadEntries: istioConfigList.WorkloadEntries}
		objectCheckers = []checkers.ObjectChecker{serviceEntryChecker}
		referenceChecker = references.ServiceEntryReferences{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespace: namespace, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, ServiceEntries: istioConfigList.ServiceEntries, Sidecars: istioConfigList.Sidecars, RegistryServices: registryServices}
	case kubernetes.Sidecars:
		sidecarsChecker := checkers.SidecarChecker{
			Cluster: cluster, Sidecars: istioConfigList.Sidecars, Namespaces: namespaces,
			WorkloadsPerNamespace: workloadsPerNamespace, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices,
		}
		objectCheckers = []checkers.ObjectChecker{sidecarsChecker}
		referenceChecker = references.SidecarReferences{Sidecars: istioConfigList.Sidecars, Namespace: namespace, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.AuthorizationPolicies:
		authPoliciesChecker := checkers.AuthorizationPolicyChecker{
			AuthorizationPolicies: rbacDetails.AuthorizationPolicies,
			Cluster:               cluster, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, ServiceAccounts: vInfo.saMap,
			WorkloadsPerNamespace: workloadsPerNamespace, MtlsDetails: *mtlsDetails, VirtualServices: istioConfigList.VirtualServices, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny(vInfo.mesh),
		}
		objectCheckers = []checkers.ObjectChecker{authPoliciesChecker}
		referenceChecker = references.AuthorizationPolicyReferences{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespace: namespace, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.PeerAuthentications:
		// Validations on PeerAuthentications
		peerAuthnChecker := checkers.PeerAuthenticationChecker{Cluster: cluster, PeerAuthentications: mtlsDetails.PeerAuthentications, MTLSDetails: *mtlsDetails, WorkloadsPerNamespace: workloadsPerNamespace}
		objectCheckers = []checkers.ObjectChecker{peerAuthnChecker}
		referenceChecker = references.PeerAuthReferences{MTLSDetails: *mtlsDetails, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.WorkloadEntries:
		// Validation on WorkloadEntries are not yet in place
		referenceChecker = references.WorkloadEntryReferences{WorkloadGroups: istioConfigList.WorkloadGroups, WorkloadEntries: istioConfigList.WorkloadEntries}
	case kubernetes.WorkloadGroups:
		wlGroupsChecker := checkers.WorkloadGroupsChecker{
			Cluster: cluster, ServiceAccounts: vInfo.saMap, WorkloadGroups: istioConfigList.WorkloadGroups,
		}
		objectCheckers = []checkers.ObjectChecker{wlGroupsChecker}
		referenceChecker = references.WorkloadGroupReferences{WorkloadGroups: istioConfigList.WorkloadGroups, WorkloadEntries: istioConfigList.WorkloadEntries, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.RequestAuthentications:
		// Validation on RequestAuthentications are not yet in place
		requestAuthnChecker := checkers.RequestAuthenticationChecker{Cluster: cluster, RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadsPerNamespace: workloadsPerNamespace}
		objectCheckers = []checkers.ObjectChecker{requestAuthnChecker}
	case kubernetes.EnvoyFilters:
		// Validation on EnvoyFilters are not yet in place
	case kubernetes.WasmPlugins:
		// Validation on WasmPlugins is not expected
	case kubernetes.Telemetries:
		// Validation on Telemetries is not expected
	case kubernetes.K8sGateways:
		// Validations on K8sGateways
		objectCheckers = []checkers.ObjectChecker{
			checkers.K8sGatewayChecker{Cluster: cluster, K8sGateways: istioConfigList.K8sGateways, GatewayClasses: in.istioConfig.GatewayAPIClasses(cluster)},
		}
		referenceChecker = references.K8sGatewayReferences{K8sGateways: istioConfigList.K8sGateways, K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.K8sGRPCRoutes:
		grpcRouteChecker := checkers.K8sGRPCRouteChecker{Cluster: cluster, K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes, K8sGateways: istioConfigList.K8sGateways, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, RegistryServices: registryServices}
		objectCheckers = []checkers.ObjectChecker{noServiceChecker, grpcRouteChecker}
		referenceChecker = references.K8sGRPCRouteReferences{K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes, Namespaces: namespaces, K8sReferenceGrants: istioConfigList.K8sReferenceGrants}
	case kubernetes.K8sHTTPRoutes:
		httpRouteChecker := checkers.K8sHTTPRouteChecker{Cluster: cluster, K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sGateways: istioConfigList.K8sGateways, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, RegistryServices: registryServices}
		objectCheckers = []checkers.ObjectChecker{noServiceChecker, httpRouteChecker}
		referenceChecker = references.K8sHTTPRouteReferences{K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, Namespaces: namespaces, K8sReferenceGrants: istioConfigList.K8sReferenceGrants}
	case kubernetes.K8sReferenceGrants:
		objectCheckers = []checkers.ObjectChecker{
			checkers.K8sReferenceGrantChecker{Cluster: cluster, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces},
		}
	case kubernetes.K8sTCPRoutes:
		// Validation on K8sTCPRoutes is not expected
	case kubernetes.K8sTLSRoutes:
		// Validation on K8sTLSRoutes is not expected
	default:
		err = fmt.Errorf("object type not found: %v", objectGVK.String())
	}

	if referenceChecker != nil {
		istioReferences = runObjectReferenceChecker(referenceChecker)
	}

	if objectCheckers == nil {
		return models.IstioValidations{}, istioReferences, err
	}

	validations := runObjectCheckers(objectCheckers).FilterByKey(objectGVK, object)
	for k, v := range validations {
		in.kialiCache.Validations().Set(k, v)
	}

	return validations, istioReferences, nil
}

func runObjectCheckers(objectCheckers []checkers.ObjectChecker) models.IstioValidations {
	objectTypeValidations := models.IstioValidations{}

	// Run checks for each IstioObject type
	for _, objectChecker := range objectCheckers {
		objectTypeValidations.MergeValidations(runObjectChecker(objectChecker))
	}

	objectTypeValidations.StripIgnoredChecks()

	return objectTypeValidations
}

func runObjectChecker(objectChecker checkers.ObjectChecker) models.IstioValidations {
	// tracking the time it takes to execute the Check
	promtimer := internalmetrics.GetCheckerProcessingTimePrometheusTimer(fmt.Sprintf("%T", objectChecker))
	defer promtimer.ObserveDuration()
	return objectChecker.Check()
}

func runObjectReferenceChecker(referenceChecker ReferenceChecker) models.IstioReferencesMap {
	// tracking the time it takes to execute the Check
	promtimer := internalmetrics.GetCheckerProcessingTimePrometheusTimer(fmt.Sprintf("%T", referenceChecker))
	defer promtimer.ObserveDuration()
	return referenceChecker.References()
}

// getServiceAccounts gets SA information given the namespaces and workloads for a given cluster.
func (in *IstioValidationsService) getServiceAccounts(
	namespaces []models.Namespace,
	workloadsMap map[string]models.WorkloadList,
) []string {
	serviceAccounts := map[string]bool{}
	istioDomain := strings.Replace(config.Get().ExternalServices.Istio.IstioIdentityDomain, "svc.", "", 1)

	for _, ns := range namespaces {
		saFullNameNs := fmt.Sprintf("%s/ns/%s/sa/", istioDomain, ns.Name)
		workloadList := workloadsMap[ns.Name]
		for _, wl := range workloadList.Workloads {
			for _, sAccountName := range wl.ServiceAccountNames {
				saFullName := saFullNameNs + sAccountName
				serviceAccounts[saFullName] = true
			}
		}
	}
	return slices.Collect(maps.Keys(serviceAccounts))
}

// setNamespaceIstioConfig assumes the following are set:
//
//	vInfo.clusterInfo.istioConfig
//	vInfo.nsInfo.namespace
//
// It takes the clusterInfoConfig and calculates the namespace config information. It sets:
//
//	vInfo.nsInfo.istioConfig
//	vInfo.nsInfo.mtlsDetails
//	vInfo.nsInfo.rbacDetails
func (in *IstioValidationsService) setNamespaceIstioConfig(
	vInfo *validationInfo,
) error {
	var namespaceIstioConfigList models.IstioConfigList
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails

	clusterIstioConfig := vInfo.clusterInfo.istioConfig

	// Filter VS
	filteredVSs := in.filterVSExportToNamespaces(clusterIstioConfig.VirtualServices, vInfo)
	namespaceIstioConfigList.VirtualServices = append(namespaceIstioConfigList.VirtualServices, filteredVSs...)

	// Filter DR
	filteredDRs := in.filterDRExportToNamespaces(kubernetes.FilterAutogeneratedDestinationRules(clusterIstioConfig.DestinationRules), vInfo)
	namespaceIstioConfigList.DestinationRules = append(namespaceIstioConfigList.DestinationRules, filteredDRs...)
	mtlsDetails.DestinationRules = append(mtlsDetails.DestinationRules, filteredDRs...)

	// Filter SE
	filteredSEs := in.filterSEExportToNamespaces(clusterIstioConfig.ServiceEntries, vInfo)
	namespaceIstioConfigList.ServiceEntries = append(namespaceIstioConfigList.ServiceEntries, filteredSEs...)

	// All Gateways
	namespaceIstioConfigList.Gateways = append(namespaceIstioConfigList.Gateways, kubernetes.FilterAutogeneratedGateways(clusterIstioConfig.Gateways)...)

	// All K8sGateways
	namespaceIstioConfigList.K8sGateways = append(namespaceIstioConfigList.K8sGateways, clusterIstioConfig.K8sGateways...)

	// All K8sHTTPRoutes
	namespaceIstioConfigList.K8sHTTPRoutes = append(namespaceIstioConfigList.K8sHTTPRoutes, clusterIstioConfig.K8sHTTPRoutes...)

	// All K8sGRPCRoutes
	namespaceIstioConfigList.K8sGRPCRoutes = append(namespaceIstioConfigList.K8sGRPCRoutes, clusterIstioConfig.K8sGRPCRoutes...)

	// All K8sReferenceGrants
	namespaceIstioConfigList.K8sReferenceGrants = append(namespaceIstioConfigList.K8sReferenceGrants, clusterIstioConfig.K8sReferenceGrants...)

	// All Sidecars
	namespaceIstioConfigList.Sidecars = append(namespaceIstioConfigList.Sidecars, clusterIstioConfig.Sidecars...)

	// All RequestAuthentications
	namespaceIstioConfigList.RequestAuthentications = append(namespaceIstioConfigList.RequestAuthentications, clusterIstioConfig.RequestAuthentications...)

	// All WorkloadEntries
	namespaceIstioConfigList.WorkloadEntries = append(namespaceIstioConfigList.WorkloadEntries, clusterIstioConfig.WorkloadEntries...)

	// All WorkloadGroups
	namespaceIstioConfigList.WorkloadGroups = append(namespaceIstioConfigList.WorkloadGroups, clusterIstioConfig.WorkloadGroups...)

	in.filterPeerAuths(vInfo.nsInfo.namespace.Name, &mtlsDetails, clusterIstioConfig.PeerAuthentications)
	in.filterAuthPolicies(vInfo.nsInfo.namespace.Name, &rbacDetails, clusterIstioConfig.AuthorizationPolicies)

	vInfo.nsInfo.istioConfig = &namespaceIstioConfigList
	vInfo.nsInfo.mtlsDetails = &mtlsDetails
	vInfo.nsInfo.rbacDetails = &rbacDetails

	return nil
}

func (in *IstioValidationsService) filterPeerAuths(namespace string, mtlsDetails *kubernetes.MTLSDetails, peerAuths []*security_v1.PeerAuthentication) {
	rootNs := config.Get().ExternalServices.Istio.RootNamespace
	for _, pa := range peerAuths {
		if pa.Namespace == rootNs {
			mtlsDetails.MeshPeerAuthentications = append(mtlsDetails.MeshPeerAuthentications, pa)
		}
		if pa.Namespace == namespace || namespace == "" {
			mtlsDetails.PeerAuthentications = append(mtlsDetails.PeerAuthentications, pa)
		}
	}
}

func (in *IstioValidationsService) filterAuthPolicies(namespace string, rbacDetails *kubernetes.RBACDetails, authPolicies []*security_v1.AuthorizationPolicy) {
	for _, ap := range authPolicies {
		if ap.Namespace == namespace || namespace == "" {
			rbacDetails.AuthorizationPolicies = append(rbacDetails.AuthorizationPolicies, ap)
		}
	}
}

func (in *IstioValidationsService) filterVSExportToNamespaces(vsList []*networking_v1.VirtualService, vInfo *validationInfo) []*networking_v1.VirtualService {
	if vInfo.nsInfo.namespace.Name == "" {
		return kubernetes.FilterAutogeneratedVirtualServices(vsList)
	}
	meshExportTo := in.mesh.GetMeshConfig().DefaultVirtualServiceExportTo
	var result []*networking_v1.VirtualService
	for _, vs := range vsList {
		if kubernetes.IsAutogenerated(vs.Name) {
			continue
		}
		if in.isExportedObjectIncluded(vs.Spec.ExportTo, meshExportTo, vs.Namespace, vInfo) {
			result = append(result, vs)
		}
	}
	return result
}

func (in *IstioValidationsService) filterDRExportToNamespaces(dr []*networking_v1.DestinationRule, vInfo *validationInfo) []*networking_v1.DestinationRule {
	if vInfo.nsInfo.namespace.Name == "" {
		return dr
	}
	meshExportTo := in.mesh.GetMeshConfig().DefaultDestinationRuleExportTo
	var result []*networking_v1.DestinationRule
	for _, d := range dr {
		if in.isExportedObjectIncluded(d.Spec.ExportTo, meshExportTo, d.Namespace, vInfo) {
			result = append(result, d)
		}
	}
	return result
}

func (in *IstioValidationsService) filterSEExportToNamespaces(se []*networking_v1.ServiceEntry, vInfo *validationInfo) []*networking_v1.ServiceEntry {
	if vInfo.nsInfo.namespace == nil {
		return se
	}
	meshExportTo := in.mesh.GetMeshConfig().DefaultServiceExportTo
	var result []*networking_v1.ServiceEntry
	for _, s := range se {
		if in.isExportedObjectIncluded(s.Spec.ExportTo, meshExportTo, s.Namespace, vInfo) {
			result = append(result, s)
		}
	}
	return result
}

func (in *IstioValidationsService) isExportedObjectIncluded(exportTo []string, meshExportTo []string, objectNamespace string, vInfo *validationInfo) bool {
	// Ambient mode namespace does not support ExportTo, so export only to own namespace
	cluster := vInfo.clusterInfo.cluster
	namespace := vInfo.nsInfo.namespace.Name
	allNamespaces := vInfo.nsMap[cluster]
	if isAmbient(allNamespaces, objectNamespace) {
		return objectNamespace == namespace
	}
	if len(exportTo) == 0 {
		// using mesh defaultExportTo values
		exportTo = meshExportTo
	}
	if len(exportTo) > 0 {
		for _, exportToNs := range exportTo {
			// take only namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
			if checkExportTo(exportToNs, namespace, objectNamespace, allNamespaces) {
				return true
			}
		}
	} else {
		// no exportTo field, means object exported to all namespaces
		return true
	}
	return false
}

// setNonLocalMTLSConfig updates vInfo.nsInfo.mtlsDetails.EnabledAutoMtls based on the kiali home control plane
func (in *IstioValidationsService) setNonLocalMTLSConfig(vInfo *validationInfo) error {
	// TODO: Multi-primary support
	for _, controlPlane := range vInfo.mesh.ControlPlanes {
		if controlPlane.Cluster.IsKialiHome {
			vInfo.nsInfo.mtlsDetails.EnabledAutoMtls = controlPlane.Config.GetEnableAutoMtls()
		}
	}

	return nil
}

func (in *IstioValidationsService) isGatewayToNamespace(mesh *models.Mesh) bool {
	// TODO: Multi-primary support
	for _, controlPlane := range mesh.ControlPlanes {
		if controlPlane.Cluster.IsKialiHome {
			return controlPlane.Config.IsGatewayToNamespace
		}
	}

	return false
}

func (in *IstioValidationsService) isPolicyAllowAny(mesh *models.Mesh) bool {
	// TODO: Multi-primary support
	for _, controlPlane := range mesh.ControlPlanes {
		if controlPlane.Cluster.IsKialiHome {
			return controlPlane.Config.OutboundTrafficPolicy.Mode == AllowAny || controlPlane.Config.OutboundTrafficPolicy.Mode == ""
		}
	}

	return false
}

func checkExportTo(exportToNs string, currentNamespace string, ownNs string, allNamespaces []models.Namespace) bool {
	// check if namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
	// when exported to non-existing namespace, consider it to show validation error
	return exportToNs == "*" ||
		exportToNs == currentNamespace ||
		(exportToNs == "." && ownNs == currentNamespace) ||
		(exportToNs != "." && exportToNs != "*" && !exists(allNamespaces, exportToNs))
}

func exists(namespaces []models.Namespace, namespace string) bool {
	return sliceutil.Some(namespaces, func(ns models.Namespace) bool { return ns.Name == namespace })
}

func isAmbient(namespaces []models.Namespace, namespace string) bool {
	ns := sliceutil.Find(namespaces, func(ns models.Namespace) bool { return ns.Name == namespace })
	return ns != nil && ns.IsAmbient
}
