package models

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
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

	DestinationRules []networking_v1beta1.DestinationRule `json:"destinationRules"`
	EnvoyFilters     []networking_v1alpha3.EnvoyFilter    `json:"envoyFilters"`
	Gateways         []networking_v1beta1.Gateway         `json:"gateways"`
	ServiceEntries   []networking_v1beta1.ServiceEntry    `json:"serviceEntries"`
	Sidecars         []networking_v1beta1.Sidecar         `json:"sidecars"`
	VirtualServices  []networking_v1beta1.VirtualService  `json:"virtualServices"`
	WorkloadEntries  []networking_v1beta1.WorkloadEntry   `json:"workloadEntries"`
	WorkloadGroups   []networking_v1beta1.WorkloadGroup   `json:"workloadGroups"`

	AuthorizationPolicies  []security_v1beta.AuthorizationPolicy   `json:"authorizationPolicies"`
	PeerAuthentications    []security_v1beta.PeerAuthentication    `json:"peerAuthentications"`
	RequestAuthentications []security_v1beta.RequestAuthentication `json:"requestAuthentications"`
	IstioValidations       IstioValidations                        `json:"validations"`
}

type IstioConfigDetails struct {
	Namespace  Namespace `json:"namespace"`
	ObjectType string    `json:"objectType"`

	AuthorizationPolicy   *security_v1beta.AuthorizationPolicy   `json:"authorizationPolicy"`
	DestinationRule       *networking_v1beta1.DestinationRule    `json:"destinationRule"`
	EnvoyFilter           *networking_v1alpha3.EnvoyFilter       `json:"envoyFilter"`
	Gateway               *networking_v1beta1.Gateway            `json:"gateway"`
	PeerAuthentication    *security_v1beta.PeerAuthentication    `json:"peerAuthentication"`
	RequestAuthentication *security_v1beta.RequestAuthentication `json:"requestAuthentication"`
	ServiceEntry          *networking_v1beta1.ServiceEntry       `json:"serviceEntry"`
	Sidecar               *networking_v1beta1.Sidecar            `json:"sidecar"`
	VirtualService        *networking_v1beta1.VirtualService     `json:"virtualService"`
	WorkloadEntry         *networking_v1beta1.WorkloadEntry      `json:"workloadEntry"`
	WorkloadGroup         *networking_v1beta1.WorkloadGroup      `json:"workloadGroup"`

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

// IstioConfigHelpMessages represents the help messages for a given Istio object type
var IstioConfigHelpMessages = map[string][]IstioConfigHelp{
	"authorizationpolicies": {
		{ObjectField: "spec.selector", Message: "Optional. The selector decides where to apply the authorization policy. The selector will match with workloads in the same namespace as the authorization policy. If the authorization policy is in the root namespace, the selector will additionally match with workloads in all namespaces."},
		{ObjectField: "spec.selector.matchLabels", Message: "One or more labels that indicate a specific set of pods/VMs on which a policy should be applied."},
		{ObjectField: "spec.rules", Message: "Optional. A list of rules to match the request. A match occurs when at least one rule matches the request."},
		{ObjectField: "spec.rules.from", Message: "Optional. from specifies the source of a request. If not set, any source is allowed."},
		{ObjectField: "spec.rules.to", Message: "Optional. to specifies the operation of a request. If not set, any operation is allowed."},
		{ObjectField: "spec.rules.when", Message: "Optional. when specifies a list of additional conditions of a request. If not set, any condition is allowed."},
		{ObjectField: "spec.action", Message: "Optional. The action to take if the request is matched with the rules. Default is ALLOW if not specified."},
	},
	"destinationrules": {
		{ObjectField: "spec.host", Message: "The name of a service from the service registry. Rules defined for services that do not exist in the service registry will be ignored."},
		{ObjectField: "spec.trafficPolicy", Message: "Traffic policies to apply (load balancing policy, connection pool sizes, outlier detection)."},
		{ObjectField: "spec.subsets", Message: "One or more named sets that represent individual versions of a service. Traffic policies can be overridden at subset level."},
		{ObjectField: "spec.exportTo", Message: "A list of namespaces to which this destination rule is exported. The resolution of a destination rule to apply to a service occurs in the context of a hierarchy of namespaces. This feature provides a mechanism for service owners and mesh administrators to control the visibility of destination rules across namespace boundaries. If no namespaces are specified then the destination rule is exported to all namespaces by default."},
	},
	"envoyfilters": {
		{ObjectField: "spec.workloadSelector", Message: "Criteria used to select the specific set of pods/VMs on which this patch configuration should be applied. If omitted, the set of patches in this configuration will be applied to all workload instances in the same namespace."},
		{ObjectField: "spec.configPatches", Message: "One or more patches with match conditions."},
		{ObjectField: "spec.configPatches.applyTo", Message: "Specifies where in the Envoy configuration, the patch should be applied."},
		{ObjectField: "spec.configPatches.match", Message: "Match on listener/route configuration/cluster."},
		{ObjectField: "spec.configPatches.patch", Message: "The patch to apply along with the operation."},
		{ObjectField: "spec.priority", Message: "riority defines the order in which patch sets are applied within a context. When one patch depends on another patch, the order of patch application is significant."},
	},
	"gateways": {
		{ObjectField: "spec.servers", Message: "A list of server specifications."},
		{ObjectField: "spec.selector", Message: "One or more labels that indicate a specific set of pods/VMs on which this gateway configuration should be applied. By default workloads are searched across all namespaces based on label selectors."},
		{ObjectField: "spec.servers.port", Message: "The port on which the proxy should listen for incoming connections."},
		{ObjectField: "spec.servers.hosts", Message: "One or more hosts exposed by this gateway. While typically applicable to HTTP services, it can also be used for TCP services using TLS with SNI."},
		{ObjectField: "spec.servers.tls", Message: "Set of TLS related options that govern the server’s behavior. Use these options to control if all http requests should be redirected to https, and the TLS modes to use."},
	},
	"sidecars": {
		{ObjectField: "spec.workloadSelector", Message: "Criteria used to select the specific set of pods/VMs on which this Sidecar configuration should be applied. If omitted, the Sidecar configuration will be applied to all workload instances in the same namespace."},
		{ObjectField: "spec.ingress", Message: "Ingress specifies the configuration of the sidecar for processing inbound traffic to the attached workload instance."},
		{ObjectField: "spec.egress", Message: "Egress specifies the configuration of the sidecar for processing outbound traffic from the attached workload instance to other services in the mesh"},
	},
	"peerauthentications": {
		{ObjectField: "spec.selector", Message: "The selector determines the workloads to apply the ChannelAuthentication on. If not set, the policy will be applied to all workloads in the same namespace as the policy."},
		{ObjectField: "spec.selector.matchLabels", Message: "One or more labels that indicate a specific set of pods/VMs on which a policy should be applied."},
		{ObjectField: "spec.mtls", Message: "Mutual TLS settings for workload. If not defined, inherit from parent."},
	},
	"requestauthentications": {
		{ObjectField: "spec.selector", Message: "Optional. The selector decides where to apply the request authentication policy. The selector will match with workloads in the same namespace as the request authentication policy. If the request authentication policy is in the root namespace, the selector will additionally match with workloads in all namespaces."},
		{ObjectField: "spec.selector.matchLabels", Message: "One or more labels that indicate a specific set of pods/VMs on which a policy should be applied."},
		{ObjectField: "spec.jwtRules", Message: "Define the list of JWTs that can be validated at the selected workloads’ proxy. A valid token will be used to extract the authenticated identity."},
	},
	"serviceentries": {
		{ObjectField: "spec.hosts", Message: "The hosts associated with the ServiceEntry. Could be a DNS name with wildcard prefix."},
		{ObjectField: "spec.addresses", Message: "The virtual IP addresses associated with the service. Could be CIDR prefix."},
		{ObjectField: "spec.ports", Message: "The ports associated with the external service. If the Endpoints are Unix domain socket addresses, there must be exactly one port."},
		{ObjectField: "spec.location", Message: "Specify whether the service should be considered external to the mesh or part of the mesh."},
		{ObjectField: "spec.resolution", Message: "Service discovery mode for the hosts."},
		{ObjectField: "spec.endpoints", Message: "One or more endpoints associated with the service. Only one of endpoints or workloadSelector can be specified."},
		{ObjectField: "spec.workloadSelector", Message: "Applicable only for MESH_INTERNAL services. Only one of endpoints or workloadSelector can be specified."},
		{ObjectField: "spec.exportTo", Message: "A list of namespaces to which this service is exported. Exporting a service allows it to be used by sidecars, gateways and virtual services defined in other namespaces. This feature provides a mechanism for service owners and mesh administrators to control the visibility of services across namespace boundaries."},
	},
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
	"workloadentries": {
		{ObjectField: "spec.address", Message: "Address associated with the network endpoint without the port."},
		{ObjectField: "spec.ports", Message: "Set of ports associated with the endpoint."},
		{ObjectField: "spec.labels", Message: "One or more labels associated with the endpoint."},
		{ObjectField: "spec.network", Message: "Network enables Istio to group endpoints resident in the same L3 domain/network. All endpoints in the same network are assumed to be directly reachable from one another."},
		{ObjectField: "spec.locality", Message: "The locality associated with the endpoint. A locality corresponds to a failure domain (e.g., country/region/zone). Arbitrary failure domain hierarchies can be represented by separating each encapsulating failure domain by /."},
		{ObjectField: "spec.weight", Message: "The load balancing weight associated with the endpoint. Endpoints with higher weights will receive proportionally higher traffic."},
		{ObjectField: "spec.serviceAccount", Message: "The service account associated with the workload if a sidecar is present in the workload."},
	},
	"workloadgroups": {
		{ObjectField: "spec.metadata", Message: "Metadata that will be used for all corresponding WorkloadEntries. User labels for a workload group should be set here in metadata rather than in template."},
		{ObjectField: "spec.template", Message: "Template to be used for the generation of WorkloadEntry resources that belong to this WorkloadGroup."},
		{ObjectField: "spec.probe", Message: "ReadinessProbe describes the configuration the user must provide for healthchecking on their workload."},
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
