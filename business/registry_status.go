package business

import (
	"sync"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

var refreshLock sync.Mutex

type RegistryStatusService struct {
	k8s           kubernetes.ClientInterface
	businessLayer *Layer
}

type RegistryCriteria struct {
	// When AllNamespaces is true Namespace criteria is ignored
	// Note this flag is only supported in Registry queries
	AllNamespaces   bool
	Namespace       string
	ServiceName     string
	ServiceSelector string
}

func (in *RegistryStatusService) GetRegistryServices(criteria RegistryCriteria) ([]*kubernetes.RegistryService, error) {
	if kialiCache == nil {
		return nil, nil
	}
	if err := in.checkAndRefresh(); err != nil {
		return nil, err
	}
	registryStatus := kialiCache.GetRegistryStatus()
	registryServices := filterRegistryServices(registryStatus, criteria)
	return registryServices, nil
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

func (in *RegistryStatusService) checkAndRefresh() error {
	if !kialiCache.CheckRegistryStatus() {
		refreshLock.Lock()
		if !kialiCache.CheckRegistryStatus() {
			registryStatus, err := in.refreshRegistryStatus()
			if err != nil {
				refreshLock.Unlock()
				return err
			}
			kialiCache.SetRegistryStatus(registryStatus)
			log.Debugf("Lock acquired. Update the Registry")
		} else {
			log.Debugf("Lock acquired but registry updated. Doing nothing")
		}
		refreshLock.Unlock()
	}
	return nil
}

func (in *RegistryStatusService) refreshRegistryStatus() (*kubernetes.RegistryStatus, error) {
	registryServices, err := in.k8s.GetRegistryServices()
	if err != nil {
		registryServices, err = in.getRegistryServicesUsingKialiSA()
		if err != nil {
			return nil, err
		}
	}

	registryStatus := kubernetes.RegistryStatus{
		Services: registryServices,
	}

	return &registryStatus, nil
}

func getSAClient() (kubernetes.ClientInterface, error) {
	clientFactory, err := kubernetes.GetClientFactory()
	if err != nil {
		return nil, err
	}

	return clientFactory.GetSAHomeClusterClient(), nil
}

func (in *RegistryStatusService) getRegistryServicesUsingKialiSA() ([]*kubernetes.RegistryService, error) {
	k8s, err := getSAClient()
	if err != nil {
		return nil, err
	}

	return k8s.GetRegistryServices()
}
