package business

import (
	"k8s.io/api/apps/v1beta1"
	"sync"

	"k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/services/models"
)

// SvcService deals with fetching istio/kubernetes services related content and convert to kiali model
type SvcService struct {
	prom   prometheus.ClientInterface
	k8s    kubernetes.IstioClientInterface
	health *HealthService
}

// GetServiceList returns a list of all services for a given Namespace
func (in *SvcService) GetServiceList(namespace string) (*models.ServiceList, error) {

	var sl *v1.ServiceList
	var pl *v1.PodList

	wg := sync.WaitGroup{}
	wg.Add(2)
	errChan := make(chan error, 2)

	go func() {
		defer wg.Done()
		var err error
		sl, err = in.k8s.GetServices(namespace, nil)
		if err != nil {
			log.Errorf("Error fetching Services per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		pl, err = in.k8s.GetPods(namespace, "")
		if err != nil {
			log.Errorf("Error fetching Pods per namespace %s: %s", namespace, err)
			errChan <- err
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err := <-errChan
		return nil, err
	}

	// Convert to Kiali model
	return in.buildServiceList(models.Namespace{Name: namespace}, sl, pl), nil
}

func (in *SvcService) buildServiceList(namespace models.Namespace, sl *v1.ServiceList, pl *v1.PodList) *models.ServiceList {
	services := make([]models.ServiceOverview, len(sl.Items))
	conf := config.Get()
	// Convert each k8s service into our model
	for i, item := range sl.Items {
		sPods := kubernetes.FilterPodsForService(&item, pl.Items)
		/** Check if Service has istioSidecar deployed */
		mPods := models.Pods{}
		mPods.Parse(sPods)
		hasSideCar := mPods.HasIstioSideCar()
		/** Check if Service has the label app required by Istio */
		_, appLabel := item.Spec.Selector[conf.IstioLabels.AppLabelName]
		services[i] = models.ServiceOverview{
			Name:         item.Name,
			IstioSidecar: hasSideCar,
			AppLabel:     appLabel,
		}
	}

	return &models.ServiceList{Namespace: namespace, Services: services}
}

// GetService returns a single service
func (in *SvcService) GetService(namespace, service, interval string) (*models.ServiceDetails, error) {

	var svc *v1.Service
	var eps *v1.Endpoints

	wg := sync.WaitGroup{}
	wg.Add(2)
	errChan := make(chan error, 2)

	go func() {
		defer wg.Done()
		var err error
		svc, err = in.k8s.GetService(namespace, service)
		if err != nil {
			log.Errorf("Error fetching Service per namespace %s and service %s:", namespace, service, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		eps, err = in.k8s.GetEndpoints(namespace, service)
		if err != nil {
			log.Errorf("Error fetching Endpoints per namespace %s and service %s:", namespace, service, err)
			errChan <- err
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err := <-errChan
		return nil, err
	}

	var pl *v1.PodList
	var hth models.ServiceHealth
	var vs, dr []kubernetes.IstioObject
	var sWk map[string][]prometheus.Workload
	var dl *v1beta1.DeploymentList

	wg = sync.WaitGroup{}
	wg.Add(6)
	errChan = make(chan error, 6)

	go func() {
		defer wg.Done()
		var err error
		pl, err = in.k8s.GetPods(namespace, labels.Set(svc.Spec.Selector).String())
		if err != nil {
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		hth = in.health.getServiceHealth(namespace, service, interval, svc)
	}()

	go func() {
		defer wg.Done()
		var err error
		vs, err = in.k8s.GetVirtualServices(namespace, service)
		if err != nil {
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		dr, err = in.k8s.GetDestinationRules(namespace, service)
		if err != nil {
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		sWk, err = in.prom.GetSourceWorkloads(namespace, service)
		if err != nil {
			log.Errorf("Error fetching SourceWorkloads per namespace %s and service %s:", namespace, service, err)
			errChan <- err
		}
	}()

	go func() {
		defer wg.Done()
		var err error
		dl, err = in.k8s.GetDeployments(namespace, "")
		if err != nil {
			log.Errorf("Error fetching Deployments per namespace %s and service %s:", namespace, service, err)
			errChan <- err
		}
	}()

	wg.Wait()
	if len(errChan) != 0 {
		err := <-errChan
		return nil, err
	}

	wo := models.WorkloadOverviews{}
	wo.Parse(kubernetes.FilterDeploymentsForService(svc, pl.Items, dl.Items))

	s := models.ServiceDetails{Workloads: wo, Health: hth}
	s.SetService(svc)
	s.SetPods(kubernetes.FilterPodsForEndpoints(eps, pl.Items))
	s.SetEndpoints(eps)
	s.SetVirtualServices(vs)
	s.SetDestinationRules(dr)
	s.SetSourceWorkloads(sWk)
	return &s, nil
}
