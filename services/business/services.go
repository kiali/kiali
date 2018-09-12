package business

import (
	"fmt"
	"sync"

	"k8s.io/api/core/v1"

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
		sl, err = in.k8s.GetServices(namespace)
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
		sPods := kubernetes.FilterPodsForService(&item, pl)
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
	serviceDetails, err := in.k8s.GetServiceDetails(namespace, service)
	if err != nil {
		return nil, fmt.Errorf("Service details: %s", err.Error())
	}

	health := in.health.getServiceHealth(namespace, service, interval, serviceDetails)

	istioDetails, err := in.k8s.GetIstioDetails(namespace, service)
	if err != nil {
		return nil, fmt.Errorf("Istio details: %s", err.Error())
	}

	prometheusDetails, err := in.prom.GetSourceWorkloads(namespace, service)
	if err != nil {
		return nil, fmt.Errorf("Source services: %s", err.Error())
	}

	s := models.ServiceDetails{Health: health}
	s.SetServiceDetails(serviceDetails, istioDetails, prometheusDetails)
	return &s, nil
}
