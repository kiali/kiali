package business

import (
	"context"
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
	"github.com/kiali/kiali/observability"
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
func (in *IstioValidationsService) GetValidations(ctx context.Context, namespace, service string) (models.IstioValidations, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetValidations",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("service", service),
	)
	defer end()
	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err := in.businessLayer.Namespace.GetNamespace(ctx, namespace); err != nil {
		return nil, err
	}

	// Ensure the service exists
	if service != "" {
		_, err := in.businessLayer.Svc.GetService(ctx, namespace, service)
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
	var exportedResources kubernetes.ExportedResources
	var services models.ServiceList
	var namespaces models.Namespaces
	var workloadsPerNamespace map[string]models.WorkloadList
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails
	var registryServices []*kubernetes.RegistryService

	wg.Add(8) // We need to add these here to make sure we don't execute wg.Wait() before scheduler has started goroutines

	// We fetch without target service as some validations will require full-namespace details
	go in.fetchIstioConfigList(ctx, &istioConfigList, namespace, errChan, &wg)
	go in.fetchExportedResources(ctx, &exportedResources, namespace, errChan, &wg)
	go in.fetchNamespaces(ctx, &namespaces, errChan, &wg)
	go in.fetchAllWorkloads(ctx, &workloadsPerNamespace, errChan, &wg)
	go in.fetchNonLocalmTLSConfigs(ctx, &mtlsDetails, namespace, errChan, &wg)
	go in.fetchAuthorizationDetails(ctx, &rbacDetails, namespace, errChan, &wg)
	go in.fetchServices(ctx, &services, namespace, errChan, &wg)
	go in.fetchRegistryServices(&registryServices, errChan, &wg)

	wg.Wait()
	close(errChan)
	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			return nil, e
		}
	}

	objectCheckers := in.getAllObjectCheckers(namespace, istioConfigList, exportedResources, services, workloadsPerNamespace, workloadsPerNamespace[namespace], mtlsDetails, rbacDetails, namespaces, registryServices)

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

func (in *IstioValidationsService) getAllObjectCheckers(namespace string, istioConfigList models.IstioConfigList, exportedResources kubernetes.ExportedResources, services models.ServiceList, workloadsPerNamespace map[string]models.WorkloadList, workloads models.WorkloadList, mtlsDetails kubernetes.MTLSDetails, rbacDetails kubernetes.RBACDetails, namespaces []models.Namespace, registryServices []*kubernetes.RegistryService) []ObjectChecker {
	return []ObjectChecker{
		checkers.NoServiceChecker{Namespace: namespace, Namespaces: namespaces, ExportedResources: &exportedResources, WorkloadList: workloads, AuthorizationDetails: &rbacDetails, RegistryServices: registryServices},
		checkers.VirtualServiceChecker{Namespace: namespace, Namespaces: namespaces, VirtualServices: exportedResources.VirtualServices, DestinationRules: exportedResources.DestinationRules},
		checkers.DestinationRulesChecker{Namespaces: namespaces, DestinationRules: exportedResources.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: exportedResources.ServiceEntries},
		checkers.GatewayChecker{Gateways: exportedResources.Gateways, Namespace: namespace, WorkloadsPerNamespace: workloadsPerNamespace},
		checkers.PeerAuthenticationChecker{PeerAuthentications: mtlsDetails.PeerAuthentications, MTLSDetails: mtlsDetails, WorkloadList: workloads},
		checkers.ServiceEntryChecker{ServiceEntries: exportedResources.ServiceEntries, Namespaces: namespaces, WorkloadEntries: istioConfigList.WorkloadEntries},
		checkers.AuthorizationPolicyChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespace: namespace, Namespaces: namespaces, ServiceList: services, ServiceEntries: exportedResources.ServiceEntries, WorkloadList: workloads, MtlsDetails: mtlsDetails, VirtualServices: exportedResources.VirtualServices, RegistryServices: registryServices},
		checkers.SidecarChecker{Sidecars: istioConfigList.Sidecars, Namespaces: namespaces, WorkloadList: workloads, ServiceEntries: exportedResources.ServiceEntries, RegistryServices: registryServices},
		checkers.RequestAuthenticationChecker{RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadList: workloads},
	}
}

// GetIstioObjectValidations validates a single Istio object of the given type with the given name found in the given namespace.
func (in *IstioValidationsService) GetIstioObjectValidations(ctx context.Context, namespace string, objectType string, object string) (models.IstioValidations, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetIstioObjectValidations",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("objectType", objectType),
		observability.Attribute("object", object),
	)
	defer end()

	var istioConfigList models.IstioConfigList
	var exportedResources kubernetes.ExportedResources
	var namespaces models.Namespaces
	var services models.ServiceList
	var workloads models.WorkloadList
	var workloadsPerNamespace map[string]models.WorkloadList
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails
	var registryServices []*kubernetes.RegistryService
	var err error
	var objectCheckers []ObjectChecker

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.businessLayer.Namespace.GetNamespace(ctx, namespace); err != nil {
		return nil, err
	}

	// time this function execution so we can capture how long it takes to fully validate this istio object
	timer := internalmetrics.GetSingleValidationProcessingTimePrometheusTimer(namespace, objectType, object)
	defer timer.ObserveDuration()

	wg := sync.WaitGroup{}
	errChan := make(chan error, 1)

	// Get all the Istio objects from a Namespace and all gateways from every namespace
	wg.Add(9)
	go in.fetchNamespaces(ctx, &namespaces, errChan, &wg)
	go in.fetchIstioConfigList(ctx, &istioConfigList, namespace, errChan, &wg)
	go in.fetchExportedResources(ctx, &exportedResources, namespace, errChan, &wg)
	go in.fetchServices(ctx, &services, namespace, errChan, &wg)
	go in.fetchWorkloads(ctx, &workloads, namespace, errChan, &wg)
	go in.fetchAllWorkloads(ctx, &workloadsPerNamespace, errChan, &wg)
	go in.fetchNonLocalmTLSConfigs(ctx, &mtlsDetails, namespace, errChan, &wg)
	go in.fetchAuthorizationDetails(ctx, &rbacDetails, namespace, errChan, &wg)
	go in.fetchRegistryServices(&registryServices, errChan, &wg)
	wg.Wait()

	noServiceChecker := checkers.NoServiceChecker{Namespace: namespace, Namespaces: namespaces, ExportedResources: &exportedResources, WorkloadList: workloads, AuthorizationDetails: &rbacDetails, RegistryServices: registryServices}

	switch objectType {
	case kubernetes.Gateways:
		objectCheckers = []ObjectChecker{
			checkers.GatewayChecker{Gateways: exportedResources.Gateways, Namespace: namespace, WorkloadsPerNamespace: workloadsPerNamespace},
		}
	case kubernetes.VirtualServices:
		virtualServiceChecker := checkers.VirtualServiceChecker{Namespace: namespace, Namespaces: namespaces, VirtualServices: exportedResources.VirtualServices, DestinationRules: exportedResources.DestinationRules}
		objectCheckers = []ObjectChecker{noServiceChecker, virtualServiceChecker}
	case kubernetes.DestinationRules:
		destinationRulesChecker := checkers.DestinationRulesChecker{Namespaces: namespaces, DestinationRules: exportedResources.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: exportedResources.ServiceEntries}
		objectCheckers = []ObjectChecker{noServiceChecker, destinationRulesChecker}
	case kubernetes.ServiceEntries:
		serviceEntryChecker := checkers.ServiceEntryChecker{ServiceEntries: exportedResources.ServiceEntries, Namespaces: namespaces, WorkloadEntries: istioConfigList.WorkloadEntries}
		objectCheckers = []ObjectChecker{serviceEntryChecker}
	case kubernetes.Sidecars:
		sidecarsChecker := checkers.SidecarChecker{Sidecars: istioConfigList.Sidecars, Namespaces: namespaces,
			WorkloadList: workloads, ServiceEntries: exportedResources.ServiceEntries, RegistryServices: registryServices}
		objectCheckers = []ObjectChecker{sidecarsChecker}
	case kubernetes.AuthorizationPolicies:
		authPoliciesChecker := checkers.AuthorizationPolicyChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies,
			Namespace: namespace, Namespaces: namespaces, ServiceList: services, ServiceEntries: exportedResources.ServiceEntries,
			WorkloadList: workloads, MtlsDetails: mtlsDetails, VirtualServices: exportedResources.VirtualServices, RegistryServices: registryServices}
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

func (in *IstioValidationsService) fetchNamespaces(ctx context.Context, rValue *models.Namespaces, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		namespaces, err := in.businessLayer.Namespace.GetNamespaces(ctx)
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

func (in *IstioValidationsService) fetchServices(ctx context.Context, rValue *models.ServiceList, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		var services *models.ServiceList
		var err error
		criteria := ServiceCriteria{
			Namespace: namespace,
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

func (in *IstioValidationsService) fetchWorkloads(ctx context.Context, rValue *models.WorkloadList, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		criteria := WorkloadCriteria{Namespace: namespace, IncludeIstioResources: false}
		workloadList, err := in.businessLayer.Workload.GetWorkloadList(ctx, criteria)
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

func (in *IstioValidationsService) fetchAllWorkloads(ctx context.Context, rValue *map[string]models.WorkloadList, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		nss, err := in.businessLayer.Namespace.GetNamespaces(ctx)
		if err != nil {
			errChan <- err
			return

		}
		allWorkloads := map[string]models.WorkloadList{}
		for _, ns := range nss {
			criteria := WorkloadCriteria{Namespace: ns.Name, IncludeIstioResources: false}
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

func (in *IstioValidationsService) fetchIstioConfigList(ctx context.Context, rValue *models.IstioConfigList, namespace string, errChan chan error, wg *sync.WaitGroup) {
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
			IncludeWorkloadEntries:        true,
		}
		istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
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

func (in *IstioValidationsService) fetchExportedResources(ctx context.Context, exportedResources *kubernetes.ExportedResources, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) > 0 {
		return
	}

	criteria := IstioConfigCriteria{
		AllNamespaces:           true,
		IncludeGateways:         true,
		IncludeDestinationRules: true,
		IncludeServiceEntries:   true,
		IncludeVirtualServices:  true,
	}
	istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
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

	// All Gateways
	exportedResources.Gateways = istioConfigList.Gateways
}

func (in *IstioValidationsService) filterVSExportToNamespaces(namespace string, vs []networking_v1alpha3.VirtualService) []networking_v1alpha3.VirtualService {
	var result []networking_v1alpha3.VirtualService
	for _, v := range vs {
		if len(v.Spec.ExportTo) > 0 {
			for _, exportToNs := range v.Spec.ExportTo {
				// take only namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
				if checkExportTo(exportToNs, namespace, v.Namespace) {
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
				// take only namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
				if checkExportTo(exportToNs, namespace, d.Namespace) {
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
				// take only namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
				if checkExportTo(exportToNs, namespace, s.Namespace) {
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

func (in *IstioValidationsService) fetchNonLocalmTLSConfigs(ctx context.Context, mtlsDetails *kubernetes.MTLSDetails, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) > 0 {
		return
	}

	wg.Add(3)

	go func(details *kubernetes.MTLSDetails) {
		defer wg.Done()
		criteria := IstioConfigCriteria{
			Namespace:                  config.Get().ExternalServices.Istio.RootNamespace,
			IncludePeerAuthentications: true,
		}
		istioConfig, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
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
		istioConfig, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
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

	namespaces, err := in.businessLayer.Namespace.GetNamespaces(ctx)
	if err != nil {
		errChan <- err
		return
	}

	nsNames := make([]string, 0, len(namespaces))
	for _, ns := range namespaces {
		nsNames = append(nsNames, ns.Name)
	}

	destinationRules, err := in.businessLayer.TLS.GetAllDestinationRules(ctx, nsNames)
	if err != nil {
		errChan <- err
	} else {
		mtlsDetails.DestinationRules = in.filterDRExportToNamespaces(namespace, destinationRules)
	}
}

func (in *IstioValidationsService) fetchAuthorizationDetails(ctx context.Context, rValue *kubernetes.RBACDetails, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		criteria := IstioConfigCriteria{
			Namespace:                    namespace,
			IncludeAuthorizationPolicies: true,
		}
		istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
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

func (in *IstioValidationsService) fetchRegistryServices(rValue *[]*kubernetes.RegistryService, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	criteria := RegistryCriteria{AllNamespaces: true}
	registryServices, err := in.businessLayer.RegistryStatus.GetRegistryServices(criteria)
	if err != nil {
		select {
		case errChan <- err:
		default:
		}
	} else {
		*rValue = registryServices
	}
}

var (
	// used with checkForbidden - if a caller is in the map, its forbidden warning message was already logged
	forbiddenCaller map[string]bool = map[string]bool{}
)

func checkExportTo(exportToNs string, namespace string, ownNs string) bool {
	// check if namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
	return exportToNs == "*" || exportToNs == namespace || (exportToNs == "." && ownNs == namespace)
}

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
