package models

import (
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
)

type ServiceOverview struct {
	// Name of the Service
	// required: true
	// example: reviews-v1
	Name string `json:"name"`
	// Define if Pods related to this Service has an IstioSidecar deployed
	// required: true
	// example: true
	IstioSidecar bool `json:"istioSidecar"`
	// Has label app
	// required: true
	// example: true
	AppLabel bool `json:"appLabel"`
}

type ServiceList struct {
	Namespace Namespace         `json:"namespace"`
	Services  []ServiceOverview `json:"services"`
}

type ServiceDetails struct {
	Service          Service             `json:"service"`
	Endpoints        Endpoints           `json:"endpoints"`
	VirtualServices  VirtualServices     `json:"virtualServices"`
	DestinationRules DestinationRules    `json:"destinationRules"`
	Dependencies     map[string][]string `json:"dependencies"`
	Workloads        WorkloadOverviews   `json:"workloads"`
	Health           ServiceHealth       `json:"health"`
}

type Services []*Service
type Service struct {
	Name            string            `json:"name"`
	CreatedAt       string            `json:"createdAt"`
	ResourceVersion string            `json:"resourceVersion"`
	Namespace       Namespace         `json:"namespace"`
	Labels          map[string]string `json:"labels"`
	Type            string            `json:"type"`
	Ip              string            `json:"ip"`
	Ports           Ports             `json:"ports"`
}

func (ss *Services) Parse(services []v1.Service) {
	if ss == nil {
		return
	}

	for _, item := range services {
		service := &Service{}
		service.Parse(&item)
		*ss = append(*ss, service)
	}
}

func (s *Service) Parse(service *v1.Service) {
	if service != nil {
		s.Name = service.Name
		s.Namespace = Namespace{Name: service.Namespace}
		s.Labels = service.Labels
		s.Type = string(service.Spec.Type)
		s.Ip = service.Spec.ClusterIP
		s.CreatedAt = formatTime(service.CreationTimestamp.Time)
		s.ResourceVersion = service.ResourceVersion
		(&s.Ports).Parse(service.Spec.Ports)
	}
}

func (s *ServiceDetails) SetServiceDetails(serviceDetails *kubernetes.ServiceDetails, istioDetails *kubernetes.IstioDetails, prometheusDetails map[string][]prometheus.Workload) {
	s.setKubernetesDetails(serviceDetails)
	s.setIstioDetails(istioDetails)
	s.setPrometheusDetails(prometheusDetails)
}

func (s *ServiceDetails) setKubernetesDetails(serviceDetails *kubernetes.ServiceDetails) {
	s.Service.Parse(serviceDetails.Service)
	(&s.Endpoints).Parse(serviceDetails.Endpoints)
	(&s.Workloads).Parse(serviceDetails.Deployments)
}

func (s *ServiceDetails) setIstioDetails(istioDetails *kubernetes.IstioDetails) {
	(&s.VirtualServices).Parse(istioDetails.VirtualServices)
	(&s.DestinationRules).Parse(istioDetails.DestinationRules)
}

func (s *ServiceDetails) setPrometheusDetails(prometheusDetails map[string][]prometheus.Workload) {
	// Transform dependencies for UI
	s.Dependencies = make(map[string][]string)
	for version, workloads := range prometheusDetails {
		for _, workload := range workloads {
			s.Dependencies[version] = append(s.Dependencies[version], workload.App+"."+workload.Namespace+"/"+workload.Version)
		}
	}
}
