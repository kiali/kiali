package business

import (
	"context"
	"fmt"
	"sync"

	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"
	core_v1 "k8s.io/api/core/v1"

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
	k8s           kubernetes.ClientInterface
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
func (in *IstioValidationsService) GetValidations(ctx context.Context, namespace, service, workload string) (models.IstioValidations, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetValidations",
		observability.Attribute("package", "business"),
		observability.Attribute("namespace", namespace),
		observability.Attribute("service", service),
		observability.Attribute("workload", workload),
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
	var services models.ServiceList
	var namespaces models.Namespaces
	var workloadsPerNamespace map[string]models.WorkloadList
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails
	var registryServices []*kubernetes.RegistryService

	wg.Add(4) // We need to add these here to make sure we don't execute wg.Wait() before scheduler has started goroutines
	if service != "" {
		wg.Add(1)
	}

	// We fetch without target service as some validations will require full-namespace details
	go in.fetchIstioConfigList(ctx, &istioConfigList, &mtlsDetails, &rbacDetails, namespace, errChan, &wg)
	go in.fetchAllWorkloads(ctx, &workloadsPerNamespace, &namespaces, errChan, &wg)
	go in.fetchNonLocalmTLSConfigs(&mtlsDetails, errChan, &wg)
	if service != "" {
		go in.fetchServices(ctx, &services, namespace, errChan, &wg)
	}
	go in.fetchRegistryServices(&registryServices, errChan, &wg)

	wg.Wait()
	close(errChan)
	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			return nil, e
		}
	}

	objectCheckers := in.getAllObjectCheckers(namespace, istioConfigList, workloadsPerNamespace, mtlsDetails, rbacDetails, namespaces, registryServices)

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

func (in *IstioValidationsService) getAllObjectCheckers(namespace string, istioConfigList models.IstioConfigList, workloadsPerNamespace map[string]models.WorkloadList, mtlsDetails kubernetes.MTLSDetails, rbacDetails kubernetes.RBACDetails, namespaces []models.Namespace, registryServices []*kubernetes.RegistryService) []ObjectChecker {
	return []ObjectChecker{
		checkers.NoServiceChecker{Namespace: namespace, Namespaces: namespaces, IstioConfigList: &istioConfigList, WorkloadsPerNamespace: workloadsPerNamespace, AuthorizationDetails: &rbacDetails, RegistryServices: registryServices},
		checkers.VirtualServiceChecker{Namespace: namespace, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules},
		checkers.DestinationRulesChecker{Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: istioConfigList.ServiceEntries},
		checkers.GatewayChecker{Gateways: istioConfigList.Gateways, Namespace: namespace, WorkloadsPerNamespace: workloadsPerNamespace, IsGatewayToNamespace: in.isGatewayToNamespace()},
		checkers.PeerAuthenticationChecker{PeerAuthentications: mtlsDetails.PeerAuthentications, MTLSDetails: mtlsDetails, WorkloadList: workloadsPerNamespace[namespace]},
		checkers.ServiceEntryChecker{ServiceEntries: istioConfigList.ServiceEntries, Namespaces: namespaces, WorkloadEntries: istioConfigList.WorkloadEntries},
		checkers.AuthorizationPolicyChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespace: namespace, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, WorkloadList: workloadsPerNamespace[namespace], MtlsDetails: mtlsDetails, VirtualServices: istioConfigList.VirtualServices, RegistryServices: registryServices},
		checkers.SidecarChecker{Sidecars: istioConfigList.Sidecars, Namespaces: namespaces, WorkloadList: workloadsPerNamespace[namespace], ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices},
		checkers.RequestAuthenticationChecker{RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadList: workloadsPerNamespace[namespace]},
		checkers.WorkloadChecker{Namespace: namespace, AuthorizationPolicies: rbacDetails.AuthorizationPolicies, WorkloadList: workloadsPerNamespace[namespace]},
	}
}

// GetIstioObjectValidations validates a single Istio object of the given type with the given name found in the given namespace.
func (in *IstioValidationsService) GetIstioObjectValidations(ctx context.Context, namespace string, objectType string, object string) (models.IstioValidations, models.IstioReferencesMap, error) {
	var end observability.EndFunc
	ctx, end = observability.StartSpan(ctx, "GetIstioObjectValidations",
		observability.Attribute("package", "business"),
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

	// Check if user has access to the namespace (RBAC) in cache scenarios and/or
	// if namespace is accessible from Kiali (Deployment.AccessibleNamespaces)
	if _, err = in.businessLayer.Namespace.GetNamespace(ctx, namespace); err != nil {
		return nil, istioReferences, err
	}

	// time this function execution so we can capture how long it takes to fully validate this istio object
	timer := internalmetrics.GetSingleValidationProcessingTimePrometheusTimer(namespace, objectType, object)
	defer timer.ObserveDuration()

	wg := sync.WaitGroup{}
	errChan := make(chan error, 1)

	// Get all the Istio objects from a Namespace and all gateways from every namespace
	wg.Add(4)
	go in.fetchIstioConfigList(ctx, &istioConfigList, &mtlsDetails, &rbacDetails, namespace, errChan, &wg)
	go in.fetchAllWorkloads(ctx, &workloadsPerNamespace, &namespaces, errChan, &wg)
	go in.fetchNonLocalmTLSConfigs(&mtlsDetails, errChan, &wg)
	go in.fetchRegistryServices(&registryServices, errChan, &wg)
	wg.Wait()

	noServiceChecker := checkers.NoServiceChecker{Namespace: namespace, Namespaces: namespaces, IstioConfigList: &istioConfigList, WorkloadsPerNamespace: workloadsPerNamespace, AuthorizationDetails: &rbacDetails, RegistryServices: registryServices}

	switch objectType {
	case kubernetes.Gateways:
		objectCheckers = []ObjectChecker{
			checkers.GatewayChecker{Gateways: istioConfigList.Gateways, Namespace: namespace, WorkloadsPerNamespace: workloadsPerNamespace, IsGatewayToNamespace: in.isGatewayToNamespace()},
		}
		referenceChecker = references.GatewayReferences{Gateways: istioConfigList.Gateways, VirtualServices: istioConfigList.VirtualServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.VirtualServices:
		virtualServiceChecker := checkers.VirtualServiceChecker{Namespace: namespace, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules}
		objectCheckers = []ObjectChecker{noServiceChecker, virtualServiceChecker}
		referenceChecker = references.VirtualServiceReferences{Namespace: namespace, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, DestinationRules: istioConfigList.DestinationRules, AuthorizationPolicies: rbacDetails.AuthorizationPolicies}
	case kubernetes.DestinationRules:
		destinationRulesChecker := checkers.DestinationRulesChecker{Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: istioConfigList.ServiceEntries}
		objectCheckers = []ObjectChecker{noServiceChecker, destinationRulesChecker}
		referenceChecker = references.DestinationRuleReferences{Namespace: namespace, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, VirtualServices: istioConfigList.VirtualServices, WorkloadsPerNamespace: workloadsPerNamespace, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices}
	case kubernetes.ServiceEntries:
		serviceEntryChecker := checkers.ServiceEntryChecker{ServiceEntries: istioConfigList.ServiceEntries, Namespaces: namespaces, WorkloadEntries: istioConfigList.WorkloadEntries}
		objectCheckers = []ObjectChecker{serviceEntryChecker}
		referenceChecker = references.ServiceEntryReferences{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespace: namespace, Namespaces: namespaces, DestinationRules: istioConfigList.DestinationRules, ServiceEntries: istioConfigList.ServiceEntries, Sidecars: istioConfigList.Sidecars, RegistryServices: registryServices}
	case kubernetes.Sidecars:
		sidecarsChecker := checkers.SidecarChecker{Sidecars: istioConfigList.Sidecars, Namespaces: namespaces,
			WorkloadList: workloadsPerNamespace[namespace], ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices}
		objectCheckers = []ObjectChecker{sidecarsChecker}
		referenceChecker = references.SidecarReferences{Sidecars: istioConfigList.Sidecars, Namespace: namespace, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.AuthorizationPolicies:
		authPoliciesChecker := checkers.AuthorizationPolicyChecker{AuthorizationPolicies: rbacDetails.AuthorizationPolicies,
			Namespace: namespace, Namespaces: namespaces, ServiceEntries: istioConfigList.ServiceEntries,
			WorkloadList: workloadsPerNamespace[namespace], MtlsDetails: mtlsDetails, VirtualServices: istioConfigList.VirtualServices, RegistryServices: registryServices}
		objectCheckers = []ObjectChecker{authPoliciesChecker}
		referenceChecker = references.AuthorizationPolicyReferences{AuthorizationPolicies: rbacDetails.AuthorizationPolicies, Namespace: namespace, Namespaces: namespaces, VirtualServices: istioConfigList.VirtualServices, ServiceEntries: istioConfigList.ServiceEntries, RegistryServices: registryServices, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.PeerAuthentications:
		// Validations on PeerAuthentications
		peerAuthnChecker := checkers.PeerAuthenticationChecker{PeerAuthentications: mtlsDetails.PeerAuthentications, MTLSDetails: mtlsDetails, WorkloadList: workloadsPerNamespace[namespace]}
		objectCheckers = []ObjectChecker{peerAuthnChecker}
		referenceChecker = references.PeerAuthReferences{MTLSDetails: mtlsDetails, WorkloadsPerNamespace: workloadsPerNamespace}
	case kubernetes.WorkloadEntries:
		// Validation on WorkloadEntries are not yet in place
	case kubernetes.WorkloadGroups:
		// Validation on WorkloadGroups are not yet in place
	case kubernetes.RequestAuthentications:
		// Validation on RequestAuthentications are not yet in place
		requestAuthnChecker := checkers.RequestAuthenticationChecker{RequestAuthentications: istioConfigList.RequestAuthentications, WorkloadList: workloadsPerNamespace[namespace]}
		objectCheckers = []ObjectChecker{requestAuthnChecker}
	case kubernetes.EnvoyFilters:
		// Validation on EnvoyFilters are not yet in place
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

func (in *IstioValidationsService) fetchServices(ctx context.Context, rValue *models.ServiceList, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		var services *models.ServiceList
		var err error
		criteria := ServiceCriteria{
			Namespace: namespace,
			Health:    false,
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

func (in *IstioValidationsService) fetchAllWorkloads(ctx context.Context, rValue *map[string]models.WorkloadList, namespaces *models.Namespaces, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		nss, err := in.businessLayer.Namespace.GetNamespaces(ctx)
		if err != nil {
			errChan <- err
			return

		}
		*namespaces = nss

		allWorkloads := map[string]models.WorkloadList{}
		for _, ns := range nss {
			criteria := WorkloadCriteria{Namespace: ns.Name, IncludeIstioResources: true, IncludeHealth: false}
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

func (in *IstioValidationsService) fetchIstioConfigList(ctx context.Context, rValue *models.IstioConfigList, mtlsDetails *kubernetes.MTLSDetails, rbacDetails *kubernetes.RBACDetails, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) > 0 {
		return
	}

	criteria := IstioConfigCriteria{
		AllNamespaces:                 true,
		IncludeGateways:               true,
		IncludeDestinationRules:       true,
		IncludeServiceEntries:         true,
		IncludeVirtualServices:        true,
		IncludeSidecars:               true,
		IncludeRequestAuthentications: true,
		IncludeWorkloadEntries:        true,
		IncludeAuthorizationPolicies:  true,
		IncludePeerAuthentications:    true,
	}
	istioConfigList, err := in.businessLayer.IstioConfig.GetIstioConfigList(ctx, criteria)
	if err != nil {
		errChan <- err
		return
	}
	// Filter VS
	filteredVSs := in.filterVSExportToNamespaces(namespace, istioConfigList.VirtualServices)
	rValue.VirtualServices = append(rValue.VirtualServices, filteredVSs...)

	// Filter DR
	filteredDRs := in.filterDRExportToNamespaces(namespace, istioConfigList.DestinationRules)
	rValue.DestinationRules = append(rValue.DestinationRules, filteredDRs...)
	mtlsDetails.DestinationRules = append(mtlsDetails.DestinationRules, filteredDRs...)

	// Filter SE
	filteredSEs := in.filterSEExportToNamespaces(namespace, istioConfigList.ServiceEntries)
	rValue.ServiceEntries = append(rValue.ServiceEntries, filteredSEs...)

	// All Gateways
	rValue.Gateways = append(rValue.Gateways, istioConfigList.Gateways...)

	// All Sidecars
	rValue.Sidecars = append(rValue.Sidecars, istioConfigList.Sidecars...)

	// All RequestAuthentications
	rValue.RequestAuthentications = append(rValue.RequestAuthentications, istioConfigList.RequestAuthentications...)

	// All WorkloadEntries
	rValue.WorkloadEntries = append(rValue.WorkloadEntries, istioConfigList.WorkloadEntries...)

	in.filterPeerAuths(namespace, mtlsDetails, istioConfigList.PeerAuthentications)

	in.filterAuthPolicies(namespace, rbacDetails, istioConfigList.AuthorizationPolicies)
}

func (in *IstioValidationsService) filterPeerAuths(namespace string, mtlsDetails *kubernetes.MTLSDetails, peerAuths []security_v1beta.PeerAuthentication) {
	rootNs := config.Get().ExternalServices.Istio.RootNamespace
	for _, pa := range peerAuths {
		if pa.Namespace == rootNs {
			mtlsDetails.MeshPeerAuthentications = append(mtlsDetails.MeshPeerAuthentications, pa)
		}
		if pa.Namespace == namespace {
			mtlsDetails.PeerAuthentications = append(mtlsDetails.PeerAuthentications, pa)
		}
	}
}

func (in *IstioValidationsService) filterAuthPolicies(namespace string, rbacDetails *kubernetes.RBACDetails, authPolicies []security_v1beta.AuthorizationPolicy) {
	for _, ap := range authPolicies {
		if ap.Namespace == namespace {
			rbacDetails.AuthorizationPolicies = append(rbacDetails.AuthorizationPolicies, ap)
		}
	}
}

func (in *IstioValidationsService) filterVSExportToNamespaces(namespace string, vs []networking_v1beta1.VirtualService) []networking_v1beta1.VirtualService {
	var result []networking_v1beta1.VirtualService
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

func (in *IstioValidationsService) filterDRExportToNamespaces(namespace string, dr []networking_v1beta1.DestinationRule) []networking_v1beta1.DestinationRule {
	var result []networking_v1beta1.DestinationRule
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

func (in *IstioValidationsService) filterSEExportToNamespaces(namespace string, se []networking_v1beta1.ServiceEntry) []networking_v1beta1.ServiceEntry {
	var result []networking_v1beta1.ServiceEntry
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

func (in *IstioValidationsService) fetchNonLocalmTLSConfigs(mtlsDetails *kubernetes.MTLSDetails, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) > 0 {
		return
	}

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
		mtlsDetails.EnabledAutoMtls = icm.GetEnableAutoMtls()
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

func (in *IstioValidationsService) isGatewayToNamespace() bool {
	gatewayToNamespace := false
	if in.businessLayer != nil {
		if cluster, err := in.businessLayer.Mesh.ResolveKialiControlPlaneCluster(nil); err == nil {
			if cluster != nil {
				gatewayToNamespace = cluster.IsGatewayToNamespace
			} else {
				log.Debug("No GatewayToNamespace is set in the istiod environment variables. Using default GatewayToNamespace: false")
			}
		} else {
			log.Errorf("GatewayToNamespace resolution failed: %s", err)
		}
	}
	return gatewayToNamespace
}

func checkExportTo(exportToNs string, namespace string, ownNs string) bool {
	// check if namespaces where it is exported to, or if it is exported to all namespaces, or export to own namespace
	return exportToNs == "*" || exportToNs == namespace || (exportToNs == "." && ownNs == namespace)
}
