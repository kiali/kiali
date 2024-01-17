package models

import (
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

type ServiceOverview struct {
	// Name of the Service
	// required: true
	// example: reviews-v1
	Name string `json:"name"`
	// Namespace of the Service
	Namespace string `json:"namespace"`
	// Define if Pods related to this Service has an IstioSidecar deployed
	// required: true
	// example: true
	IstioSidecar bool `json:"istioSidecar"`
	// The kube cluster where this service is located.
	Cluster string `json:"cluster"`
	// Check if it has Ambient enabled
	// required: true
	// example: true
	IstioAmbient bool `json:"istioAmbient"`
	// Has label app
	// required: true
	// example: true
	AppLabel bool `json:"appLabel"`
	// Additional detail sample, such as type of api being served (graphql, grpc, rest)
	// example: rest
	// required: false
	AdditionalDetailSample *AdditionalItem `json:"additionalDetailSample"`
	// Annotations of Deployment
	// required: false
	Annotations map[string]string `json:"annotations"`
	// Annotations of the service
	HealthAnnotations map[string]string `json:"healthAnnotations"`
	// Names and Ports of Service
	Ports map[string]int `json:"ports"`
	// Labels for Service
	Labels map[string]string `json:"labels"`
	// Selector for Service
	Selector map[string]string `json:"selector"`
	// Istio References
	IstioReferences []*IstioValidationKey `json:"istioReferences"`
	// Kiali Wizard scenario, if any
	KialiWizard string `json:"kialiWizard"`
	// ServiceRegistry values:
	// Kubernetes: 	is a service registry backed by k8s API server
	// External: 	is a service registry for externally provided ServiceEntries
	// Federation:  special case when registry is provided from a federated environment
	ServiceRegistry string `json:"serviceRegistry"`

	// Health
	Health ServiceHealth `json:"health,omitempty"`
}

type ServiceList struct {
	Namespace   Namespace         `json:"namespace"`
	Services    []ServiceOverview `json:"services"`
	Validations IstioValidations  `json:"validations"`
}

type ServiceDefinitionList struct {
	Namespace          Namespace        `json:"namespace"`
	ServiceDefinitions []ServiceDetails `json:"serviceDefinitions"`
}

type ServiceDetails struct {
	Cluster            string                                   `json:"cluster"`
	DestinationRules   []*networking_v1beta1.DestinationRule    `json:"destinationRules"`
	Endpoints          Endpoints                                `json:"endpoints"`
	IstioPermissions   ResourcePermissions                      `json:"istioPermissions"`
	IstioSidecar       bool                                     `json:"istioSidecar"`
	K8sHTTPRoutes      []*k8s_networking_v1.HTTPRoute           `json:"k8sHTTPRoutes"`
	K8sReferenceGrants []*k8s_networking_v1beta1.ReferenceGrant `json:"k8sReferenceGrants"`
	Service            Service                                  `json:"service"`
	ServiceEntries     []*networking_v1beta1.ServiceEntry       `json:"serviceEntries"`
	VirtualServices    []*networking_v1beta1.VirtualService     `json:"virtualServices"`
	Workloads          WorkloadOverviews                        `json:"workloads"`
	// Services with same app labels (different versions or a single version)
	Health        ServiceHealth      `json:"health"`
	NamespaceMTLS MTLSStatus         `json:"namespaceMTLS"`
	SubServices   []*ServiceOverview `json:"subServices"`
	Validations   IstioValidations   `json:"validations"`
}

type (
	Services []*Service
	Service  struct {
		Name              string            `json:"name"`
		CreatedAt         string            `json:"createdAt"`
		ResourceVersion   string            `json:"resourceVersion"`
		Namespace         Namespace         `json:"namespace"`
		Labels            map[string]string `json:"labels"`
		Selectors         map[string]string `json:"selectors"`
		Type              string            `json:"type"`
		Ip                string            `json:"ip"`
		Ports             Ports             `json:"ports"`
		ExternalName      string            `json:"externalName"`
		Annotations       map[string]string `json:"annotations"`
		HealthAnnotations map[string]string `json:"healthAnnotations"`
		AdditionalDetails []AdditionalItem  `json:"additionalDetails"`
	}
)

func (so *ServiceOverview) ParseToService() *Service {
	svc := Service{
		Name:              so.Name,
		Type:              so.ServiceRegistry,
		HealthAnnotations: so.HealthAnnotations,
	}
	return &svc
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
		if len(service.Annotations) > 0 {
			s.Annotations = service.Annotations
		} else {
			s.Annotations = map[string]string{}
		}
		s.HealthAnnotations = GetHealthAnnotation(service.Annotations, GetHealthConfigAnnotation())
		s.AdditionalDetails = GetAdditionalDetails(config.Get(), service.ObjectMeta.Annotations)
		(&s.Ports).Parse(service.Spec.Ports)
	}
}

func (s *Service) ParseRegistryService(service *kubernetes.RegistryService) {
	if service != nil {
		s.Name = service.Attributes.Name
		s.Namespace = Namespace{Name: service.Attributes.Namespace}
		s.Labels = service.Attributes.Labels
		s.Selectors = service.Attributes.LabelSelectors
		s.HealthAnnotations = map[string]string{}
		// It will expect "External" or "Federation"
		s.Type = service.Attributes.ServiceRegistry
		s.Ports.ParseServiceRegistryPorts(service)
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
}

func (s *ServiceDetails) SetIstioSidecar(workloads WorkloadOverviews) {
	s.IstioSidecar = workloads.HasIstioSidecar()
}

func (s *ServiceList) HasMatchingServices(service string) bool {
	for _, s := range s.Services {
		if service == s.Name {
			return true
		}
	}
	return false
}

func (s *ServiceList) FilterServicesForSelector(selector labels.Selector) []ServiceOverview {
	services := []ServiceOverview{}
	for _, svc := range s.Services {
		if selector.Matches(labels.Set(svc.Selector)) {
			services = append(services, svc)
		}
	}
	return services
}

func (s *ServiceList) GetServiceNames() []string {
	serviceNames := make([]string, 0)
	for _, item := range s.Services {
		serviceNames = append(serviceNames, item.Name)
	}
	return serviceNames
}
