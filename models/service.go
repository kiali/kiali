package models

import (
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"
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
	Namespace   Namespace         `json:"namespace"`
	Services    []ServiceOverview `json:"services"`
	Validations IstioValidations  `json:"validations"`
}

type ServiceDetails struct {
	Service          Service           `json:"service"`
	IstioSidecar     bool              `json:"istioSidecar"`
	Endpoints        Endpoints         `json:"endpoints"`
	VirtualServices  VirtualServices   `json:"virtualServices"`
	DestinationRules DestinationRules  `json:"destinationRules"`
	Workloads        WorkloadOverviews `json:"workloads"`
	Health           ServiceHealth     `json:"health"`
	Validations      IstioValidations  `json:"validations"`
	ErrorTraces      int               `json:"errorTraces"`
	NamespaceMTLS    MTLSStatus        `json:"namespaceMTLS"`
}

type Services []*Service
type Service struct {
	Name            string            `json:"name"`
	CreatedAt       string            `json:"createdAt"`
	ResourceVersion string            `json:"resourceVersion"`
	Namespace       Namespace         `json:"namespace"`
	Labels          map[string]string `json:"labels"`
	Selectors       map[string]string `json:"selectors"`
	Type            string            `json:"type"`
	Ip              string            `json:"ip"`
	Ports           Ports             `json:"ports"`
	ExternalName    string            `json:"externalName"`
}

func (ss *Services) Parse(services []core_v1.Service) {
	if ss == nil {
		return
	}

	for _, item := range services {
		service := &Service{}
		service.Parse(&item)
		*ss = append(*ss, service)
	}
}

func (s *Service) Parse(service *core_v1.Service) {
	if service != nil {
		s.Name = service.Name
		s.Namespace = Namespace{Name: service.Namespace}
		s.Labels = service.Labels
		s.Selectors = service.Spec.Selector
		s.Type = string(service.Spec.Type)
		s.Ip = service.Spec.ClusterIP
		s.ExternalName = service.Spec.ExternalName
		s.CreatedAt = formatTime(service.CreationTimestamp.Time)
		s.ResourceVersion = service.ResourceVersion
		(&s.Ports).Parse(service.Spec.Ports)
	}
}

func (s *ServiceDetails) SetService(svc *core_v1.Service) {
	s.Service.Parse(svc)
}

func (s *ServiceDetails) SetEndpoints(eps *core_v1.Endpoints) {
	(&s.Endpoints).Parse(eps)
}

func (s *ServiceDetails) SetPods(pods []core_v1.Pod) {
	mPods := Pods{}
	mPods.Parse(pods)
	s.IstioSidecar = mPods.HasIstioSidecar()
}

func (s *ServiceDetails) SetVirtualServices(vs []kubernetes.IstioObject, canCreate, canUpdate, canDelete bool) {
	s.VirtualServices.Permissions = ResourcePermissions{Create: canCreate, Update: canUpdate, Delete: canDelete}
	(&s.VirtualServices).Parse(vs)
}

func (s *ServiceDetails) SetDestinationRules(dr []kubernetes.IstioObject, canCreate, canUpdate, canDelete bool) {
	s.DestinationRules.Permissions = ResourcePermissions{Create: canCreate, Update: canUpdate, Delete: canDelete}
	(&s.DestinationRules).Parse(dr)
}

func (s *ServiceDetails) SetErrorTraces(errorTraces int) {
	s.ErrorTraces = errorTraces
}
