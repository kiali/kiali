package models

import (
	"github.com/kiali/swscore/kubernetes"

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
	Name                string              `json:"name"`
	Namespace           Namespace           `json:"namespace"`
	Labels              map[string]string   `json:"labels"`
	Type                string              `json:"type"`
	Ip                  string              `json:"ip"`
	Ports               Ports               `json:"ports"`
	Endpoints           Endpoints           `json:"endpoints"`
	RouteRules          RouteRules          `json:"route_rules"`
	DestinationPolicies DestinationPolicies `json:"destination_policies"`
	Dependencies        map[string][]string `json:"dependencies"`
	Deployments         Deployments         `json:"deployments"`
	Autoscalers         Autoscalers         `json:"autoscalers"`
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

func (s *Service) SetServiceDetails(serviceDetails *kubernetes.ServiceDetails, istioDetails *kubernetes.IstioDetails, prometheusDetails map[string][]string) {

	s.setKubernetesDetails(serviceDetails)
	s.setIstioDetails(istioDetails)
	s.setPrometheusDetails(prometheusDetails)
}

func (s *Service) setKubernetesDetails(serviceDetails *kubernetes.ServiceDetails) {
	if serviceDetails.Service != nil {
		s.Labels = serviceDetails.Service.Labels
		s.Type = string(serviceDetails.Service.Spec.Type)
		s.Ip = serviceDetails.Service.Spec.ClusterIP
		(&s.Ports).Parse(serviceDetails.Service.Spec.Ports)
	}

	(&s.Endpoints).Parse(serviceDetails.Endpoints)
	(&s.Deployments).Parse(serviceDetails.Deployments)
	(&s.Autoscalers).Parse(serviceDetails.Autoscalers)
}

func (s *Service) setIstioDetails(istioDetails *kubernetes.IstioDetails) {
	(&s.RouteRules).Parse(istioDetails.RouteRules)
	(&s.DestinationPolicies).Parse(istioDetails.DestinationPolicies)
}

func (s *Service) setPrometheusDetails(prometheusDetails map[string][]string) {
	s.Dependencies = prometheusDetails
}
