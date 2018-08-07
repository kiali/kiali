package models

import (
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
)

type ServiceOverview struct {
	Name         string `json:"name"`
	IstioSidecar bool   `json:"istioSidecar"`
}

type ServiceList struct {
	Namespace Namespace         `json:"namespace"`
	Services  []ServiceOverview `json:"services"`
}

type Service struct {
	Name             string              `json:"name"`
	CreatedAt        string              `json:"createdAt"`
	ResourceVersion  string              `json:"resourceVersion"`
	Namespace        Namespace           `json:"namespace"`
	Labels           map[string]string   `json:"labels"`
	Type             string              `json:"type"`
	Ip               string              `json:"ip"`
	Ports            Ports               `json:"ports"`
	Endpoints        Endpoints           `json:"endpoints"`
	VirtualServices  VirtualServices     `json:"virtualServices"`
	DestinationRules DestinationRules    `json:"destinationRules"`
	Dependencies     map[string][]string `json:"dependencies"`
	Pods             Pods                `json:"pods"`
	Deployments      Deployments         `json:"deployments"`
	Health           ServiceHealth       `json:"health"`
}

func (s *Service) SetServiceDetails(serviceDetails *kubernetes.ServiceDetails, istioDetails *kubernetes.IstioDetails, prometheusDetails map[string][]prometheus.Workload) {
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
	(&s.VirtualServices).Parse(istioDetails.VirtualServices)
	(&s.DestinationRules).Parse(istioDetails.DestinationRules)
}

func (s *Service) setPrometheusDetails(prometheusDetails map[string][]prometheus.Workload) {
	// Transform dependencies for UI
	s.Dependencies = make(map[string][]string)
	for version, workloads := range prometheusDetails {
		for _, workload := range workloads {
			s.Dependencies[version] = append(s.Dependencies[version], workload.App+"."+workload.Namespace+"/"+workload.Version)
		}
	}
}
