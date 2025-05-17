package business

import (
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

type RegistryStatusService struct {
	conf       *config.Config
	kialiCache cache.KialiCache
}

type RegistryCriteria struct {
	// When AllNamespaces is true Namespace criteria is ignored
	// Note this flag is only supported in Registry queries
	AllNamespaces   bool
	Cluster         string
	Namespace       string
	ServiceName     string
	ServiceSelector string
}

func (in *RegistryStatusService) GetRegistryServices(criteria RegistryCriteria) []*kubernetes.RegistryService {
	registryStatus := in.kialiCache.GetRegistryStatus(criteria.Cluster)
	registryServices := filterRegistryServices(registryStatus, criteria)
	return registryServices
}

func filterRegistryServices(registryStatus *kubernetes.RegistryStatus, criteria RegistryCriteria) []*kubernetes.RegistryService {
	var filteredRegistryServices []*kubernetes.RegistryService
	if registryStatus == nil {
		return filteredRegistryServices
	}
	if criteria.AllNamespaces {
		return registryStatus.Services
	}
	if criteria.Namespace != "" {
		for _, rService := range registryStatus.Services {
			if rService.Attributes.Namespace == criteria.Namespace {
				filteredRegistryServices = append(filteredRegistryServices, rService)
			}
		}
		if criteria.ServiceSelector != "" {
			if selector, err3 := labels.ConvertSelectorToLabelsMap(criteria.ServiceSelector); err3 == nil {
				var filteredSelectorServices []*kubernetes.RegistryService
				for _, rService := range filteredRegistryServices {
					svcSelector := labels.Set(rService.Attributes.LabelSelectors).AsSelector()
					if !svcSelector.Empty() && svcSelector.Matches(selector) {
						filteredSelectorServices = append(filteredSelectorServices, rService)
					}
				}
				return filteredSelectorServices
			} else {
				log.Warningf("Services not filtered. Selector %s not valid", criteria.ServiceSelector)
			}
		}
	}
	return filteredRegistryServices
}
