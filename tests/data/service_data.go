package data

import (
	"strings"

	"github.com/kiali/kiali/kubernetes"
)

func CreateEmptyRegistryServices() []*kubernetes.RegistryService {
	return []*kubernetes.RegistryService{{}}
}

func CreateFakeRegistryServicesLabels(service string, namespace string) []*kubernetes.RegistryService {
	registryService := kubernetes.RegistryService{}
	registryService.Hostname = service + "." + namespace + ".svc.cluster.local"
	registryService.Attributes.Name = service
	registryService.Attributes.Namespace = namespace
	registryService.Attributes.ExportTo = make(map[string]struct{})
	registryService.Attributes.ExportTo["*"] = struct{}{}
	registryService.Attributes.Labels = make(map[string]string)
	registryService.Attributes.Labels["app"] = service
	registryService.Attributes.Labels["version"] = "v1"
	registryService.Attributes.LabelSelectors = make(map[string]string)
	registryService.Attributes.LabelSelectors["app"] = service

	return []*kubernetes.RegistryService{&registryService}
}

func CreateFakeRegistryServices(host string, namespace string, exportToNamespace string) []*kubernetes.RegistryService {
	registryService := kubernetes.RegistryService{}
	registryService.Hostname = host
	registryService.Attributes.Namespace = namespace
	registryService.Attributes.Name = strings.Split(host, ".")[0]
	registryService.Attributes.ExportTo = make(map[string]struct{})
	registryService.Attributes.ExportTo[exportToNamespace] = struct{}{}

	return []*kubernetes.RegistryService{&registryService}
}

func CreateFakeMultiRegistryServices(hosts []string, namespace string, exportToNamespace string) []*kubernetes.RegistryService {
	result := make([]*kubernetes.RegistryService, 0)
	for _, host := range hosts {
		result = append(result, CreateFakeRegistryServices(host, namespace, exportToNamespace)...)
	}

	return result
}
