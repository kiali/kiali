package models

import (
	"github.com/swift-sunshine/swscore/kubernetes"
	"github.com/swift-sunshine/swscore/prometheus"

	"k8s.io/api/core/v1"
)

type ServiceOverview struct {
	Name string `json:"name"`
}

type ServiceList struct {
	Namespace Namespace         `json:"namespace"`
	Service   []ServiceOverview `json:"services"`
}

type Service struct {
	Name         string              `json:"name"`
	Namespace    Namespace           `json:"namespace"`
	Labels       map[string]string   `json:"labels"`
	Type         string              `json:"type"`
	Ip           string              `json:"ip"`
	Ports        Ports               `json:"ports"`
	Endpoints    Endpoints           `json:"endpoints"`
	Pods         Pods                `json:"pods"`
	RouteRules   RouteRules          `json:"route_rules"`
	Dependencies map[string][]string `json:"dependencies"`
}

func GetServicesByNamespace(namespaceName string) ([]ServiceOverview, error) {
	istioClient, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}

	services, err := istioClient.GetServices(namespaceName)
	if err != nil {
		return nil, err
	}

	return CastServiceOverviewCollection(services), nil
}

func GetServiceDetails(namespaceName, serviceName string) (*Service, error) {
	istioClient, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}

	service := Service{}
	service.Name = serviceName
	service.Namespace = Namespace{namespaceName}

	if err = service.setKubernetesDetails(istioClient); err != nil {
		return nil, err
	}

	if err = service.setIstioDetails(istioClient); err != nil {
		return nil, err
	}

	if err = service.setPrometheusDetails(); err != nil {
		return nil, err
	}

	return &service, err
}

func CastServiceOverviewCollection(sl *v1.ServiceList) []ServiceOverview {
	services := make([]ServiceOverview, len(sl.Items))
	for i, item := range sl.Items {
		services[i] = CastServiceOverview(item)
	}

	return services
}

func CastServiceOverview(s v1.Service) ServiceOverview {
	service := ServiceOverview{}
	service.Name = s.Name

	return service
}

func (s *Service) setKubernetesDetails(c *kubernetes.IstioClient) error {
	serviceDetails, err := c.GetServiceDetails(s.Namespace.Name, s.Name)
	if err != nil {
		return err
	}

	s.Labels = serviceDetails.Service.Labels
	s.Type = string(serviceDetails.Service.Spec.Type)
	s.Ip = serviceDetails.Service.Spec.ClusterIP
	(&s.Ports).Parse(serviceDetails.Service.Spec.Ports)
	(&s.Endpoints).Parse(serviceDetails.Endpoints)
	(&s.Pods).Parse(serviceDetails.Pods)

	return nil
}

func (s *Service) setIstioDetails(c *kubernetes.IstioClient) error {

	istioDetails, err := c.GetIstioDetails(s.Namespace.Name, s.Name)
	if err != nil {
		return err
	}

	(&s.RouteRules).Parse(istioDetails.RouteRules)
	return nil
}

func (s *Service) setPrometheusDetails() error {

	prometheusClient, err := prometheus.NewClient()
	if err != nil {
		return err
	}

	incomeServices, err := prometheusClient.GetSourceServices(s.Namespace.Name, s.Name)
	if err != nil {
		return err
	}

	s.Dependencies = incomeServices

	return nil
}

func CastService(dependencies map[string]string) *Service {
	service := Service{}

	return &service
}
