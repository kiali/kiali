package business

import (
	"sync"
	"time"

	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/internalmetrics"
)

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type SvcService struct {
	prom          prometheus.ClientInterface
	k8s           kubernetes.IstioClientInterface
	businessLayer *Layer
}

// GetServiceList returns a list of all services for a given Namespace
func (in *SvcService) GetServiceList(namespace string) (*models.ServiceList, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "SvcService", "GetServiceList")
	defer promtimer.ObserveNow(&err)

	var svcs []core_v1.Service
	var pods []core_v1.Pod
	var deployments []apps_v1.Deployment

	wg := sync.WaitGroup{}
	wg.Add(3)
	errChan := make(chan error, 2)

	go func() {
		defer wg.Done()
		var err2 error
		svcs, err2 = in.k8s.GetServices(namespace, nil)
		if err2 != nil {
			log.Errorf("Error fetching Services per namespace %s: %s", namespace, err2)
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		pods, err2 = in.k8s.GetPods(namespace, "")
		if err2 != nil {
			log.Errorf("Error fetching Pods per namespace %s: %s", namespace, err2)
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		deployments, err = in.k8s.GetDeployments(namespace)
		if err != nil {
			log.Errorf("Error fetching Deployments per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return nil, err
	}

	// Convert to Kiali model
	return in.buildServiceList(models.Namespace{Name: namespace}, svcs, pods, deployments), nil
}

func (in *SvcService) buildServiceList(namespace models.Namespace, svcs []core_v1.Service, pods []core_v1.Pod, deployments []apps_v1.Deployment) *models.ServiceList {
	services := make([]models.ServiceOverview, len(svcs))
	conf := config.Get()
	validations := in.getServiceValidations(svcs, deployments)
	// Convert each k8s service into our model
	for i, item := range svcs {
		sPods := kubernetes.FilterPodsForService(&item, pods)
		/** Check if Service has istioSidecar deployed */
		mPods := models.Pods{}
		mPods.Parse(sPods)
		hasSidecar := mPods.HasIstioSidecar()
		/** Check if Service has the label app required by Istio */
		_, appLabel := item.Spec.Selector[conf.IstioLabels.AppLabelName]
		services[i] = models.ServiceOverview{
			Name:         item.Name,
			IstioSidecar: hasSidecar,
			AppLabel:     appLabel,
		}
	}

	return &models.ServiceList{Namespace: namespace, Services: services, Validations: validations}
}

// GetService returns a single service and associated data using the interval and queryTime
func (in *SvcService) GetService(namespace, service, interval string, queryTime time.Time, requestToken string) (*models.ServiceDetails, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "SvcService", "GetService")
	defer promtimer.ObserveNow(&err)

	svc, eps, err := in.getServiceDefinition(namespace, service)
	if err != nil {
		return nil, err
	}

	var pods []core_v1.Pod
	var hth models.ServiceHealth
	var vs, dr []kubernetes.IstioObject
	var ws models.Workloads
	var nsmtls models.MTLSStatus

	wg := sync.WaitGroup{}
	wg.Add(7)
	errChan := make(chan error, 6)

	labelsSelector := labels.Set(svc.Spec.Selector).String()
	// If service doesn't have any selector, we can't know which are the pods and workloads applying.
	if labelsSelector != "" {
		wg.Add(2)

		go func() {
			defer wg.Done()
			var err2 error
			pods, err2 = in.k8s.GetPods(namespace, labelsSelector)
			if err2 != nil {
				errChan <- err2
			}
		}()

		go func() {
			defer wg.Done()
			var err2 error
			ws, err2 = fetchWorkloads(in.k8s, namespace, labelsSelector)
			if err2 != nil {
				log.Errorf("Error fetching Workloads per namespace %s and service %s: %s", namespace, service, err2)
				errChan <- err2
			}
		}()
	}

	go func() {
		defer wg.Done()
		var err2 error
		hth, err2 = in.businessLayer.Health.GetServiceHealth(namespace, service, interval, queryTime)
		if err2 != nil {
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		nsmtls, err2 = in.businessLayer.TLS.NamespaceWidemTLSStatus(namespace)
		if err2 != nil {
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		vs, err2 = in.k8s.GetVirtualServices(namespace, service)
		if err2 != nil {
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		dr, err2 = in.k8s.GetDestinationRules(namespace, service)
		if err2 != nil {
			errChan <- err2
		}
	}()

	var vsCreate, vsUpdate, vsDelete bool
	go func() {
		defer wg.Done()
		vsCreate, vsUpdate, vsDelete = getPermissions(in.k8s, namespace, VirtualServices, "")
	}()

	var drCreate, drUpdate, drDelete bool
	go func() {
		defer wg.Done()
		drCreate, drUpdate, drDelete = getPermissions(in.k8s, namespace, DestinationRules, "")
	}()

	var eTraces int
	go func() {
		// Maybe a future jaeger business layer
		defer wg.Done()
		eTraces, err = getErrorTracesFromJaeger(namespace, service, requestToken)
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return nil, err
	}

	wo := models.WorkloadOverviews{}
	for _, w := range ws {
		wi := &models.WorkloadListItem{}
		wi.ParseWorkload(w)
		wo = append(wo, wi)
	}

	s := models.ServiceDetails{Workloads: wo, Health: hth, NamespaceMTLS: nsmtls}
	s.SetService(svc)
	s.SetPods(kubernetes.FilterPodsForEndpoints(eps, pods))
	s.SetEndpoints(eps)
	s.SetVirtualServices(vs, vsCreate, vsUpdate, vsDelete)
	s.SetDestinationRules(dr, drCreate, drUpdate, drDelete)
	s.SetErrorTraces(eTraces)
	return &s, nil
}

// GetServiceDefinition returns a single service definition (the service object and endpoints), no istio or runtime information
func (in *SvcService) GetServiceDefinition(namespace, service string) (*models.ServiceDetails, error) {
	var err error
	promtimer := internalmetrics.GetGoFunctionMetric("business", "SvcService", "GetServiceDefinition")
	defer promtimer.ObserveNow(&err)

	svc, eps, err := in.getServiceDefinition(namespace, service)
	if err != nil {
		return nil, err
	}

	s := models.ServiceDetails{}
	s.SetService(svc)
	s.SetEndpoints(eps)
	return &s, nil
}

func (in *SvcService) getServiceDefinition(namespace, service string) (svc *core_v1.Service, eps *core_v1.Endpoints, err error) {
	wg := sync.WaitGroup{}
	wg.Add(2)
	errChan := make(chan error, 2)

	go func() {
		defer wg.Done()
		var err2 error
		svc, err2 = in.k8s.GetService(namespace, service)
		if err2 != nil {
			log.Errorf("Error fetching Service per namespace %s and service %s: %s", namespace, service, err2)
			errChan <- err2
		}
	}()

	go func() {
		defer wg.Done()
		var err2 error
		eps, err2 = in.k8s.GetEndpoints(namespace, service)
		if err2 != nil && !errors.IsNotFound(err2) {
			log.Errorf("Error fetching Endpoints per namespace %s and service %s: %s", namespace, service, err2)
			errChan <- err2
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err = <-errChan
		return nil, nil, err
	}

	return svc, eps, nil
}

func (in *SvcService) getServiceValidations(services []core_v1.Service, deployments []apps_v1.Deployment) models.IstioValidations {
	validations := checkers.ServiceChecker{
		Services:    services,
		Deployments: deployments,
	}.Check()

	return validations
}
