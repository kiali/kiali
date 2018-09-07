package business

import (
	"fmt"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
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
	// Fetch services list
	kubernetesServices, err := in.k8s.GetFullServices(namespace)
	if err != nil {
		return nil, err
	}

	// Convert to Kiali model
	return in.buildServiceList(models.Namespace{Name: namespace}, kubernetesServices), nil
}

func (in *SvcService) buildServiceList(namespace models.Namespace, sl *kubernetes.ServiceList) *models.ServiceList {
	services := make([]models.ServiceOverview, len(sl.Services.Items))
	conf := config.Get()
	// Convert each k8s service into our model
	for i, item := range sl.Services.Items {
		sPods := kubernetes.FilterPodsForService(&item, sl.Pods)
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
