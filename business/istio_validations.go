package business

import (
	"context"
	"fmt"
	"sync"

	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"

	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/business/references"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/observability"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

type IstioValidationsService struct {
	userClients   map[string]kubernetes.ClientInterface
	businessLayer *Layer
}

type ObjectChecker interface {
	Check() models.IstioValidations
}

type ReferenceChecker interface {
	References() models.IstioReferencesMap
}

// GetValidations returns an IstioValidations object with all the checks found when running
// all the enabled checkers. If service is "" then the whole namespace is validated.
// If service is not empty string, then all of its associated Istio objects are validated.
func (in *IstioValidationsService) GetValidations(ctx context.Context, cluster, namespace, service, workload string) (models.IstioValidations, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetValidations",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", cluster),
		observability.Attribute("namespace", namespace),
		observability.Attribute("service", service),
		observability.Attribute("workload", workload),
	)
	defer end()

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if namespace != "" {
		if _, err := in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
			return nil, err
		}
	}

	// Ensure the service exists
	if service != "" {
		_, err := in.businessLayer.Svc.GetService(ctx, cluster, namespace, service)
		if err != nil {
			if err != nil {
				log.Warningf("Error invoking GetService %s", err)
			}
			return nil, fmt.Errorf("Service [namespace: %s] [name: %s] doesn't exist for Validations.", namespace, service)
		}
	}

	// time this function execution so we can capture how long it takes to fully validate this namespace/service
	timer := internalmetrics.GetValidationProcessingTimePrometheusTimer(namespace, service)
	defer timer.ObserveDuration()

	wg := sync.WaitGroup{}
	errChan := make(chan error, 1)

	var istioConfigList models.IstioConfigList
	var services models.ServiceList
	var namespaces models.Namespaces
	var workloadsPerNamespace map[string]models.WorkloadList
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails
	var registryServices []*kubernetes.RegistryService

	wg.Add(3) // We need to add these here to make sure we don't execute wg.Wait() before scheduler has started goroutines
	if service != "" {
		wg.Add(1)
	}

	// We fetch without target service as some validations will require full-namespace details
	go in.fetchIstioConfigList(ctx, &istioConfigList, &mtlsDetails, &rbacDetails, cluster, namespace, errChan, &wg)

	if workload != "" {
		// load only requested workload
		go in.fetchWorkload(ctx, &workloadsPerNamespace, cluster, workload, namespace, errChan, &wg)
	} else {
		go in.fetchAllWorkloads(ctx, &workloadsPerNamespace, cluster, &namespaces, errChan, &wg)
	}

	go in.fetchNonLocalmTLSConfigs(&mtlsDetails, cluster, errChan, &wg)
	if service != "" {
		go in.fetchServices(ctx, &services, cluster, namespace, errChan, &wg)
	}

	criteria := RegistryCriteria{AllNamespaces: true, Cluster: cluster}
	registryServices = in.businessLayer.RegistryStatus.GetRegistryServices(criteria)

	wg.Wait()
	close(errChan)
	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			return nil, e
		}
	}

	objectCheckers := in.getAllObjectCheckers(istioConfigList, workloadsPerNamespace, mtlsDetails, rbacDetails, namespaces, registryServices, cluster)

	// Get group validations for same kind istio objects
	validations := runObjectCheckers(objectCheckers)

	if service != "" {
		// in.businessLayer.Svc.GetServiceList(criteria) on fetchServices performs the validations on the service
		// No need to re-fetch deployments+pods for this
		validations.MergeValidations(services.Validations)
		validations = validations.FilterBySingleType("service", service)
	} else if workload != "" {
		workloadList := workloadsPerNamespace[namespace]
		validations.MergeValidations(workloadList.Validations)
		validations = validations.FilterBySingleType("workload", workload)
	}

	return validations, nil
}

func (in *IstioValidationsService) getAllObjectCheckers(istioConfigList models.IstioConfigList, workloadsPerNamespace map[string]models.WorkloadList, mtlsDetails kubernetes.MTLSDetails, rbacDetails kubernetes.RBACDetails, namespaces []models.Namespace, registryServices []*kubernetes.RegistryService, cluster string) []ObjectChecker {
	return []ObjectChecker{
		checkers.NoServiceChecker{Namespaces: namespaces, IstioConfigList: &istioConfigList, WorkloadsPerNamespace: workloadsPerNamespace, AuthorizationDetails: &rbacDetails, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny(), Cluster: cluster},
		checkers.VirtualServiceChecker{Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules, Cluster: cluster},
		checkers.DestinationRulesChecker{Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: istioConfigList.ServiceEntries, Cluster: cluster},
		checkers.GatewayChecker{Gateways: istioConfigList.Gateways, WorkloadsPerNamespace: workloadsPerNamespace, IsGatewayToNamespace: in.isGatewayToNamespace(), Cluster: cluster},
		checkers.PeerAuthenticationChecker{PeerAuthentications: mtlsDetails.PeerAuthentications, MTLSDetails: mtlsDetails, WorkloadsPerNamespace: workloadsPerNamespace, Cluster: cluster},
		checkers.ServiceEntryChecker{ServiceEntries: istioConfigList.ServiceEntries, Namespaces: namespaces, WorkloadEntries: istioConfigList.WorkloadEntries, Cluster: cluster},
		checkers.AuthorizationPolicyChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, WorkloadsPerNamespace: workloadsPerNamespace, MtlsDetails: mtlsDetails, VirtualServices: istioConfigList.VirtualServices, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny(), Cluster: cluster},
		checkers.SidecarChecker{Sidecars: istioConfigList.Sidecars, Namespaces: namespaces, WorkloadsPerNamespace: workloadsPerNamespace, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices, Cluster: cluster},
		checkers.RequestAuthenticationChecker{RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadsPerNamespace: workloadsPerNamespace, Cluster: cluster},
		checkers.WorkloadChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, WorkloadsPerNamespace: workloadsPerNamespace, Cluster: cluster},
		checkers.K8sGatewayChecker{K8sGateways: istioConfigList.K8sGateways, Cluster: cluster, GatewayClasses: in.businessLayer.IstioConfig.GatewayAPIClasses(cluster)},
		checkers.K8sHTTPRouteChecker{K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sGateways: istioConfigList.K8sGateways, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, RegistryServices: registryServices, Cluster: cluster},
		checkers.K8sReferenceGrantChecker{K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, Cluster: cluster},
		checkers.WasmPluginChecker{WasmPlugins: istioConfigList.WasmPlugins, Namespaces: namespaces},
		checkers.TelemetryChecker{Telemetries: istioConfigList.Telemetries, Namespaces: namespaces},
	}
}

// GetIstioObjectValidations validates a single Istio object of the given type with the given name found in the given namespace.
func (in *IstioValidationsService) GetIstioObjectValidations(ctx context.Context, cluster, namespace string, objectType string, object string) (models.IstioValidations, models.IstioReferencesMap, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetIstioObjectValidations",
		observability.Attribute("package", "business"),
		observability.Attribute("cluster", "cluster"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("objectType", objectType),
		observability.Attribute("object", object),
	)
	defer end()

	var istioConfigList models.IstioConfigList
	var namespaces models.Namespaces
	var workloadsPerNamespace map[string]models.WorkloadList
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails
	var registryServices []*kubernetes.RegistryService
	var err error
	var objectCheckers []ObjectChecker
	var referenceChecker ReferenceChecker
	istioReferences := models.IstioReferencesMap{}

	istioApiEnabled := config.Get().ExternalServices.Istio.IstioAPIEnabled

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.businessLayer.Namespace.GetClusterNamespace(ctx, namespace, cluster); err != nil {
		return nil, istioReferences, err
	}

	// time this function execution so we can capture how long it takes to fully validate this istio object
	timer := internalmetrics.GetSingleValidationProcessingTimePrometheusTimer(namespace, objectType, object)
	defer timer.ObserveDuration()

	wg := sync.WaitGroup{}
	errChan := make(chan error, 1)

	// Get all the Istio objects from a Namespace and all gateways from every namespace
	wg.Add(3)

	go in.fetchIstioConfigList(ctx, &istioConfigList, &mtlsDetails, &rbacDetails, cluster, namespace, errChan, &wg)
	go in.fetchAllWorkloads(ctx, &workloadsPerNamespace, cluster, &namespaces, errChan, &wg)
	go in.fetchNonLocalmTLSConfigs(&mtlsDetails, cluster, errChan, &wg)

	if istioApiEnabled {
		criteria := RegistryCriteria{AllNamespaces: true, Cluster: cluster}
		registryServices = in.businessLayer.RegistryStatus.GetRegistryServices(criteria)
	}

	wg.Wait()

	noServiceChecker := checkers.NoServiceChecker{Cluster: cluster, Namespaces: namespaces, IstioConfigList: &istioConfigList, WorkloadsPerNamespace: workloadsPerNamespace, AuthorizationDetails: &rbacDetails, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny()}

	switch objectType {
	case kubernetes.Gateways:
		objectCheckers = []ObjectChecker{
			checkers.GatewayChecker{Cluster: cluster, Gateways: istioConfigList.Gateways, WorkloadsPerNamespace: workloadsPerNamespace, IsGatewayToNamespace: in.isGatewayToNamespace()},
		}
		referenceChecker = references.GatewayReferences{Gateways: istioConfigList.Gateways, VirtualServices: istioConfigList.VirtualServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.VirtualServices:
		virtualServiceChecker := checkers.VirtualServiceChecker{Cluster: cluster, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules}
		objectCheckers = []ObjectChecker{noServiceChecker, virtualServiceChecker}
		referenceChecker = references.VirtualServiceReferences{Namespace: namespace, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules, AuthorizationPolicies: rbacDetails.AuthorizationPolicies}
	case kubernetes.DestinationRules:
		destinationRulesChecker := checkers.DestinationRulesChecker{Cluster: cluster, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: istioConfigList.ServiceEntries}
		objectCheckers = []ObjectChecker{noServiceChecker, destinationRulesChecker}
		referenceChecker = references.DestinationRuleReferences{Namespace: namespace, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, VirtualServices: istioConfigList.VirtualServices, WorkloadsPerNamespace: workloadsPerNamespace, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices}
	case kubernetes.ServiceEntries:
		serviceEntryChecker := checkers.ServiceEntryChecker{Cluster: cluster, ServiceEntries: istioConfigList.ServiceEntries, Namespaces: namespaces, WorkloadEntries: istioConfigList.WorkloadEntries}
		objectCheckers = []ObjectChecker{serviceEntryChecker}
		referenceChecker = references.ServiceEntryReferences{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespace: namespace, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, ServiceEntries: istioConfigList.ServiceEntries, Sidecars: istioConfigList.Sidecars, RegistryServices: registryServices}
	case kubernetes.Sidecars:
		sidecarsChecker := checkers.SidecarChecker{
			Cluster: cluster, Sidecars: istioConfigList.Sidecars, Namespaces: namespaces,
			WorkloadsPerNamespace: workloadsPerNamespace, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices,
		}
		objectCheckers = []ObjectChecker{sidecarsChecker}
		referenceChecker = references.SidecarReferences{Sidecars: istioConfigList.Sidecars, Namespace: namespace, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.AuthorizationPolicies:
		authPoliciesChecker := checkers.AuthorizationPolicyChecker{
			AuthorizationPolicies: rbacDetails.AuthorizationPolicies,
			Cluster:               cluster, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries,
			WorkloadsPerNamespace: workloadsPerNamespace, MtlsDetails: mtlsDetails, VirtualServices: istioConfigList.VirtualServices, RegistryServices: registryServices, PolicyAllowAny: in.isPolicyAllowAny(),
		}
		objectCheckers = []ObjectChecker{authPoliciesChecker}
		referenceChecker = references.AuthorizationPolicyReferences{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespace: namespace, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.PeerAuthentications:
		// Validations on PeerAuthentications
		peerAuthnChecker := checkers.PeerAuthenticationChecker{Cluster: cluster, PeerAuthentications: mtlsDetails.PeerAuthentications, MTLSDetails: mtlsDetails, WorkloadsPerNamespace: workloadsPerNamespace}
		objectCheckers = []ObjectChecker{peerAuthnChecker}
		referenceChecker = references.PeerAuthReferences{MTLSDetails: mtlsDetails, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.WorkloadEntries:
		// Validation on WorkloadEntries are not yet in place
	case kubernetes.WorkloadGroups:
		// Validation on WorkloadGroups are not yet in place
	case kubernetes.RequestAuthentications:
		// Validation on RequestAuthentications are not yet in place
		requestAuthnChecker := checkers.RequestAuthenticationChecker{Cluster: cluster, RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadsPerNamespace: workloadsPerNamespace}
		objectCheckers = []ObjectChecker{requestAuthnChecker}
	case kubernetes.EnvoyFilters:
		// Validation on EnvoyFilters are not yet in place
	case kubernetes.WasmPlugins:
		// Validation on WasmPlugins is not expected
	case kubernetes.Telemetries:
		// Validation on Telemetries is not expected
	case kubernetes.K8sGateways:
		// Validations on K8sGateways
		objectCheckers = []ObjectChecker{
			checkers.K8sGatewayChecker{Cluster: cluster, K8sGateways: istioConfigList.K8sGateways, GatewayClasses: in.businessLayer.IstioConfig.GatewayAPIClasses(cluster)},
		}
		referenceChecker = references.K8sGatewayReferences{K8sGateways: istioConfigList.K8sGateways, K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes}
	case kubernetes.K8sGRPCRoutes:
		// Validation on K8sGRPCRoutes is not expected
	case kubernetes.K8sHTTPRoutes:
		httpRouteChecker := checkers.K8sHTTPRouteChecker{Cluster: cluster, K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, K8sGateways: istioConfigList.K8sGateways, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces, RegistryServices: registryServices}
		objectCheckers = []ObjectChecker{noServiceChecker, httpRouteChecker}
		referenceChecker = references.K8sHTTPRouteReferences{K8sHTTPRoutes: istioConfigList.K8sHTTPRoutes, Namespaces: namespaces, K8sReferenceGrants: istioConfigList.K8sReferenceGrants}
	case kubernetes.K8sReferenceGrants:
		objectCheckers = []ObjectChecker{
			checkers.K8sReferenceGrantChecker{Cluster: cluster, K8sReferenceGrants: istioConfigList.K8sReferenceGrants, Namespaces: namespaces},
		}
	case kubernetes.K8sTCPRoutes:
		// Validation on K8sTCPRoutes is not expected
	case kubernetes.K8sTLSRoutes:
		// Validation on K8sTLSRoutes is not expected
	default:
		err = fmt.Errorf("object type not found: %v", objectType)
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

	return runObjectCheckers(objectCheckers).FilterByKey(models.ObjectTypeSingular[objectType], object), istioReferences, nil
}

func runObjectCheckers(objectCheckers []ObjectChecker) models.IstioValidations {
	objectTypeValidations := models.IstioValidations{}

	// Run checks for each IstioObject type
	for _, objectChecker := range objectCheckers {
		objectTypeValidations.MergeValidations(runObjectChecker(objectChecker))
	}

	objectTypeValidations.StripIgnoredChecks()

	return objectTypeValidations
}

func runObjectChecker(objectChecker ObjectChecker) models.IstioValidations {
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

func (in *IstioValidationsService) fetchServices(ctx context.Context, rValue *models.ServiceList, cluster, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		var services *models.ServiceList
		var err error
		criteria := ServiceCriteria{
			IncludeHealth: false,
			Namespace:     namespace,
			Cluster:       cluster,
		}
		services, err = in.businessLayer.Svc.GetServiceList(ctx, criteria)
		if err != nil {
			select {
			case errChan <- err:
			default:
			}
		} else {
			*rValue = *services
		}
	}
}

func (in *IstioValidationsService) fetchAllWorkloads(ctx context.Context, rValue *map[string]models.WorkloadList, cluster string, namespaces *models.Namespaces, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		nss, err := in.businessLayer.Namespace.GetClusterNamespaces(ctx, cluster)
		if err != nil {
			errChan <- err
			return

		}
		*namespaces = nss

		allWorkloads := map[string]models.WorkloadList{}
		for _, ns := range nss {
			criteria := WorkloadCriteria{Cluster: cluster, Namespace: ns.Name, IncludeIstioResources: false, IncludeHealth: false}
			workloadList, err := in.businessLayer.Workload.GetWorkloadList(ctx, criteria)
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

func (in *IstioValidationsService) fetchWorkload(ctx context.Context, rValue *map[string]models.WorkloadList, cluster, workload, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		allWorkloads := map[string]models.WorkloadList{}
		criteria := WorkloadCriteria{Cluster: cluster, WorkloadName: workload, Namespace: namespace, IncludeIstioResources: true, IncludeHealth: false}
		workloadList, err := in.businessLayer.Workload.GetWorkloadList(ctx, criteria)
		if err != nil {
			select {
			case errChan <- err:
			default:
			}
		} else {
			allWorkloads[namespace] = workloadList
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
	nss, err := in.businessLayer.Namespace.GetClusterNamespaces(ctx, cluster)
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
		IncludeK8sGateways:            true,
		IncludeK8sReferenceGrants:     true,
	}
	istioConfigMap, err := in.businessLayer.IstioConfig.GetIstioConfigMap(ctx, meta_v1.NamespaceAll, criteria)
	if err != nil {
		errChan <- err
		return
	}
	istioConfigList := istioConfigMap[cluster]

	// Filter VS
	filteredVSs := in.filterVSExportToNamespaces(nss, namespace, cluster, istioConfigList.VirtualServices)
	rValue.VirtualServices = append(rValue.VirtualServices, filteredVSs...)

	// Filter DR
	filteredDRs := in.filterDRExportToNamespaces(nss, namespace, cluster, kubernetes.FilterAutogeneratedDestinationRules(istioConfigList.DestinationRules))
	rValue.DestinationRules = append(rValue.DestinationRules, filteredDRs...)
	mtlsDetails.DestinationRules = append(mtlsDetails.DestinationRules, filteredDRs...)

	// Filter SE
	filteredSEs := in.filterSEExportToNamespaces(nss, namespace, cluster, istioConfigList.ServiceEntries)
	rValue.ServiceEntries = append(rValue.ServiceEntries, filteredSEs...)

	// All Gateways
	rValue.Gateways = append(rValue.Gateways, kubernetes.FilterAutogeneratedGateways(istioConfigList.Gateways)...)

	// All K8sGateways
	rValue.K8sGateways = append(rValue.K8sGateways, istioConfigList.K8sGateways...)

	// All K8sHTTPRoutes
	rValue.K8sHTTPRoutes = append(rValue.K8sHTTPRoutes, istioConfigList.K8sHTTPRoutes...)

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

func (in *IstioValidationsService) filterPeerAuths(namespace string, mtlsDetails *kubernetes.MTLSDetails, peerAuths []*security_v1beta.PeerAuthentication) {
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

func (in *IstioValidationsService) filterAuthPolicies(namespace string, rbacDetails *kubernetes.RBACDetails, authPolicies []*security_v1beta.AuthorizationPolicy) {
	for _, ap := range authPolicies {
		if ap.Namespace == namespace || namespace == "" {
			rbacDetails.AuthorizationPolicies = append(rbacDetails.AuthorizationPolicies, ap)
		}
	}
}

func (in *IstioValidationsService) filterVSExportToNamespaces(allNamespaces models.Namespaces, namespace string, cluster string, vs []*networking_v1beta1.VirtualService) []*networking_v1beta1.VirtualService {
	if namespace == "" {
		return kubernetes.FilterAutogeneratedVirtualServices(vs)
	}
	var result []*networking_v1beta1.VirtualService
	for _, v := range vs {
		if kubernetes.IsAutogenerated(v.Name) {
			continue
		}
		if in.isExportedObjectIncluded(v.Spec.ExportTo, allNamespaces, v.Namespace, namespace, cluster) {
			result = append(result, v)
		}
	}
	return result
}

func (in *IstioValidationsService) filterDRExportToNamespaces(allNamespaces models.Namespaces, namespace string, cluster string, dr []*networking_v1beta1.DestinationRule) []*networking_v1beta1.DestinationRule {
	if namespace == "" {
		return dr
	}
	var result []*networking_v1beta1.DestinationRule
	for _, d := range dr {
		if in.isExportedObjectIncluded(d.Spec.ExportTo, allNamespaces, d.Namespace, namespace, cluster) {
			result = append(result, d)
		}
	}
	return result
}

func (in *IstioValidationsService) filterSEExportToNamespaces(allNamespaces models.Namespaces, namespace string, cluster string, se []*networking_v1beta1.ServiceEntry) []*networking_v1beta1.ServiceEntry {
	if namespace == "" {
		return se
	}
	var result []*networking_v1beta1.ServiceEntry
	for _, s := range se {
		if in.isExportedObjectIncluded(s.Spec.ExportTo, allNamespaces, s.Namespace, namespace, cluster) {
			result = append(result, s)
		}
	}
	return result
}

func (in *IstioValidationsService) isExportedObjectIncluded(exportTo []string, allNamespaces models.Namespaces, objectNamespace, exportedNamespace string, cluster string) bool {
	// Ambient mode namespace does not support ExportTo, so export only to own namespace
	if in.businessLayer.IstioConfig.IsAmbientEnabled(cluster) && allNamespaces.IsNamespaceAmbient(objectNamespace, cluster) {
		return objectNamespace == exportedNamespace
	} else {
		if len(exportTo) > 0 {
			for _, exportToNs := range exportTo {
				// take only namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
				if checkExportTo(exportToNs, exportedNamespace, objectNamespace, allNamespaces) {
					return true
				}
			}
		} else {
			// no exportTo field, means object exported to all namespaces
			return true
		}
	}
	return false
}

func (in *IstioValidationsService) fetchNonLocalmTLSConfigs(mtlsDetails *kubernetes.MTLSDetails, cluster string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) > 0 {
		return
	}

	cfg := config.Get()
	// TODO: Handle multi-primary instead of only using home cluster.
	kubeCache, err := kialiCache.GetKubeCache(cfg.KubernetesConfig.ClusterName)
	if err != nil {
		return
	}

	istioConfig, err := kubeCache.GetConfigMap(cfg.IstioNamespace, IstioConfigMapName(*cfg, ""))
	if err != nil {
		errChan <- err
		return
	}

	icm, err := kubernetes.GetIstioConfigMap(istioConfig)
	if err != nil {
		errChan <- err
	} else {
		mtlsDetails.EnabledAutoMtls = icm.GetEnableAutoMtls()
	}
}

func (in *IstioValidationsService) isGatewayToNamespace() bool {
	mesh, err := in.businessLayer.Mesh.GetMesh(context.TODO())
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
	allowAny := false
	if in.businessLayer != nil {
		if otp, err := in.businessLayer.Mesh.OutboundTrafficPolicy(); err == nil {
			if otp.Mode == "" || otp.Mode == AllowAny {
				return true
			}
		}
	}
	return allowAny
}

func checkExportTo(exportToNs string, namespace string, ownNs string, allNamespaces models.Namespaces) bool {
	// check if namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
	// when exported to non-existing namespace, consider it to show validation error
	return exportToNs == "*" || exportToNs == namespace || (exportToNs == "." && ownNs == namespace) || (exportToNs != "." && exportToNs != "*" && !allNamespaces.Includes(exportToNs))
}
