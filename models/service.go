package models

import (
	"github.com/swift-sunshine/swscore/kubernetes"
	"k8s.io/api/core/v1"
)

type Service struct {
	Name string `json:"name"`
}

type ServiceList struct {
	Namespace Namespace `json:"namespace"`
	Service   []Service `json:"services"`
}

func GetServicesByNamespace(namespaceName string) ([]Service, error) {
	istioClient, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}

	services, err := istioClient.GetServices(namespaceName)
	if err != nil {
		return nil, err
	}

	return CastServiceCollection(services), nil
}

func CastServiceCollection(sl *v1.ServiceList) []Service {
	services := make([]Service, len(sl.Items))
	for i, item := range sl.Items {
		services[i] = CastService(item)
	}

	return services
}

func CastService(s v1.Service) Service {
	service := Service{}
	service.Name = s.Name

	return service
}
