package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type ServiceOverview struct {
	Name         string `json:"name"`
	Health       Health `json:"health"`
	IstioSidecar bool   `json:"istioSidecar"`
}

type ServiceList struct {
	Namespace Namespace         `json:"namespace"`
	Services  []ServiceOverview `json:"services"`
}

type Service struct {
	Name                string              `json:"name"`
	CreatedAt           string              `json:"createdAt"`
	ResourceVersion     string              `json:"resourceVersion"`
	Namespace           Namespace           `json:"namespace"`
	Labels              map[string]string   `json:"labels"`
	Type                string              `json:"type"`
	Ip                  string              `json:"ip"`
	Ports               Ports               `json:"ports"`
	Endpoints           Endpoints           `json:"endpoints"`
	RouteRules          RouteRules          `json:"routeRules"`
	DestinationPolicies DestinationPolicies `json:"destinationPolicies"`
	VirtualServices     VirtualServices     `json:"virtualServices"`
	DestinationRules    DestinationRules    `json:"destinationRules"`
	Dependencies        map[string][]string `json:"dependencies"`
	Pods                Pods                `json:"pods"`
	Deployments         Deployments         `json:"deployments"`
	Health              Health              `json:"health"`
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
		s.CreatedAt = formatTime(serviceDetails.Service.CreationTimestamp.Time)
		s.ResourceVersion = serviceDetails.Service.ResourceVersion
		(&s.Ports).Parse(serviceDetails.Service.Spec.Ports)
	}

	(&s.Endpoints).Parse(serviceDetails.Endpoints)
	(&s.Pods).Parse(serviceDetails.Pods)
	(&s.Deployments).Parse(serviceDetails.Deployments)
	(&s.Deployments).AddAutoscalers(serviceDetails.Autoscalers)
}

func (s *Service) setIstioDetails(istioDetails *kubernetes.IstioDetails) {
	(&s.RouteRules).Parse(istioDetails.RouteRules)
	(&s.DestinationPolicies).Parse(istioDetails.DestinationPolicies)
	(&s.VirtualServices).Parse(istioDetails.VirtualServices)
	(&s.DestinationRules).Parse(istioDetails.DestinationRules)
}

func (s *Service) setPrometheusDetails(prometheusDetails map[string][]string) {
	s.Dependencies = prometheusDetails
}
