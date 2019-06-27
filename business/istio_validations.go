package business

import (
	"fmt"
	"sync"

	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

type IstioValidationsService struct {
	k8s           kubernetes.IstioClientInterface
	businessLayer *Layer
}

type ObjectChecker interface {
	Check() models.IstioValidations
}

// GetValidations returns an IstioValidations object with all the checks found when running
// all the enabled checkers. If service is "" then the whole namespace is validated.
func (in *IstioValidationsService) GetValidations(namespace, service string) (models.IstioValidations, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioValidationsService", "GetValidations")
	defer promtimer.ObserveNow(&err)

	// Ensure the service or namespace exists.. do we need to block with this?
	if service != "" {
		if _, err := in.k8s.GetService(namespace, service); err != nil {
			return nil, err
		}
	} else {
		if _, err := in.k8s.GetNamespace(namespace); err != nil {
			return nil, err
		}
	}

	wg := sync.WaitGroup{}
	errChan := make(chan error, 1)

	var istioDetails kubernetes.IstioDetails
	var services []core_v1.Service
	var workloads models.WorkloadList
	var gatewaysPerNamespace [][]kubernetes.IstioObject
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails
	var deployments []apps_v1.Deployment

	wg.Add(6) // We need to add these here to make sure we don't execute wg.Wait() before scheduler has started goroutines

	if service != "" {
		// These resources are not used if no service is targetted
		wg.Add(1)
		go in.fetchDeployments(&deployments, namespace, errChan, &wg)
	}

	// We fetch without target service as some validations will require full-namespace details
	go in.fetchDetails(&istioDetails, namespace, errChan, &wg)
	go in.fetchWorkloads(&workloads, namespace, errChan, &wg)
	go in.fetchGatewaysPerNamespace(&gatewaysPerNamespace, errChan, &wg)
	go in.fetchNonLocalmTLSConfigs(&mtlsDetails, namespace, errChan, &wg)
	go in.fetchAuthorizationDetails(&rbacDetails, namespace, errChan, &wg)
	go in.fetchServices(&services, namespace, errChan, &wg)

	wg.Wait()
	close(errChan)
	for e := range errChan {
		if e != nil { // Check that default value wasn't returned
			return nil, err
		}
	}

	objectCheckers := in.getAllObjectCheckers(namespace, istioDetails, services, workloads, gatewaysPerNamespace, mtlsDetails, rbacDetails)

	if service != "" {
		objectCheckers = append(objectCheckers, in.getServiceCheckers(namespace, services, deployments)...)
	}

	// Get group validations for same kind istio objects
	validations := runObjectCheckers(objectCheckers)
	if service != "" {
		validations = validations.FilterBySingleType("service", service)
	}

	return validations, nil
}

func (in *IstioValidationsService) getServiceCheckers(namespace string, services []core_v1.Service, deployments []apps_v1.Deployment) []ObjectChecker {
	return []ObjectChecker{
		checkers.ServiceChecker{Services: services, Deployments: deployments},
	}
}

func (in *IstioValidationsService) getAllObjectCheckers(namespace string, istioDetails kubernetes.IstioDetails, services []core_v1.Service, workloads models.WorkloadList, gatewaysPerNamespace [][]kubernetes.IstioObject, mtlsDetails kubernetes.MTLSDetails, rbacDetails kubernetes.RBACDetails) []ObjectChecker {
	return []ObjectChecker{
		checkers.NoServiceChecker{Namespace: namespace, IstioDetails: &istioDetails, Services: services, WorkloadList: workloads, GatewaysPerNamespace: gatewaysPerNamespace, AuthorizationDetails: &rbacDetails},
		checkers.VirtualServiceChecker{Namespace: namespace, DestinationRules: istioDetails.DestinationRules, VirtualServices: istioDetails.VirtualServices},
		checkers.DestinationRulesChecker{DestinationRules: istioDetails.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: istioDetails.ServiceEntries},
		checkers.GatewayChecker{GatewaysPerNamespace: gatewaysPerNamespace, Namespace: namespace, WorkloadList: workloads},
		checkers.MeshPolicyChecker{MeshPolicies: mtlsDetails.MeshPolicies, MTLSDetails: mtlsDetails},
		checkers.PolicyChecker{Policies: mtlsDetails.Policies, MTLSDetails: mtlsDetails},
		checkers.ServiceEntryChecker{ServiceEntries: istioDetails.ServiceEntries},
		checkers.ServiceRoleBindChecker{RBACDetails: rbacDetails},
	}
}

func (in *IstioValidationsService) GetIstioObjectValidations(namespace string, objectType string, object string) (models.IstioValidations, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "IstioValidationsService", "GetIstioObjectValidations")
	defer promtimer.ObserveNow(&err)

	var istioDetails kubernetes.IstioDetails
	var services []core_v1.Service
	var workloads models.WorkloadList
	var gatewaysPerNamespace [][]kubernetes.IstioObject
	var mtlsDetails kubernetes.MTLSDetails
	var rbacDetails kubernetes.RBACDetails

	var objectCheckers []ObjectChecker

	wg := sync.WaitGroup{}
	errChan := make(chan error, 1)

	// Get all the Istio objects from a Namespace and all gateways from every namespace
	wg.Add(6)
	go in.fetchDetails(&istioDetails, namespace, errChan, &wg)
	go in.fetchServices(&services, namespace, errChan, &wg)
	go in.fetchWorkloads(&workloads, namespace, errChan, &wg)
	go in.fetchGatewaysPerNamespace(&gatewaysPerNamespace, errChan, &wg)
	go in.fetchNonLocalmTLSConfigs(&mtlsDetails, namespace, errChan, &wg)
	go in.fetchAuthorizationDetails(&rbacDetails, namespace, errChan, &wg)
	wg.Wait()

	noServiceChecker := checkers.NoServiceChecker{Namespace: namespace, IstioDetails: &istioDetails, Services: services, WorkloadList: workloads, GatewaysPerNamespace: gatewaysPerNamespace, AuthorizationDetails: &rbacDetails}

	switch objectType {
	case Gateways:
		objectCheckers = []ObjectChecker{
			checkers.GatewayChecker{GatewaysPerNamespace: gatewaysPerNamespace, Namespace: namespace, WorkloadList: workloads},
		}
	case VirtualServices:
		virtualServiceChecker := checkers.VirtualServiceChecker{Namespace: namespace, VirtualServices: istioDetails.VirtualServices, DestinationRules: istioDetails.DestinationRules}
		objectCheckers = []ObjectChecker{noServiceChecker, virtualServiceChecker}
	case DestinationRules:
		destinationRulesChecker := checkers.DestinationRulesChecker{DestinationRules: istioDetails.DestinationRules, MTLSDetails: mtlsDetails, ServiceEntries: istioDetails.ServiceEntries}
		objectCheckers = []ObjectChecker{noServiceChecker, destinationRulesChecker}
	case MeshPolicies:
		meshPoliciesChecker := checkers.MeshPolicyChecker{MeshPolicies: mtlsDetails.MeshPolicies, MTLSDetails: mtlsDetails}
		objectCheckers = []ObjectChecker{meshPoliciesChecker}
	case Policies:
		policiesChecker := checkers.PolicyChecker{Policies: mtlsDetails.Policies, MTLSDetails: mtlsDetails}
		objectCheckers = []ObjectChecker{policiesChecker}
	case ServiceEntries:
		serviceEntryChecker := checkers.ServiceEntryChecker{ServiceEntries: istioDetails.ServiceEntries}
		objectCheckers = []ObjectChecker{serviceEntryChecker}
	case Rules:
		// Validations on Istio Rules are not yet in place
	case Templates:
		// Validations on Templates are not yet in place
		// TODO Support subtypes
	case Adapters:
		// Validations on Adapters are not yet in place
		// TODO Support subtypes
	case QuotaSpecs:
		// Validations on QuotaSpecs are not yet in place
	case QuotaSpecBindings:
		// Validations on QuotaSpecBindings are not yet in place
	case ClusterRbacConfigs:
		// Validations on ClusterRbacConfigs are not yet in place
	case RbacConfigs:
		// Validations on RbacConfigs are not yet in place
	case ServiceRoles:
		objectCheckers = []ObjectChecker{noServiceChecker}
	case ServiceRoleBindings:
		roleBindChecker := checkers.ServiceRoleBindChecker{RBACDetails: rbacDetails}
		objectCheckers = []ObjectChecker{roleBindChecker}
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
		objectTypeValidations.MergeValidations(objectChecker.Check())
	}

	return objectTypeValidations
}

// The following idea is used underneath: if errChan has at least one record, we'll effectively cancel the request (if scheduled in such order). On the other hand, if we can't
// write to the buffered errChan, we just ignore the error as select does not block even if channel is full. This is because a single error is enough to cancel the whole request.

func (in *IstioValidationsService) fetchGatewaysPerNamespace(gatewaysPerNamespace *[][]kubernetes.IstioObject, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if nss, err := in.businessLayer.Namespace.GetNamespaces(); err == nil {
		gwss := make([][]kubernetes.IstioObject, len(nss))
		for i := range nss {
			gwss[i] = make([]kubernetes.IstioObject, 0)
		}
		*gatewaysPerNamespace = gwss

		wg.Add(len(nss))
		for i, ns := range nss {
			go fetchNoEntry(&gwss[i], ns.Name, in.k8s.GetGateways, wg, errChan)
		}
	} else {
		select {
		case errChan <- err:
		default:
		}
	}
}

func fetchNoEntry(rValue *[]kubernetes.IstioObject, namespace string, fetcher func(string) ([]kubernetes.IstioObject, error), wg *sync.WaitGroup, errChan chan error) {
	defer wg.Done()
	if len(errChan) == 0 {
		fetched, err := fetcher(namespace)
		if err != nil {
			select {
			case errChan <- err:
			default:
			}
		} else {
			*rValue = append(*rValue, fetched...)
		}
	}
}

func (in *IstioValidationsService) fetchServices(rValue *[]core_v1.Service, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		services, err := in.k8s.GetServices(namespace, nil)
		if err != nil {
			select {
			case errChan <- err:
			default:
			}
		} else {
			*rValue = services
		}
	}
}

func (in *IstioValidationsService) fetchDeployments(rValue *[]apps_v1.Deployment, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		deployments, err := in.k8s.GetDeployments(namespace)
		if err != nil {
			select {
			case errChan <- err:
			default:
			}
		} else {
			*rValue = deployments
		}
	}
}

func (in *IstioValidationsService) fetchWorkloads(rValue *models.WorkloadList, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		workloadList, err := in.businessLayer.Workload.GetWorkloadList(namespace)
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

func (in *IstioValidationsService) fetchDetails(rValue *kubernetes.IstioDetails, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) == 0 {
		istioDetails, err := in.k8s.GetIstioDetails(namespace, "")
		if err != nil {
			select {
			case errChan <- err:
			default:
			}
		} else {
			*rValue = *istioDetails
		}
	}
}

func (in *IstioValidationsService) fetchNonLocalmTLSConfigs(mtlsDetails *kubernetes.MTLSDetails, namespace string, errChan chan error, wg *sync.WaitGroup) {
	defer wg.Done()
	if len(errChan) > 0 {
		return
	}

	wg.Add(2)

	go func(details *kubernetes.MTLSDetails) {
		defer wg.Done()

		meshPolicies, err := in.k8s.GetMeshPolicies(namespace)
		if err != nil {
			errChan <- err
		} else {
			details.MeshPolicies = meshPolicies
		}
	}(mtlsDetails)

	go func(details *kubernetes.MTLSDetails) {
		defer wg.Done()

		policies, err := in.k8s.GetPolicies(namespace)
		if err != nil {
			errChan <- err
		} else {
			details.Policies = policies
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
		authDetails, err := in.k8s.GetAuthorizationDetails(namespace)
		if err != nil {
			select {
			case errChan <- err:
			default:
			}
		} else {
			*rValue = *authDetails
		}
	}
}
