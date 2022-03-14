package models

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"
)

// IstioConfigList istioConfigList
//
// This type is used for returning a response of IstioConfigList
//
// swagger:model IstioConfigList
type IstioConfigList struct {
	// The namespace of istioConfiglist
	//
	// required: true
	Namespace Namespace `json:"namespace"`

	DestinationRules []networking_v1alpha3.DestinationRule `json:"destinationRules"`
	EnvoyFilters     []networking_v1alpha3.EnvoyFilter     `json:"envoyFilters"`
	Gateways         []networking_v1alpha3.Gateway         `json:"gateways"`
	ServiceEntries   []networking_v1alpha3.ServiceEntry    `json:"serviceEntries"`
	Sidecars         []networking_v1alpha3.Sidecar         `json:"sidecars"`
	VirtualServices  []networking_v1alpha3.VirtualService  `json:"virtualServices"`
	WorkloadEntries  []networking_v1alpha3.WorkloadEntry   `json:"workloadEntries"`
	WorkloadGroups   []networking_v1alpha3.WorkloadGroup   `json:"workloadGroups"`

	AuthorizationPolicies  []security_v1beta.AuthorizationPolicy   `json:"authorizationPolicies"`
	PeerAuthentications    []security_v1beta.PeerAuthentication    `json:"peerAuthentications"`
	RequestAuthentications []security_v1beta.RequestAuthentication `json:"requestAuthentications"`
	IstioValidations       IstioValidations                        `json:"validations"`
}

type IstioConfigDetails struct {
	Namespace  Namespace `json:"namespace"`
	ObjectType string    `json:"objectType"`

	DestinationRule *networking_v1alpha3.DestinationRule `json:"destinationRule"`
	EnvoyFilter     *networking_v1alpha3.EnvoyFilter     `json:"envoyFilter"`
	Gateway         *networking_v1alpha3.Gateway         `json:"gateway"`
	ServiceEntry    *networking_v1alpha3.ServiceEntry    `json:"serviceEntry"`
	Sidecar         *networking_v1alpha3.Sidecar         `json:"sidecar"`
	VirtualService  *networking_v1alpha3.VirtualService  `json:"virtualService"`
	WorkloadEntry   *networking_v1alpha3.WorkloadEntry   `json:"workloadEntry"`
	WorkloadGroup   *networking_v1alpha3.WorkloadGroup   `json:"workloadGroup"`

	AuthorizationPolicy   *security_v1beta.AuthorizationPolicy   `json:"authorizationPolicy"`
	PeerAuthentication    *security_v1beta.PeerAuthentication    `json:"peerAuthentication"`
	RequestAuthentication *security_v1beta.RequestAuthentication `json:"requestAuthentication"`

	Permissions           ResourcePermissions `json:"permissions"`
	IstioValidation       *IstioValidation    `json:"validation"`
	IstioReferences       *IstioReferences    `json:"references"`
	IstioConfigHelpFields []IstioConfigHelp   `json:"help"`
}

// IstioConfigHelp represents a help message for a given Istio object type and field
type IstioConfigHelp struct {
	ObjectField string `json:"objectField"`
	Message     string `json:"message"`
}

var IstioConfigHelpMessages = map[string][]IstioConfigHelp{
	"virtualservices": {
		{ObjectField: "spec.hosts", Message: "The destination hosts to which traffic is being sent. Could be a DNS name with wildcard prefix or an IP address. Depending on the platform, short-names can also be used instead of a FQDN (i.e. has no dots in the name)."},
		{ObjectField: "spec.gateways", Message: "The names of gateways and sidecars that should apply these routes. Gateways in other namespaces may be referred to by <gateway namespace>/<gateway name>; specifying a gateway with no namespace qualifier is the same as specifying the VirtualService’s namespace. To apply the rules to both gateways and sidecars, specify mesh as one of the gateway names."},
		{ObjectField: "spec.http", Message: "An ordered list of route rules for HTTP traffic."},
		{ObjectField: "spec.exportTo", Message: "A list of namespaces to which this virtual service is exported. Exporting a virtual service allows it to be used by sidecars and gateways defined in other namespaces."},
		{ObjectField: "spec.http.match", Message: "Match conditions to be satisfied for the rule to be activated."},
		{ObjectField: "spec.http.route", Message: "A HTTP rule can either redirect or forward (default) traffic. The forwarding target can be one of several versions of a service. Weights associated with the service version determine the proportion of traffic it receives."},
		{ObjectField: "spec.http.route.destination.host", Message: "The name of a service from the service registry. Service names are looked up from the platform’s service registry (e.g., Kubernetes services, Consul services, etc.) and from the hosts declared by ServiceEntry."},
		{ObjectField: "spec.http.route.destination.subset", Message: "The name of a subset within the service. Applicable only to services within the mesh. The subset must be defined in a corresponding DestinationRule."},
	},
	"destinationrules": {
		{ObjectField: "spec.host", Message: "The name of a service from the service registry. Rules defined for services that do not exist in the service registry will be ignored."},
		{ObjectField: "spec.trafficPolicy", Message: "Traffic policies to apply (load balancing policy, connection pool sizes, outlier detection)."},
		{ObjectField: "spec.subsets", Message: "One or more named sets that represent individual versions of a service. Traffic policies can be overridden at subset level."},
		{ObjectField: "spec.exportTo", Message: "A list of namespaces to which this destination rule is exported. The resolution of a destination rule to apply to a service occurs in the context of a hierarchy of namespaces. This feature provides a mechanism for service owners and mesh administrators to control the visibility of destination rules across namespace boundaries. If no namespaces are specified then the destination rule is exported to all namespaces by default."},
	},
	"gateways": {
		{ObjectField: "spec.servers", Message: "A list of server specifications."},
		{ObjectField: "spec.selector", Message: "One or more labels that indicate a specific set of pods/VMs on which this gateway configuration should be applied. By default workloads are searched across all namespaces based on label selectors."},
		{ObjectField: "spec.servers.port", Message: "The port on which the proxy should listen for incoming connections."},
		{ObjectField: "spec.servers.hosts", Message: "One or more hosts exposed by this gateway. While typically applicable to HTTP services, it can also be used for TCP services using TLS with SNI."},
		{ObjectField: "spec.servers.tls", Message: "Set of TLS related options that govern the server’s behavior. Use these options to control if all http requests should be redirected to https, and the TLS modes to use."},
	},
}

// ResourcePermissions holds permission flags for an object type
// True means allowed.
type ResourcePermissions struct {
	Create bool `json:"create"`
	Update bool `json:"update"`
	Delete bool `json:"delete"`
}

// ResourcesPermissions holds a map of permission flags per resource
type ResourcesPermissions map[string]*ResourcePermissions

// IstioConfigPermissions holds a map of ResourcesPermissions per namespace
type IstioConfigPermissions map[string]*ResourcesPermissions
