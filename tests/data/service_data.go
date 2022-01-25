package data

import (
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

func CreateFakeServiceList(serviceNames []string, namespace string) models.ServiceList {
	serviceList := models.ServiceList{
		Services: []models.ServiceOverview{},
	}
	for _, sName := range serviceNames {
		serviceList.Services = append(serviceList.Services, models.ServiceOverview{
			Name:      sName,
			Namespace: namespace,
			AppLabel:  true,
			Labels: map[string]string{
				"app":     sName,
				"version": "v1"},
			Selector: map[string]string{"app": sName},
		})
	}
	return serviceList
}

func CreateFakeRegistryServices(host string, namespace string, exportToNamespace string) []*kubernetes.RegistryService {
	registryService := kubernetes.RegistryService{}
	registryService.Hostname = host
	registryService.IstioService.Attributes.Namespace = namespace
	registryService.IstioService.Attributes.Name = strings.Split(host, ".")[0]
	registryService.IstioService.Attributes.ExportTo = make(map[string]bool)
	registryService.IstioService.Attributes.ExportTo[exportToNamespace] = true

	return []*kubernetes.RegistryService{&registryService}
}

func CreateFakeMultiRegistryServices(hosts []string, namespace string, exportToNamespace string) []*kubernetes.RegistryService {
	result := make([]*kubernetes.RegistryService, 0)
	for _, host := range hosts {
		result = append(result, CreateFakeRegistryServices(host, namespace, exportToNamespace)...)
	}

	return result
}
