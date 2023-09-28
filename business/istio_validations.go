package business

import (
	"context"
	"fmt"
	"sync"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/business/references"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

func NewValidationsService(
	meshDiscovery istio.MeshDiscovery,
	istioConfig *IstioConfigService,
	kialiCache cache.KialiCache,
	namespaceService *NamespaceService,
	service *SvcService,
	userClients map[string]kubernetes.ClientInterface,
	workloadService *WorkloadService,
) IstioValidationsService {
	return IstioValidationsService{
		discovery:   meshDiscovery,
		istioConfig: istioConfig,
		kialiCache:  kialiCache,
		namespace:   namespaceService,
		service:     service,
		userClients: userClients,
		workload:    workloadService,
	}
}

type IstioValidationsService struct {
	discovery   istio.MeshDiscovery
	istioConfig *IstioConfigService
	kialiCache  cache.KialiCache
	namespace   *NamespaceService
	service     *SvcService
	userClients map[string]kubernetes.ClientInterface
	workload    *WorkloadService
}

type ReferenceChecker interface {
	References() models.IstioReferencesMap
}

func (in *IstioValidationsService) GetValidations(ctx context.Context, cluster string) (models.IstioValidations, error) {
	return in.kialiCache.Validations().Items(), nil
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
		if err != nil {
			log.Warningf("Error invoking GetService %s", err)
		}
		return nil, fmt.Errorf("Service [namespace: %s] [name: %s] doesn't exist for Validations.", namespace, service)
	}

	return models.IstioValidations(in.kialiCache.Validations().Items()).FilterBySingleType(schema.GroupVersionKind{Group: "", Version: "", Kind: "service"}, service), nil
}

func (in *IstioValidationsService) GetValidationsForWorkload(ctx context.Context, cluster, namespace, workload string) (models.IstioValidations, error) {
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if namespace != "" {
		if _, err := in.namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
			return nil, err
		}
	} else {
		return nil, fmt.Errorf("Namespace param should be set for Validations in cluster %s", cluster)
	}

	return models.IstioValidations(in.kialiCache.Validations().Items()).FilterBySingleType(schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"}, workload), nil
}

// CreateValidations returns an IstioValidations object with all the checks found when running
// all the enabled checkers. If service is "" then the whole namespace is validated.
// If service is not empty string, then all of its associated Istio objects are validated.
func (in *IstioValidationsService) CreateValidations(ctx context.Context, cluster string) (models.IstioValidations, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "getValidations",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
	)
	defer end()

	timer := internalmetrics.GetValidationProcessingTimePrometheusTimer("", "")
	defer timer.ObserveDuration()

	criteria := IstioConfigCriteria{
		AllNamespaces:                 true,
		Cluster:                       cluster,
		IncludeGateways:               true,
		IncludeDestinationRules:       true,
		IncludeServiceEntries:         true,
		IncludeVirtualServices:        true,
		IncludeSidecars:               true,
		IncludeRequestAuthentications: true,
		IncludeWorkloadEntries:        true,
		IncludeAuthorizationPolicies:  true,
		IncludePeerAuthentications:    true,
		IncludeK8sHTTPRoutes:          true,
		IncludeK8sGateways:            true,
	}
	istioConfigList, err := in.istioConfig.GetIstioConfigList(ctx, criteria)
	if err != nil {
		return nil, err
	}

	namespaces, err := in.namespace.GetClusterNamespaces(ctx, cluster)
	if err != nil {
		return nil, err
	}

	workloadsPerNamespace := map[string]models.WorkloadList{}
	for _, ns := range namespaces {
		criteria := WorkloadCriteria{Cluster: cluster, Namespace: ns.Name, IncludeIstioResources: false, IncludeHealth: false}
		workloadList, err := in.workload.GetWorkloadList(ctx, criteria)
		if err != nil {
			return nil, err
		}
		workloadsPerNamespace[ns.Name] = workloadList
	}

	mesh, err := in.discovery.Mesh(ctx)
	if err != nil {
		return nil, err
	}

	// Find a controlplane in the same cluster.
	// This is probably wrong since the config value needs to be considered *per namespace*
	// since each namespace can be controlled by a separate control plane.
	var mtlsDetails kubernetes.MTLSDetails
	for _, controlplane := range mesh.ControlPlanes {
		if controlplane.Cluster.Name == cluster {
			if controlplane.Config.EnableAutoMtls != nil {
				mtlsDetails.EnabledAutoMtls = *controlplane.Config.EnableAutoMtls
			}
		}
	}

	var registryServices []*kubernetes.RegistryService
	if registryStatus := in.kialiCache.GetRegistryStatus(cluster); registryStatus != nil {
		registryServices = registryStatus.Services
	}

	var rbacDetails kubernetes.RBACDetails
	in.filterAuthPolicies("", &rbacDetails, istioConfigList.AuthorizationPolicies)
	objectCheckers := in.getAllObjectCheckers(istioConfigList, workloadsPerNamespace, mtlsDetails, rbacDetails, namespaces, registryServices, cluster)

	// Get group validations for same kind istio objects
	validations := runObjectCheckers(objectCheckers)

	return validations, nil
}

func (in *IstioValidationsService) getAllObjectCheckers(istioConfigList models.IstioConfigList, workloadsPerNamespace map[string]models.WorkloadList, mtlsDetails kubernetes.MTLSDetails, rbacDetails kubernetes.RBACDetails, namespaces []models.Namespace, registryServices []*kubernetes.RegistryService, cluster string) []checkers.ObjectChecker {
	return []checkers.ObjectChecker{
		checkers.NoServiceChecker{Namespaces: namespaces, IstioConfigList: &istioConfigList, WorkloadsPerNamespace: workloadsPerNamespace, AuthorizationDetails: &rbacDetails, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny(), Cluster: cluster},
		checkers.VirtualServiceChecker{Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules, Cluster: cluster},
		checkers.DestinationRulesChecker{Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: istioConfigList.ServiceEntries, Cluster: cluster},
		checkers.GatewayChecker{Gateways: istioConfigList.Gateways, WorkloadsPerNamespace: workloadsPerNamespace, IsGatewayToNamespace: in.isGatewayToNamespace(), Cluster: cluster},
		checkers.PeerAuthenticationChecker{PeerAuthentications: mtlsDetails.PeerAuthentications, MTLSDetails: mtlsDetails, WorkloadsPerNamespace: workloadsPerNamespace, Cluster: cluster},
		checkers.ServiceEntryChecker{ServiceEntries: istioConfigList.ServiceEntries, Namespaces: namespaces, WorkloadEntries: istioConfigList.WorkloadEntries, Cluster: cluster},
		checkers.AuthorizationPolicyChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, WorkloadsPerNamespace: workloadsPerNamespace, MtlsDetails: mtlsDetails, VirtualServices: istioConfigList.VirtualServices, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny(), Cluster: cluster, ServiceAccounts: serviceAccounts},
		checkers.SidecarChecker{Sidecars: istioConfigList.Sidecars, Namespaces: namespaces, WorkloadsPerNamespace: workloadsPerNamespace, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices, Cluster: cluster},
		checkers.RequestAuthenticationChecker{RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadsPerNamespace: workloadsPerNamespace, Cluster: cluster},
		checkers.WorkloadChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, WorkloadsPerNamespace: workloadsPerNamespace, Cluster: cluster},
		checkers.K8sGatewayChecker{K8sGateways: istioConfigList.K8sGateways, Cluster: cluster, GatewayClasses: in.istioConfig.GatewayAPIClasses(cluster)},
		checkers.K8sGRPCRouteChecker{K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes, K8sGateways: istioConfigList.K8sGateways, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, RegistryServices: registryServices, Cluster: cluster},
		checkers.K8sHTTPRouteChecker{K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sGateways: istioConfigList.K8sGateways, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, RegistryServices: registryServices, Cluster: cluster},
		checkers.K8sReferenceGrantChecker{K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, Cluster: cluster},
		checkers.WasmPluginChecker{WasmPlugins: istioConfigList.WasmPlugins, Namespaces: namespaces},
		checkers.TelemetryChecker{Telemetries: istioConfigList.Telemetries, Namespaces: namespaces},
	}
}

// GetIstioObjectValidations validates a single Istio object of the given type with the given name found in the given namespace.
func (in *IstioValidationsService) GetIstioObjectValidations(ctx context.Context, cluster, namespace string, objectGVK schema.GroupVersionKind, object string) (models.IstioValidations, models.IstioReferencesMap, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetIstioObjectValidations",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", "cluster"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("objectGVK", objectGVK.String()),
		observability.Attribute("object", object),
	)
	defer end()

	var istioConfigList models.IstioConfigList
	var namespaces models.Namespaces
	var workloadsPerNamespace map[string]models.WorkloadList
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails
	var registryServices []*kubernetes.RegistryService
	var serviceAccounts map[string][]string
	var err error
	var objectCheckers []checkers.ObjectChecker
	var referenceChecker ReferenceChecker
	istioReferences := models.IstioReferencesMap{}

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, istioReferences, err
	}

	// time this function execution so we can capture how long it takes to fully validate this istio object
	timer := internalmetrics.GetSingleValidationProcessingTimePrometheusTimer(namespace, objectGVK.String(), object)
	defer timer.ObserveDuration()

	wg := sync.WaitGroup{}
	errChan := make(chan error, 1)

	// Get all the Istio objects from a Namespace and all gateways from every namespace
	wg.Add(3)

	go in.fetchIstioConfigList(ctx, &istioConfigList, &mtlsDetails, &rbacDetails, cluster, namespace, errChan, &wg)
	go in.fetchAllWorkloads(ctx, &workloadsPerNamespace, cluster, &namespaces, errChan, &wg)
	go in.fetchServiceAccounts(ctx, &serviceAccounts, errChan, &wg)
	if err := in.fetchNonLocalmTLSConfigs(&mtlsDetails, cluster); err != nil {
		return nil, nil, err
	}

	if registryStatus := in.kialiCache.GetRegistryStatus(cluster); registryStatus != nil {
		registryServices = registryStatus.Services
	}

	wg.Wait()

	noServiceChecker := checkers.NoServiceChecker{Cluster: cluster, Namespaces: namespaces, IstioConfigList: &istioConfigList, WorkloadsPerNamespace: workloadsPerNamespace, AuthorizationDetails: &rbacDetails, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny()}

	switch objectGVK.String() {
	case kubernetes.Gateways.String():
		objectCheckers = []checkers.ObjectChecker{
			checkers.GatewayChecker{Cluster: cluster, Gateways: istioConfigList.Gateways, WorkloadsPerNamespace: workloadsPerNamespace, IsGatewayToNamespace: in.isGatewayToNamespace()},
		}
		referenceChecker = references.GatewayReferences{Gateways: istioConfigList.Gateways, VirtualServices: istioConfigList.VirtualServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.VirtualServices.String():
		virtualServiceChecker := checkers.VirtualServiceChecker{Cluster: cluster, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules}
		objectCheckers = []checkers.ObjectChecker{noServiceChecker, virtualServiceChecker}
		referenceChecker = references.VirtualServiceReferences{Namespace: namespace, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules, AuthorizationPolicies: rbacDetails.AuthorizationPolicies}
	case kubernetes.DestinationRules.String():
		destinationRulesChecker := checkers.DestinationRulesChecker{Cluster: cluster, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: istioConfigList.ServiceEntries}
		objectCheckers = []checkers.ObjectChecker{noServiceChecker, destinationRulesChecker}
		referenceChecker = references.DestinationRuleReferences{Namespace: namespace, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, VirtualServices: istioConfigList.VirtualServices, WorkloadsPerNamespace: workloadsPerNamespace, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices}
	case kubernetes.ServiceEntries.String():
		serviceEntryChecker := checkers.ServiceEntryChecker{Cluster: cluster, ServiceEntries: istioConfigList.ServiceEntries, Namespaces: namespaces, WorkloadEntries: istioConfigList.WorkloadEntries}
		objectCheckers = []checkers.ObjectChecker{serviceEntryChecker}
		referenceChecker = references.ServiceEntryReferences{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespace: namespace, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, ServiceEntries: istioConfigList.ServiceEntries, Sidecars: istioConfigList.Sidecars, RegistryServices: registryServices}
	case kubernetes.Sidecars.String():
		sidecarsChecker := checkers.SidecarChecker{
			Cluster: cluster, Sidecars: istioConfigList.Sidecars, Namespaces: namespaces,
			WorkloadsPerNamespace: workloadsPerNamespace, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices,
		}
		objectCheckers = []checkers.ObjectChecker{sidecarsChecker}
		referenceChecker = references.SidecarReferences{Sidecars: istioConfigList.Sidecars, Namespace: namespace, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.AuthorizationPolicies.String():
		authPoliciesChecker := checkers.AuthorizationPolicyChecker{
			AuthorizationPolicies: rbacDetails.AuthorizationPolicies,
			Cluster:               cluster, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, ServiceAccounts: serviceAccounts,
			WorkloadsPerNamespace: workloadsPerNamespace, MtlsDetails: mtlsDetails, VirtualServices: istioConfigList.VirtualServices, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny(),
		}
		objectCheckers = []checkers.ObjectChecker{authPoliciesChecker}
		referenceChecker = references.AuthorizationPolicyReferences{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespace: namespace, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.PeerAuthentications.String():
		// Validations on PeerAuthentications
		peerAuthnChecker := checkers.PeerAuthenticationChecker{Cluster: cluster, PeerAuthentications: mtlsDetails.PeerAuthentications, MTLSDetails: mtlsDetails, WorkloadsPerNamespace: workloadsPerNamespace}
		objectCheckers = []checkers.ObjectChecker{peerAuthnChecker}
		referenceChecker = references.PeerAuthReferences{MTLSDetails: mtlsDetails, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.WorkloadEntries.String():
		// Validation on WorkloadEntries are not yet in place
	case kubernetes.WorkloadGroups.Group:
		// Validation on WorkloadGroups are not yet in place
	case kubernetes.RequestAuthentications.String():
		// Validation on RequestAuthentications are not yet in place
		requestAuthnChecker := checkers.RequestAuthenticationChecker{Cluster: cluster, RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadsPerNamespace: workloadsPerNamespace}
		objectCheckers = []checkers.ObjectChecker{requestAuthnChecker}
	case kubernetes.EnvoyFilters.String():
		objectCheckers = []checkers.ObjectChecker{requestAuthnChecker}
		// Validation on EnvoyFilters are not yet in place
	case kubernetes.WasmPlugins.String():
		// Validation on WasmPlugins is not expected
	case kubernetes.Telemetries.String():
		// Validation on Telemetries is not expected
	case kubernetes.K8sGateways.String():
		// Validations on K8sGateways
		objectCheckers = []checkers.ObjectChecker{
			checkers.K8sGatewayChecker{Cluster: cluster, K8sGateways: istioConfigList.K8sGateways, GatewayClasses: in.istioConfig.GatewayAPIClasses(cluster)},
		}
		referenceChecker = references.K8sGatewayReferences{K8sGateways: istioConfigList.K8sGateways, K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes}
	case kubernetes.K8sGRPCRoutes.String():
		grpcRouteChecker := checkers.K8sGRPCRouteChecker{Cluster: cluster, K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes, K8sGateways: istioConfigList.K8sGateways, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, RegistryServices: registryServices}
		objectCheckers = []ObjectChecker{noServiceChecker, grpcRouteChecker}
		referenceChecker = references.K8sGRPCRouteReferences{K8sGRPCRoutes: istioConfigList.K8sGRPCRoutes, Namespaces: namespaces, K8sReferenceGrants: istioConfigList.K8sReferenceGrants}
	case kubernetes.K8sHTTPRoutes.String():
		httpRouteChecker := checkers.K8sHTTPRouteChecker{Cluster: cluster, K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sGateways: istioConfigList.K8sGateways, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, RegistryServices: registryServices}
		objectCheckers = []checkers.ObjectChecker{noServiceChecker, httpRouteChecker}
		referenceChecker = references.K8sHTTPRouteReferences{K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, Namespaces: namespaces, K8sReferenceGrants: istioConfigList.K8sReferenceGrants}
	case kubernetes.K8sReferenceGrants.String():
		objectCheckers = []checkers.ObjectChecker{
			checkers.K8sReferenceGrantChecker{Cluster: cluster, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces},
		}
	case kubernetes.K8sTCPRoutes.String():
		// Validation on K8sTCPRoutes is not expected
	case kubernetes.K8sTLSRoutes.String():
		// Validation on K8sTLSRoutes is not expected
	default:
		err = fmt.Errorf("object type not found: %v", objectGVK.String())
	}

	close(errChan)
	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			return nil, istioReferences, err
		}
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

func (in *IstioValidationsService) fetchAllWorkloads(ctx context.Context, rValue *map[string]models.WorkloadList, cluster string, namespaces *models.Namespaces, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		nss, err := in.namespace.GetClusterNamespaces(ctx, cluster)
		if err != nil {
			errChan <- err
			return

		}
		*namespaces = nss

		allWorkloads := map[string]models.WorkloadList{}
		for _, ns := range nss {
			criteria := WorkloadCriteria{Cluster: cluster, Namespace: ns.Name, IncludeIstioResources: false, IncludeHealth: false}
			workloadList, err := in.workload.GetWorkloadList(ctx, criteria)
			if err != nil {
				select {
				case errChan <- err:
				default:
				}
			} else {
				allWorkloads[ns.Name] = workloadList
			}
		}
		*rValue = allWorkloads
	}
}

func (in *IstioValidationsService) fetchIstioConfigList(ctx context.Context, rValue *models.IstioConfigList, mtlsDetails *kubernetes.MTLSDetails, rbacDetails *kubernetes.RBACDetails, cluster, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) > 0 {
		return
	}

	// all namespaces are necessary to check Ambient mode of each namespace
	nss, err := in.namespace.GetClusterNamespaces(ctx, cluster)
	if err != nil {
		errChan <- err
		return
	}

	criteria := IstioConfigCriteria{
		IncludeGateways:               true,
		IncludeDestinationRules:       true,
		IncludeServiceEntries:         true,
		IncludeVirtualServices:        true,
		IncludeSidecars:               true,
		IncludeRequestAuthentications: true,
		IncludeWorkloadEntries:        true,
		IncludeAuthorizationPolicies:  true,
		IncludePeerAuthentications:    true,
		IncludeK8sHTTPRoutes:          true,
		IncludeK8sGRPCRoutes:          true,
		IncludeK8sGateways:            true,
		IncludeK8sReferenceGrants:     true,
	}
	istioConfigMap, err := in.istioConfig.GetIstioConfigMap(ctx, criteria)
	if err != nil {
		errChan <- err
		return
	}
	istioConfigList := istioConfigMap[cluster]

	nssAmbient := map[string]bool{}
	for _, ns := range nss {
		nssAmbient[ns.Name] = ns.IsAmbient
	}

	// Filter VS
	filteredVSs := in.filterVSExportToNamespaces(nssAmbient, namespace, cluster, istioConfigList.VirtualServices)
	rValue.VirtualServices = append(rValue.VirtualServices, filteredVSs...)

	// Filter DR
	filteredDRs := in.filterDRExportToNamespaces(nssAmbient, namespace, cluster, kubernetes.FilterAutogeneratedDestinationRules(istioConfigList.DestinationRules))
	rValue.DestinationRules = append(rValue.DestinationRules, filteredDRs...)
	mtlsDetails.DestinationRules = append(mtlsDetails.DestinationRules, filteredDRs...)

	// Filter SE
	filteredSEs := in.filterSEExportToNamespaces(nssAmbient, namespace, cluster, istioConfigList.ServiceEntries)
	rValue.ServiceEntries = append(rValue.ServiceEntries, filteredSEs...)

	// All Gateways
	rValue.Gateways = append(rValue.Gateways, kubernetes.FilterAutogeneratedGateways(istioConfigList.Gateways)...)

	// All K8sGateways
	rValue.K8sGateways = append(rValue.K8sGateways, istioConfigList.K8sGateways...)

	// All K8sHTTPRoutes
	rValue.K8sHTTPRoutes = append(rValue.K8sHTTPRoutes, istioConfigList.K8sHTTPRoutes...)

	// All K8sGRPCRoutes
	rValue.K8sGRPCRoutes = append(rValue.K8sGRPCRoutes, istioConfigList.K8sGRPCRoutes...)

	// All K8sReferenceGrants
	rValue.K8sReferenceGrants = append(rValue.K8sReferenceGrants, istioConfigList.K8sReferenceGrants...)

	// All Sidecars
	rValue.Sidecars = append(rValue.Sidecars, istioConfigList.Sidecars...)

	// All RequestAuthentications
	rValue.RequestAuthentications = append(rValue.RequestAuthentications, istioConfigList.RequestAuthentications...)

	// All WorkloadEntries
	rValue.WorkloadEntries = append(rValue.WorkloadEntries, istioConfigList.WorkloadEntries...)

	in.filterPeerAuths(namespace, mtlsDetails, istioConfigList.PeerAuthentications)

	in.filterAuthPolicies(namespace, rbacDetails, istioConfigList.AuthorizationPolicies)
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

func (in *IstioValidationsService) filterVSExportToNamespaces(allNamespaces map[string]bool, currentNamespace string, cluster string, vs []*networking_v1.VirtualService) []*networking_v1.VirtualService {
	if currentNamespace == "" {
		return kubernetes.FilterAutogeneratedVirtualServices(vs)
	}
	meshExportTo := in.businessLayer.Mesh.GetMeshConfig().DefaultVirtualServiceExportTo
	var result []*networking_v1.VirtualService
	for _, v := range vs {
		if kubernetes.IsAutogenerated(v.Name) {
			continue
		}
		if in.isExportedObjectIncluded(v.Spec.ExportTo, meshExportTo, allNamespaces, v.Namespace, currentNamespace, cluster) {
			result = append(result, v)
		}
	}
	return result
}

func (in *IstioValidationsService) filterDRExportToNamespaces(allNamespaces map[string]bool, currentNamespace string, cluster string, dr []*networking_v1.DestinationRule) []*networking_v1.DestinationRule {
	if currentNamespace == "" {
		return dr
	}
	meshExportTo := in.businessLayer.Mesh.GetMeshConfig().DefaultDestinationRuleExportTo
	var result []*networking_v1.DestinationRule
	for _, d := range dr {
		if in.isExportedObjectIncluded(d.Spec.ExportTo, meshExportTo, allNamespaces, d.Namespace, currentNamespace, cluster) {
			result = append(result, d)
		}
	}
	return result
}

func (in *IstioValidationsService) filterSEExportToNamespaces(allNamespaces map[string]bool, currentNamespace string, cluster string, se []*networking_v1.ServiceEntry) []*networking_v1.ServiceEntry {
	if currentNamespace == "" {
		return se
	}
	meshExportTo := in.businessLayer.Mesh.GetMeshConfig().DefaultServiceExportTo
	var result []*networking_v1.ServiceEntry
	for _, s := range se {
		if in.isExportedObjectIncluded(s.Spec.ExportTo, meshExportTo, allNamespaces, s.Namespace, currentNamespace, cluster) {
			result = append(result, s)
		}
	}
	return result
}

func (in *IstioValidationsService) isExportedObjectIncluded(exportTo []string, meshExportTo []string, allNamespaces map[string]bool, objectNamespace, currentNamespace string, cluster string) bool {
	// Ambient mode namespace does not support ExportTo, so export only to own namespace
	if in.istioConfig.IsAmbientEnabled(cluster) && isAmbient(allNamespaces, objectNamespace) {
		return objectNamespace == currentNamespace
	}
	if len(exportTo) == 0 {
		// using mesh defaultExportTo values
		exportTo = meshExportTo
	}
	if len(exportTo) > 0 {
		for _, exportToNs := range exportTo {
			// take only namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
			if checkExportTo(exportToNs, currentNamespace, objectNamespace, allNamespaces) {
				return true
			}
		}
	} else {
		// no exportTo field, means object exported to all namespaces
		return true
	}
	return false
}

func (in *IstioValidationsService) fetchNonLocalmTLSConfigs(mtlsDetails *kubernetes.MTLSDetails, cluster string) error {
	mesh, err := in.discovery.Mesh(context.TODO())
	if err != nil {
		return err
	}

	// TODO: Multi-primary support
	for _, controlPlane := range mesh.ControlPlanes {
		if controlPlane.Cluster.IsKialiHome {
			mtlsDetails.EnabledAutoMtls = controlPlane.Config.GetEnableAutoMtls()
		}
	}

	return nil
}

func (in *IstioValidationsService) isGatewayToNamespace() bool {
	mesh, err := in.discovery.Mesh(context.TODO())
	if err != nil {
		log.Errorf("Error getting mesh config: %s", err)
		return false
	}

	// TODO: Multi-primary support
	for _, controlPlane := range mesh.ControlPlanes {
		if controlPlane.Cluster.IsKialiHome {
			return controlPlane.Config.IsGatewayToNamespace
		}
	}

	return false
}

func (in *IstioValidationsService) isPolicyAllowAny() bool {
	mesh, err := in.discovery.Mesh(context.TODO())
	if err != nil {
		log.Errorf("Error getting mesh config: %s", err)
		return false
	}

	// TODO: Multi-primary support
	for _, controlPlane := range mesh.ControlPlanes {
		if controlPlane.Cluster.IsKialiHome {
			return controlPlane.Config.OutboundTrafficPolicy.Mode == AllowAny || controlPlane.Config.OutboundTrafficPolicy.Mode == ""
		}
	}

	return false
}

func checkExportTo(exportToNs string, currentNamespace string, ownNs string, allNamespaces map[string]bool) bool {
	// check if namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
	// when exported to non-existing namespace, consider it to show validation error
	return exportToNs == "*" || exportToNs == currentNamespace || (exportToNs == "." && ownNs == currentNamespace) || (exportToNs != "." && exportToNs != "*" && !existsInMap(allNamespaces, exportToNs))
}

func existsInMap(allNamespaces map[string]bool, exportToNs string) bool {
	if _, exists := allNamespaces[exportToNs]; exists {
		return true
	}
	return false
}

func isAmbient(allNamespaces map[string]bool, exportToNs string) bool {
	if value, exists := allNamespaces[exportToNs]; exists {
		return value
	}
	return false
}
