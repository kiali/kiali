package models

import (
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

type ServiceOverview struct {
	Name                string `json:"name"`
	Replicas            int32  `json:"replicas"`
	AvailableReplicas   int32  `json:"available_replicas"`
	UnavailableReplicas int32  `json:"unavailable_replicas"`
}

type ServiceList struct {
	Namespace Namespace         `json:"namespace"`
	Services  []ServiceOverview `json:"services"`
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
}

func (s *ServiceList) SetServiceList(serviceList *kubernetes.ServiceList) {
	s.Services = CastServiceOverviewCollection(serviceList)
}

func CastServiceOverviewCollection(sl *kubernetes.ServiceList) []ServiceOverview {
	if sl.Services == nil {
		return nil
	}

	services := make([]ServiceOverview, len(sl.Services.Items))

	for i, item := range sl.Services.Items {
		services[i] = CastServiceOverview(&item, sl.Deployments)
	}

	return services
}

func CastServiceOverview(s *v1.Service, deployments *v1beta1.DeploymentList) ServiceOverview {
	service := ServiceOverview{}
	service.Name = s.Name

	replicas, availableReplicas, unavailableReplicas := getPodStatusForService(s.Labels[config.Get().ServiceFilterLabelName], deployments)
	service.Replicas = replicas
	service.AvailableReplicas = availableReplicas
	service.UnavailableReplicas = unavailableReplicas

	return service
}

func getPodStatusForService(serviceName string, deployments *v1beta1.DeploymentList) (int32, int32, int32) {
	replicas, availableReplicas, unavailableReplicas := int32(0), int32(0), int32(0)

	for _, deployment := range deployments.Items {
		if deployment.ObjectMeta.Labels != nil && deployment.ObjectMeta.Labels[config.Get().ServiceFilterLabelName] == serviceName {
			replicas = replicas + deployment.Status.Replicas
			availableReplicas = availableReplicas + deployment.Status.AvailableReplicas
			unavailableReplicas = unavailableReplicas + deployment.Status.UnavailableReplicas
		}
	}

	return replicas, availableReplicas, unavailableReplicas
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
	(&s.Deployments).AddAutoscalers(serviceDetails.Autoscalers)
}

func (s *Service) setIstioDetails(istioDetails *kubernetes.IstioDetails) {
	(&s.RouteRules).Parse(istioDetails.RouteRules)
	(&s.DestinationPolicies).Parse(istioDetails.DestinationPolicies)
}

func (s *Service) setPrometheusDetails(prometheusDetails map[string][]string) {
	s.Dependencies = prometheusDetails
}
