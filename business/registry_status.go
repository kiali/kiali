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

func (in *RegistryStatusService) GetRegistryConfiguration(criteria RegistryCriteria) (*kubernetes.RegistryConfiguration, error) {
	if kialiCache == nil {
		return nil, nil
	}
	if err := in.checkAndRefresh(); err != nil {
		return nil, err
	}
	registryStatus := kialiCache.GetRegistryStatus()
	registryConfiguration := filterRegistryConfiguration(registryStatus, criteria)
	return registryConfiguration, nil
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

func filterRegistryConfiguration(registryStatus *kubernetes.RegistryStatus, criteria RegistryCriteria) *kubernetes.RegistryConfiguration {
	filtered := kubernetes.RegistryConfiguration{}
	if registryStatus == nil {
		return &filtered
	}

	if criteria.AllNamespaces {
		return registryStatus.Configuration
	}

	for _, dr := range registryStatus.Configuration.DestinationRules {
		if dr.Namespace == criteria.Namespace {
			filtered.DestinationRules = append(filtered.DestinationRules, dr)
		}
	}

	for _, ef := range registryStatus.Configuration.EnvoyFilters {
		if ef.Namespace == criteria.Namespace {
			filtered.EnvoyFilters = append(filtered.EnvoyFilters, ef)
		}
	}

	for _, gw := range registryStatus.Configuration.Gateways {
		if gw.Namespace == criteria.Namespace {
			filtered.Gateways = append(filtered.Gateways, gw)
		}
	}

	for _, gw := range registryStatus.Configuration.K8sGateways {
		if gw.Namespace == criteria.Namespace {
			filtered.K8sGateways = append(filtered.K8sGateways, gw)
		}
	}

	for _, httpr := range registryStatus.Configuration.K8sHTTPRoutes {
		if httpr.Namespace == criteria.Namespace {
			filtered.K8sHTTPRoutes = append(filtered.K8sHTTPRoutes, httpr)
		}
	}

	for _, se := range registryStatus.Configuration.ServiceEntries {
		if se.Namespace == criteria.Namespace {
			filtered.ServiceEntries = append(filtered.ServiceEntries, se)
		}
	}

	for _, sc := range registryStatus.Configuration.Sidecars {
		if sc.Namespace == criteria.Namespace {
			filtered.Sidecars = append(filtered.Sidecars, sc)
		}
	}

	for _, vs := range registryStatus.Configuration.VirtualServices {
		if vs.Namespace == criteria.Namespace {
			filtered.VirtualServices = append(filtered.VirtualServices, vs)
		}
	}

	for _, we := range registryStatus.Configuration.WorkloadEntries {
		if we.Namespace == criteria.Namespace {
			filtered.WorkloadEntries = append(filtered.WorkloadEntries, we)
		}
	}

	for _, wg := range registryStatus.Configuration.WorkloadGroups {
		if wg.Namespace == criteria.Namespace {
			filtered.WorkloadGroups = append(filtered.WorkloadGroups, wg)
		}
	}

	for _, wp := range registryStatus.Configuration.WasmPlugins {
		if wp.Namespace == criteria.Namespace {
			filtered.WasmPlugins = append(filtered.WasmPlugins, wp)
		}
	}

	for _, tm := range registryStatus.Configuration.Telemetries {
		if tm.Namespace == criteria.Namespace {
			filtered.Telemetries = append(filtered.Telemetries, tm)
		}
	}

	for _, ap := range registryStatus.Configuration.AuthorizationPolicies {
		if ap.Namespace == criteria.Namespace {
			filtered.AuthorizationPolicies = append(filtered.AuthorizationPolicies, ap)
		}
	}

	for _, pa := range registryStatus.Configuration.PeerAuthentications {
		if pa.Namespace == criteria.Namespace {
			filtered.PeerAuthentications = append(filtered.PeerAuthentications, pa)
		}
	}

	for _, ra := range registryStatus.Configuration.RequestAuthentications {
		if ra.Namespace == criteria.Namespace {
			filtered.RequestAuthentications = append(filtered.RequestAuthentications, ra)
		}
	}
	return &filtered
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
	var registryConfiguration *kubernetes.RegistryConfiguration
	var registryServices []*kubernetes.RegistryService

	var rConfErr, rEndErr, rSvcErr error

	wg := sync.WaitGroup{}
	wg.Add(2)

	go func() {
		defer wg.Done()
		if registryConfiguration, rConfErr = in.k8s.GetRegistryConfiguration(); rConfErr != nil {
			registryConfiguration, rConfErr = in.getRegistryConfigurationUsingKialiSA()
		}
	}()

	go func() {
		defer wg.Done()
		if registryServices, rSvcErr = in.k8s.GetRegistryServices(); rSvcErr != nil {
			registryServices, rSvcErr = in.getRegistryServicesUsingKialiSA()
		}
	}()

	wg.Wait()

	if rConfErr != nil {
		return nil, rConfErr
	}
	if rEndErr != nil {
		return nil, rEndErr
	}
	if rSvcErr != nil {
		return nil, rSvcErr
	}

	registryStatus := kubernetes.RegistryStatus{
		Configuration: registryConfiguration,
		Services:      registryServices,
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

func (in *RegistryStatusService) getRegistryConfigurationUsingKialiSA() (*kubernetes.RegistryConfiguration, error) {
	k8s, err := getSAClient()
	if err != nil {
		return nil, err
	}

	return k8s.GetRegistryConfiguration()
}
