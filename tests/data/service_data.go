package data

import (
	"strings"

	"github.com/kiali/kiali/kubernetes"
)

func CreateEmptyRegistryServices() []*kubernetes.RegistryService {
	return []*kubernetes.RegistryService{&kubernetes.RegistryService{}}
}

func CreateFakeRegistryServicesLabels(service string, namespace string) []*kubernetes.RegistryService {
	registryService := kubernetes.RegistryService{}
	registryService.Hostname = service + "." + namespace + ".svc.cluster.local"
	registryService.IstioService.Attributes.Name = service
	registryService.IstioService.Attributes.Namespace = namespace
	registryService.IstioService.Attributes.ExportTo = make(map[string]struct{})
	registryService.IstioService.Attributes.ExportTo["*"] = struct{}{}
	registryService.IstioService.Attributes.Labels = make(map[string]string)
	registryService.IstioService.Attributes.Labels["app"] = service
	registryService.IstioService.Attributes.Labels["version"] = "v1"
	registryService.IstioService.Attributes.LabelSelectors = make(map[string]string)
	registryService.IstioService.Attributes.LabelSelectors["app"] = service

	return []*kubernetes.RegistryService{&registryService}
}

func CreateFakeRegistryServices(host string, namespace string, exportToNamespace string) []*kubernetes.RegistryService {
	registryService := kubernetes.RegistryService{}
	registryService.Hostname = host
	registryService.IstioService.Attributes.Namespace = namespace
	registryService.IstioService.Attributes.Name = strings.Split(host, ".")[0]
	registryService.IstioService.Attributes.ExportTo = make(map[string]struct{})
	registryService.IstioService.Attributes.ExportTo[exportToNamespace] = struct{}{}

	return []*kubernetes.RegistryService{&registryService}
}

func CreateFakeMultiRegistryServices(hosts []string, namespace string, exportToNamespace string) []*kubernetes.RegistryService {
	result := make([]*kubernetes.RegistryService, 0)
	for _, host := range hosts {
		result = append(result, CreateFakeRegistryServices(host, namespace, exportToNamespace)...)
	}

	return result
}
