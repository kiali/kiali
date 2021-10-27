package business

import (
	"fmt"
	"sync"

	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

type IstioValidationsService struct {
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

type ObjectChecker interface {
	Check() models.IstioValidations
}

// GetValidations returns an IstioValidations object with all the checks found when running
// all the enabled checkers. If service is "" then the whole namespace is validated.
// If service is not empty string, then all of its associated Istio objects are validated.
func (in *IstioValidationsService) GetValidations(namespace, service string) (models.IstioValidations, error) {
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetNamespace(namespace); err != nil {
		return nil, err
	}

	// Ensure the service exists
	if service != "" {
		svc, err := in.businessLayer.Svc.getService(namespace, service)
		if svc == nil || err != nil {
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
	var exportedResources kubernetes.ExportedResources
	var services models.ServiceList
	var namespaces models.Namespaces
	var workloadsPerNamespace map[string]models.WorkloadList
	var gatewaysPerNamespace [][]networking_v1alpha3.Gateway
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails
	var registryStatus []*kubernetes.RegistryStatus

	wg.Add(9) // We need to add these here to make sure we don't execute wg.Wait() before scheduler has started goroutines

	// We fetch without target service as some validations will require full-namespace details
	go in.fetchIstioConfigList(&istioConfigList, namespace, errChan, &wg)
	go in.fetchExportedResources(&exportedResources, namespace, errChan, &wg)
	go in.fetchNamespaces(&namespaces, errChan, &wg)
	go in.fetchAllWorkloads(&workloadsPerNamespace, errChan, &wg)
	go in.fetchGatewaysPerNamespace(&gatewaysPerNamespace, errChan, &wg)
	go in.fetchNonLocalmTLSConfigs(&mtlsDetails, namespace, errChan, &wg)
	go in.fetchAuthorizationDetails(&rbacDetails, namespace, errChan, &wg)
	go in.fetchServices(&services, namespace, errChan, &wg)
	go in.fetchRegistryStatus(&registryStatus, errChan, &wg)

	wg.Wait()
	close(errChan)
	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			return nil, e
		}
	}

	objectCheckers := in.getAllObjectCheckers(namespace, istioConfigList, exportedResources, services, workloadsPerNamespace, workloadsPerNamespace[namespace], gatewaysPerNamespace, mtlsDetails, rbacDetails, namespaces, registryStatus)

	// Get group validations for same kind istio objects
	validations := runObjectCheckers(objectCheckers)

	if service != "" {
		// in.businessLayer.Svc.GetServiceList(criteria) on fetchServices performs the validations on the service
		// No need to re-fetch deployments+pods for this
		validations.MergeValidations(services.Validations)
		validations = validations.FilterBySingleType("service", service)
	}

	return validations, nil
}

func (in *IstioValidationsService) getAllObjectCheckers(namespace string, istioConfigList models.IstioConfigList, exportedResources kubernetes.ExportedResources, services models.ServiceList, workloadsPerNamespace map[string]models.WorkloadList, workloads models.WorkloadList, gatewaysPerNamespace [][]networking_v1alpha3.Gateway, mtlsDetails kubernetes.MTLSDetails, rbacDetails kubernetes.RBACDetails, namespaces []models.Namespace, registryStatus []*kubernetes.RegistryStatus) []ObjectChecker {
	return []ObjectChecker{
		checkers.NoServiceChecker{Namespace: namespace, Namespaces: namespaces, IstioConfigList: istioConfigList, ExportedResources: &exportedResources, ServiceList: services, WorkloadList: workloads, GatewaysPerNamespace: gatewaysPerNamespace, AuthorizationDetails: &rbacDetails, RegistryStatus: registryStatus},
		checkers.VirtualServiceChecker{Namespace: namespace, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, VirtualServices: istioConfigList.VirtualServices, ExportedDestinationRules: exportedResources.DestinationRules, ExportedVirtualServices: exportedResources.VirtualServices},
		checkers.DestinationRulesChecker{Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, ExportedDestinationRules: exportedResources.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: istioConfigList.ServiceEntries},
		checkers.GatewayChecker{GatewaysPerNamespace: gatewaysPerNamespace, Namespace: namespace, WorkloadsPerNamespace: workloadsPerNamespace},
		checkers.PeerAuthenticationChecker{PeerAuthentications: mtlsDetails.PeerAuthentications, MTLSDetails: mtlsDetails, WorkloadList: workloads},
		checkers.ServiceEntryChecker{ServiceEntries: istioConfigList.ServiceEntries, Namespaces: namespaces},
		checkers.AuthorizationPolicyChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespace: namespace, Namespaces: namespaces, ServiceList: services, ServiceEntries: istioConfigList.ServiceEntries, ExportedServiceEntries: exportedResources.ServiceEntries, WorkloadList: workloads, MtlsDetails: mtlsDetails, VirtualServices: istioConfigList.VirtualServices, RegistryStatus: registryStatus},
		checkers.SidecarChecker{Sidecars: istioConfigList.Sidecars, Namespaces: namespaces, WorkloadList: workloads, ServiceList: services, ServiceEntries: istioConfigList.ServiceEntries, ExportedServiceEntries: exportedResources.ServiceEntries},
		checkers.RequestAuthenticationChecker{RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadList: workloads},
	}
}

// GetIstioObjectValidations validates a single Istio object of the given type with the given name found in the given namespace.
func (in *IstioValidationsService) GetIstioObjectValidations(namespace string, objectType string, object string) (models.IstioValidations, error) {
	var istioConfigList models.IstioConfigList
	var exportedResources kubernetes.ExportedResources
	var namespaces models.Namespaces
	var services models.ServiceList
	var workloads models.WorkloadList
	var workloadsPerNamespace map[string]models.WorkloadList
	var gatewaysPerNamespace [][]networking_v1alpha3.Gateway
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails
	var registryStatus []*kubernetes.RegistryStatus
	var err error
	var objectCheckers []ObjectChecker

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.businessLayer.Namespace.GetNamespace(namespace); err != nil {
		return nil, err
	}

	// time this function execution so we can capture how long it takes to fully validate this istio object
	timer := internalmetrics.GetSingleValidationProcessingTimePrometheusTimer(namespace, objectType, object)
	defer timer.ObserveDuration()

	wg := sync.WaitGroup{}
	errChan := make(chan error, 1)

	// Get all the Istio objects from a Namespace and all gateways from every namespace
	wg.Add(10)
	go in.fetchNamespaces(&namespaces, errChan, &wg)
	go in.fetchIstioConfigList(&istioConfigList, namespace, errChan, &wg)
	go in.fetchExportedResources(&exportedResources, namespace, errChan, &wg)
	go in.fetchServices(&services, namespace, errChan, &wg)
	go in.fetchWorkloads(&workloads, namespace, errChan, &wg)
	go in.fetchAllWorkloads(&workloadsPerNamespace, errChan, &wg)
	go in.fetchGatewaysPerNamespace(&gatewaysPerNamespace, errChan, &wg)
	go in.fetchNonLocalmTLSConfigs(&mtlsDetails, namespace, errChan, &wg)
	go in.fetchAuthorizationDetails(&rbacDetails, namespace, errChan, &wg)
	go in.fetchRegistryStatus(&registryStatus, errChan, &wg)
	wg.Wait()

	noServiceChecker := checkers.NoServiceChecker{Namespace: namespace, Namespaces: namespaces, IstioConfigList: istioConfigList, ExportedResources: &exportedResources, ServiceList: services, WorkloadList: workloads, GatewaysPerNamespace: gatewaysPerNamespace, AuthorizationDetails: &rbacDetails, RegistryStatus: registryStatus}

	switch objectType {
	case kubernetes.Gateways:
		objectCheckers = []ObjectChecker{
			checkers.GatewayChecker{GatewaysPerNamespace: gatewaysPerNamespace, Namespace: namespace, WorkloadsPerNamespace: workloadsPerNamespace},
		}
	case kubernetes.VirtualServices:
		virtualServiceChecker := checkers.VirtualServiceChecker{Namespace: namespace, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules, ExportedDestinationRules: exportedResources.DestinationRules, ExportedVirtualServices: exportedResources.VirtualServices}
		objectCheckers = []ObjectChecker{noServiceChecker, virtualServiceChecker}
	case kubernetes.DestinationRules:
		destinationRulesChecker := checkers.DestinationRulesChecker{Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, ExportedDestinationRules: exportedResources.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: istioConfigList.ServiceEntries}
		objectCheckers = []ObjectChecker{noServiceChecker, destinationRulesChecker}
	case kubernetes.ServiceEntries:
		serviceEntryChecker := checkers.ServiceEntryChecker{ServiceEntries: istioConfigList.ServiceEntries, Namespaces: namespaces}
		objectCheckers = []ObjectChecker{serviceEntryChecker}
	case kubernetes.Sidecars:
		sidecarsChecker := checkers.SidecarChecker{Sidecars: istioConfigList.Sidecars, Namespaces: namespaces,
			WorkloadList: workloads, ServiceList: services, ServiceEntries: istioConfigList.ServiceEntries, ExportedServiceEntries: exportedResources.ServiceEntries}
		objectCheckers = []ObjectChecker{sidecarsChecker}
	case kubernetes.AuthorizationPolicies:
		authPoliciesChecker := checkers.AuthorizationPolicyChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies,
			Namespace: namespace, Namespaces: namespaces, ServiceList: services, ServiceEntries: istioConfigList.ServiceEntries, ExportedServiceEntries: exportedResources.ServiceEntries,
			WorkloadList: workloads, MtlsDetails: mtlsDetails, VirtualServices: istioConfigList.VirtualServices}
		objectCheckers = []ObjectChecker{authPoliciesChecker}
	case kubernetes.PeerAuthentications:
		// Validations on PeerAuthentications
		peerAuthnChecker := checkers.PeerAuthenticationChecker{PeerAuthentications: mtlsDetails.PeerAuthentications, MTLSDetails: mtlsDetails, WorkloadList: workloads}
		objectCheckers = []ObjectChecker{peerAuthnChecker}
	case kubernetes.WorkloadEntries:
		// Validation on WorkloadEntries are not yet in place
	case kubernetes.WorkloadGroups:
		// Validation on WorkloadGroups are not yet in place
	case kubernetes.RequestAuthentications:
		// Validation on RequestAuthentications are not yet in place
		requestAuthnChecker := checkers.RequestAuthenticationChecker{RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadList: workloads}
		objectCheckers = []ObjectChecker{requestAuthnChecker}
	case kubernetes.EnvoyFilters:
		// Validation on EnvoyFilters are not yet in place
	default:
		err = fmt.Errorf("object type not found: %v", objectType)
	}

	close(errChan)
	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			return nil, err
		}
	}

	if objectCheckers == nil {
		return models.IstioValidations{}, err
	}

	return runObjectCheckers(objectCheckers).FilterByKey(models.ObjectTypeSingular[objectType], object), nil
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

// The following idea is used underneath: if errChan has at least one record, we'll effectively cancel the request (if scheduled in such order). On the other hand, if we can't
// write to the buffered errChan, we just ignore the error as select does not block even if channel is full. This is because a single error is enough to cancel the whole request.

func (in *IstioValidationsService) fetchGatewaysPerNamespace(gatewaysPerNamespace *[][]networking_v1alpha3.Gateway, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if nss, err := in.businessLayer.Namespace.GetNamespaces(); err == nil {
		gwss := make([][]networking_v1alpha3.Gateway, len(nss))
		for i := range nss {
			gwss[i] = make([]networking_v1alpha3.Gateway, 0)
		}
		*gatewaysPerNamespace = gwss

		wg.Add(len(nss))
		for i, ns := range nss {
			go func(namespace string, gwIndex int) {
				defer wg.Done()
				criteria := IstioConfigCriteria{
					Namespace:       namespace,
					IncludeGateways: true,
				}
				istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(criteria)
				if err != nil {
					errChan <- err
					return
				}
				gwss[gwIndex] = istioConfigList.Gateways
			}(ns.Name, i)
		}
	} else {
		select {
		case errChan <- err:
		default:
		}
	}
}

func (in *IstioValidationsService) fetchNamespaces(rValue *models.Namespaces, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		namespaces, err := in.businessLayer.Namespace.GetNamespaces()
		if err != nil {
			select {
			case errChan <- err:
			default:
			}
		} else {
			*rValue = namespaces
		}
	}
}

func (in *IstioValidationsService) fetchServices(rValue *models.ServiceList, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		var services *models.ServiceList
		var err error
		criteria := ServiceCriteria{
			Namespace: namespace,
		}
		services, err = in.businessLayer.Svc.GetServiceList(criteria)
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

func (in *IstioValidationsService) fetchWorkloads(rValue *models.WorkloadList, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		criteria := WorkloadCriteria{Namespace: namespace, IncludeIstioResources: false}
		workloadList, err := in.businessLayer.Workload.GetWorkloadList(criteria)
		if err != nil {
			select {
			case errChan <- err:
			default:
			}
		} else {
			*rValue = workloadList
		}
	}
}

func (in *IstioValidationsService) fetchAllWorkloads(rValue *map[string]models.WorkloadList, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		nss, err := in.businessLayer.Namespace.GetNamespaces()
		if err != nil {
			errChan <- err
			return

		}
		allWorkloads := map[string]models.WorkloadList{}
		for _, ns := range nss {
			criteria := WorkloadCriteria{Namespace: ns.Name, IncludeIstioResources: false}
			workloadList, err := in.businessLayer.Workload.GetWorkloadList(criteria)
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

func (in *IstioValidationsService) fetchIstioConfigList(rValue *models.IstioConfigList, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		criteria := IstioConfigCriteria{
			Namespace:                     namespace,
			IncludeDestinationRules:       true,
			IncludeGateways:               true,
			IncludeServiceEntries:         true,
			IncludeSidecars:               true,
			IncludeVirtualServices:        true,
			IncludeRequestAuthentications: true,
		}
		istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(criteria)
		if err != nil {
			select {
			case errChan <- err:
			default:
			}
		} else {
			*rValue = istioConfigList
		}
	}
}

func (in *IstioValidationsService) fetchExportedResources(exportedResources *kubernetes.ExportedResources, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) > 0 {
		return
	}
	nss, err := in.businessLayer.Namespace.GetNamespaces()
	if err != nil {
		errChan <- err
		return
	}

	for _, ns := range nss {
		if namespace == ns.Name {
			continue // skip the current namespace as it is considered already in validations
		}
		criteria := IstioConfigCriteria{
			Namespace:               ns.Name,
			IncludeDestinationRules: true,
			IncludeServiceEntries:   true,
			IncludeVirtualServices:  true,
		}
		istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(criteria)
		if err != nil {
			errChan <- err
			return
		}
		// Filter VS
		filteredVSs := in.filterVSExportToNamespaces(namespace, istioConfigList.VirtualServices)
		exportedResources.VirtualServices = append(exportedResources.VirtualServices, filteredVSs...)

		// Filter DR
		filteredDRs := in.filterDRExportToNamespaces(namespace, istioConfigList.DestinationRules)
		exportedResources.DestinationRules = append(exportedResources.DestinationRules, filteredDRs...)

		// Filter SE
		filteredSEs := in.filterSEExportToNamespaces(namespace, istioConfigList.ServiceEntries)
		exportedResources.ServiceEntries = append(exportedResources.ServiceEntries, filteredSEs...)
	}
}

func (in *IstioValidationsService) filterVSExportToNamespaces(namespace string, vs []networking_v1alpha3.VirtualService) []networking_v1alpha3.VirtualService {
	var result []networking_v1alpha3.VirtualService
	for _, v := range vs {
		if len(v.Spec.ExportTo) > 0 {
			for _, exportToNs := range v.Spec.ExportTo {
				// take only namespaces where it is exported to, or if it is exported to all namespaces
				if exportToNs == "*" || exportToNs == namespace {
					result = append(result, v)
				}
			}
		} else {
			// no exportTo field, means object exported to all namespaces
			result = append(result, v)
		}
	}
	return result
}

func (in *IstioValidationsService) filterDRExportToNamespaces(namespace string, dr []networking_v1alpha3.DestinationRule) []networking_v1alpha3.DestinationRule {
	var result []networking_v1alpha3.DestinationRule
	for _, d := range dr {
		if len(d.Spec.ExportTo) > 0 {
			for _, exportToNs := range d.Spec.ExportTo {
				// take only namespaces where it is exported to, or if it is exported to all namespaces
				if exportToNs == "*" || exportToNs == namespace {
					result = append(result, d)
				}
			}
		} else {
			// no exportTo field, means object exported to all namespaces
			result = append(result, d)
		}
	}
	return result
}

func (in *IstioValidationsService) filterSEExportToNamespaces(namespace string, se []networking_v1alpha3.ServiceEntry) []networking_v1alpha3.ServiceEntry {
	var result []networking_v1alpha3.ServiceEntry
	for _, s := range se {
		if len(s.Spec.ExportTo) > 0 {
			for _, exportToNs := range s.Spec.ExportTo {
				// take only namespaces where it is exported to, or if it is exported to all namespaces
				if exportToNs == "*" || exportToNs == namespace {
					result = append(result, s)
				}
			}
		} else {
			// no exportTo field, means object exported to all namespaces
			result = append(result, s)
		}
	}
	return result
}

func (in *IstioValidationsService) fetchNonLocalmTLSConfigs(mtlsDetails *kubernetes.MTLSDetails, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) > 0 {
		return
	}

	wg.Add(3)

	go func(details *kubernetes.MTLSDetails) {
		defer wg.Done()
		criteria := IstioConfigCriteria{
			Namespace:                  config.Get().IstioNamespace,
			IncludePeerAuthentications: true,
		}
		istioConfig, err := in.businessLayer.IstioConfig.GetIstioConfigList(criteria)
		if err == nil {
			details.MeshPeerAuthentications = istioConfig.PeerAuthentications
		} else if !checkForbidden("fetchNonLocalmTLSConfigs", err, "probably Kiali doesn't have cluster permissions") {
			errChan <- err
		}
	}(mtlsDetails)

	go func(details *kubernetes.MTLSDetails) {
		defer wg.Done()
		criteria := IstioConfigCriteria{
			Namespace:                  namespace,
			IncludePeerAuthentications: true,
		}
		istioConfig, err := in.businessLayer.IstioConfig.GetIstioConfigList(criteria)
		if err == nil {
			details.PeerAuthentications = istioConfig.PeerAuthentications
		} else {
			errChan <- err
		}
	}(mtlsDetails)

	go func(details *kubernetes.MTLSDetails) {
		defer wg.Done()
		cfg := config.Get()

		var istioConfig *core_v1.ConfigMap
		var err error
		if IsNamespaceCached(cfg.IstioNamespace) {
			istioConfig, err = kialiCache.GetConfigMap(cfg.IstioNamespace, cfg.ExternalServices.Istio.ConfigMapName)
		} else {
			istioConfig, err = in.k8s.GetConfigMap(cfg.IstioNamespace, cfg.ExternalServices.Istio.ConfigMapName)
		}
		if err != nil {
			errChan <- err
			return
		}
		icm, err := kubernetes.GetIstioConfigMap(istioConfig)
		if err != nil {
			errChan <- err
		} else {
			details.EnabledAutoMtls = icm.GetEnableAutoMtls()
		}
	}(mtlsDetails)

	namespaces, err := in.businessLayer.Namespace.GetNamespaces()
	if err != nil {
		errChan <- err
		return
	}

	nsNames := make([]string, 0, len(namespaces))
	for _, ns := range namespaces {
		nsNames = append(nsNames, ns.Name)
	}

	destinationRules, err := in.businessLayer.TLS.getAllDestinationRules(nsNames)
	if err != nil {
		errChan <- err
	} else {
		mtlsDetails.DestinationRules = destinationRules
	}
}

func (in *IstioValidationsService) fetchAuthorizationDetails(rValue *kubernetes.RBACDetails, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		criteria := IstioConfigCriteria{
			Namespace:                    namespace,
			IncludeAuthorizationPolicies: true,
		}
		istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(criteria)
		if err != nil {
			if checkForbidden("fetchAuthorizationDetails", err, "") {
				return
			}
			select {
			case errChan <- err:
			default:
			}
		} else {
			rValue.AuthorizationPolicies = istioConfigList.AuthorizationPolicies
		}
	}
}

func (in *IstioValidationsService) fetchRegistryStatus(rValue *[]*kubernetes.RegistryStatus, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	registryStatus, err := in.businessLayer.RegistryStatus.GetRegistryStatus()
	if err != nil {
		select {
		case errChan <- err:
		default:
		}
	} else {
		*rValue = registryStatus
	}
}

var (
	// used with checkForbidden - if a caller is in the map, its forbidden warning message was already logged
	forbiddenCaller map[string]bool = map[string]bool{}
)

func checkForbidden(caller string, err error, context string) bool {
	// Some checks return 'forbidden' errors if user doesn't have cluster permissions
	// On this case we log it internally but we don't consider it as an internal error
	if errors.IsForbidden(err) {
		// These messages are expected when we do not have cluster permissions. Therefore, we want to
		// avoid flooding the logs with these forbidden messages when we do not have cluster permissions.
		// When we do not have cluster permissions, only log the message once per caller.
		// If we do expect to have cluster permissions, then something is really wrong and
		// we need to log this caller's message all the time.
		// We expect to have cluster permissions if accessible namespaces is "**".
		logTheMessage := true
		an := config.Get().Deployment.AccessibleNamespaces
		if !(len(an) == 1 && an[0] == "**") {
			// We do not expect to have cluster role permissions, so these forbidden errors are expected,
			// however, we do want to log the message once per caller.
			if _, ok := forbiddenCaller[caller]; ok {
				logTheMessage = false
			} else {
				forbiddenCaller[caller] = true
			}
		}

		if logTheMessage {
			if context == "" {
				log.Warningf("%s validation failed due to insufficient permissions. Error: %s", caller, err)
			} else {
				log.Warningf("%s validation failed due to insufficient permissions (%s). Error: %s", caller, context, err)
			}
		}
		return true
	}
	return false
}
