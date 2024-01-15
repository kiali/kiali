package models

import (
	extentions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"
	"istio.io/client-go/pkg/apis/telemetry/v1alpha1"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"
	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"
)

// IstioConfigList istioConfigList
// This type is used for returning a response of IstioConfigList
// swagger:model IstioConfigList
type IstioConfigList struct {
	// The namespace of istioConfiglist
	//
	// required: true
	Namespace Namespace `json:"namespace"`

	DestinationRules []*networking_v1beta1.DestinationRule `json:"destinationRules"`
	EnvoyFilters     []*networking_v1alpha3.EnvoyFilter    `json:"envoyFilters"`
	Gateways         []*networking_v1beta1.Gateway         `json:"gateways"`
	ServiceEntries   []*networking_v1beta1.ServiceEntry    `json:"serviceEntries"`
	Sidecars         []*networking_v1beta1.Sidecar         `json:"sidecars"`
	VirtualServices  []*networking_v1beta1.VirtualService  `json:"virtualServices"`
	WorkloadEntries  []*networking_v1beta1.WorkloadEntry   `json:"workloadEntries"`
	WorkloadGroups   []*networking_v1beta1.WorkloadGroup   `json:"workloadGroups"`
	WasmPlugins      []*extentions_v1alpha1.WasmPlugin     `json:"wasmPlugins"`
	Telemetries      []*v1alpha1.Telemetry                 `json:"telemetries"`

	K8sGateways        []*k8s_networking_v1.Gateway             `json:"k8sGateways"`
	K8sGRPCRoutes      []*k8s_networking_v1alpha2.GRPCRoute     `json:"k8sGRPCRoutes"`
	K8sHTTPRoutes      []*k8s_networking_v1.HTTPRoute           `json:"k8sHTTPRoutes"`
	K8sReferenceGrants []*k8s_networking_v1beta1.ReferenceGrant `json:"k8sReferenceGrants"`
	K8sTCPRoutes       []*k8s_networking_v1alpha2.TCPRoute      `json:"k8sTCPRoutes"`
	K8sTLSRoutes       []*k8s_networking_v1alpha2.TLSRoute      `json:"k8sTLSRoutes"`

	AuthorizationPolicies  []*security_v1beta.AuthorizationPolicy   `json:"authorizationPolicies"`
	PeerAuthentications    []*security_v1beta.PeerAuthentication    `json:"peerAuthentications"`
	RequestAuthentications []*security_v1beta.RequestAuthentication `json:"requestAuthentications"`
	IstioValidations       IstioValidations                         `json:"validations"`
}

// IstioConfigMap holds a map of IstioConfigList per cluster
type IstioConfigMap map[string]IstioConfigList

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
	WasmPlugin            *extentions_v1alpha1.WasmPlugin        `json:"wasmPlugin"`
	Telemetry             *v1alpha1.Telemetry                    `json:"telemetry"`

	K8sGateway        *k8s_networking_v1.Gateway             `json:"k8sGateway"`
	K8sGRPCRoute      *k8s_networking_v1alpha2.GRPCRoute     `json:"k8sGRPCRoute"`
	K8sHTTPRoute      *k8s_networking_v1.HTTPRoute           `json:"k8sHTTPRoute"`
	K8sReferenceGrant *k8s_networking_v1beta1.ReferenceGrant `json:"k8sReferenceGrant"`
	K8sTCPRoute       *k8s_networking_v1alpha2.TCPRoute      `json:"k8sTCPRoute"`
	K8sTLSRoute       *k8s_networking_v1alpha2.TLSRoute      `json:"k8sTLSRoute"`

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
		{ObjectField: "spec.rules.from.source.principals", Message: "Optional. A list of peer identities derived from the peer certificate. If not set, any principal is allowed."},
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
	"wasmplugins": { // TODO
		{},
	},
	"telemetries": { // TODO
		{},
	},
	"k8sgateways": {
		{ObjectField: "spec", Message: "Kubernetes Gateway API Configuration Object. A Gateway describes how traffic can be translated to Services within the cluster."},
		{ObjectField: "spec.gatewayClassName", Message: "Defines the name of a GatewayClass object used by this Gateway."},
		{ObjectField: "spec.listeners", Message: "Define the hostnames, ports, protocol, termination, TLS settings and which routes can be attached to a listener."},
		{ObjectField: "spec.addresses", Message: "Define the network addresses requested for this gateway."},
	},
	"k8sgrpcroutes": {
		{ObjectField: "", Message: "Kubernetes Gateway API Configuration Object. GRPCRoute provides a way to route gRPC requests"},
	},
	"k8shttproutes": { // TODO
		{ObjectField: "", Message: "Kubernetes Gateway API Configuration Object. HTTPRoute is for multiplexing HTTP or terminated HTTPS connections."},
	},
	"k8sreferencegrants": {
		{ObjectField: "spec", Message: "Kubernetes Gateway API Configuration Object. ReferenceGrant is for enabling cross namespace references within Gateway API."},
		{ObjectField: "spec.from", Message: "Define the group, kind, and namespace of resources that may reference items described in the to list."},
		{ObjectField: "spec.to", Message: "Define the group and kind of resources that may be referenced by items described in the from list."},
	},
	"k8stcproutes": {
		{ObjectField: "", Message: "Kubernetes Gateway API Configuration Object. TCPRoute provides a way to route TCP requests"},
	},
	"k8stlsroutes": {
		{ObjectField: "", Message: "Kubernetes Gateway API Configuration Object. TLSRoute provides a way to route TLS requests"},
	},
	"internal": {
		{ObjectField: "", Message: "Internal resources are not editable"},
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

// IstioConfigs holds a map of IstioConfigList per namespace
type IstioConfigs map[string]*IstioConfigList

// FilterIstioConfigs Filters all Istio configs from Istio registry by given namespaces and return a map config list per namespace
func (configList IstioConfigList) FilterIstioConfigs(nss []string) *IstioConfigs {
	filtered := IstioConfigs{}

	for _, ns := range nss {
		if filtered[ns] == nil {
			filtered[ns] = new(IstioConfigList)
			filtered[ns].IstioValidations = IstioValidations{}
			filtered[ns].Namespace = Namespace{Name: ns}
			filtered[ns].DestinationRules = []*networking_v1beta1.DestinationRule{}
			filtered[ns].EnvoyFilters = []*networking_v1alpha3.EnvoyFilter{}
			filtered[ns].Gateways = []*networking_v1beta1.Gateway{}
			filtered[ns].K8sGateways = []*k8s_networking_v1.Gateway{}
			filtered[ns].K8sGRPCRoutes = []*k8s_networking_v1alpha2.GRPCRoute{}
			filtered[ns].K8sHTTPRoutes = []*k8s_networking_v1.HTTPRoute{}
			filtered[ns].K8sReferenceGrants = []*k8s_networking_v1beta1.ReferenceGrant{}
			filtered[ns].K8sTCPRoutes = []*k8s_networking_v1alpha2.TCPRoute{}
			filtered[ns].K8sTLSRoutes = []*k8s_networking_v1alpha2.TLSRoute{}
			filtered[ns].VirtualServices = []*networking_v1beta1.VirtualService{}
			filtered[ns].ServiceEntries = []*networking_v1beta1.ServiceEntry{}
			filtered[ns].Sidecars = []*networking_v1beta1.Sidecar{}
			filtered[ns].WorkloadEntries = []*networking_v1beta1.WorkloadEntry{}
			filtered[ns].WorkloadGroups = []*networking_v1beta1.WorkloadGroup{}
			filtered[ns].AuthorizationPolicies = []*security_v1beta.AuthorizationPolicy{}
			filtered[ns].PeerAuthentications = []*security_v1beta.PeerAuthentication{}
			filtered[ns].RequestAuthentications = []*security_v1beta.RequestAuthentication{}
			filtered[ns].WasmPlugins = []*extentions_v1alpha1.WasmPlugin{}
			filtered[ns].Telemetries = []*v1alpha1.Telemetry{}
		}
		for _, dr := range configList.DestinationRules {
			if dr.Namespace == ns {
				filtered[ns].DestinationRules = append(filtered[ns].DestinationRules, dr)
			}
		}

		for _, ef := range configList.EnvoyFilters {
			if ef.Namespace == ns {
				filtered[ns].EnvoyFilters = append(filtered[ns].EnvoyFilters, ef)
			}
		}

		for _, gw := range configList.Gateways {
			if gw.Namespace == ns {
				filtered[ns].Gateways = append(filtered[ns].Gateways, gw)
			}
		}

		for _, gw := range configList.K8sGateways {
			if gw.Namespace == ns {
				filtered[ns].K8sGateways = append(filtered[ns].K8sGateways, gw)
			}
		}

		for _, route := range configList.K8sGRPCRoutes {
			if route.Namespace == ns {
				filtered[ns].K8sGRPCRoutes = append(filtered[ns].K8sGRPCRoutes, route)
			}
		}

		for _, route := range configList.K8sHTTPRoutes {
			if route.Namespace == ns {
				filtered[ns].K8sHTTPRoutes = append(filtered[ns].K8sHTTPRoutes, route)
			}
		}

		for _, rg := range configList.K8sReferenceGrants {
			if rg.Namespace == ns {
				filtered[ns].K8sReferenceGrants = append(filtered[ns].K8sReferenceGrants, rg)
			}
		}

		for _, route := range configList.K8sTCPRoutes {
			if route.Namespace == ns {
				filtered[ns].K8sTCPRoutes = append(filtered[ns].K8sTCPRoutes, route)
			}
		}

		for _, route := range configList.K8sTLSRoutes {
			if route.Namespace == ns {
				filtered[ns].K8sTLSRoutes = append(filtered[ns].K8sTLSRoutes, route)
			}
		}

		for _, se := range configList.ServiceEntries {
			if se.Namespace == ns {
				filtered[ns].ServiceEntries = append(filtered[ns].ServiceEntries, se)
			}
		}

		for _, sc := range configList.Sidecars {
			if sc.Namespace == ns {
				filtered[ns].Sidecars = append(filtered[ns].Sidecars, sc)
			}
		}

		for _, vs := range configList.VirtualServices {
			if vs.Namespace == ns {
				filtered[ns].VirtualServices = append(filtered[ns].VirtualServices, vs)
			}
		}

		for _, we := range configList.WorkloadEntries {
			if we.Namespace == ns {
				filtered[ns].WorkloadEntries = append(filtered[ns].WorkloadEntries, we)
			}
		}

		for _, wg := range configList.WorkloadGroups {
			if wg.Namespace == ns {
				filtered[ns].WorkloadGroups = append(filtered[ns].WorkloadGroups, wg)
			}
		}

		for _, wp := range configList.WasmPlugins {
			if wp.Namespace == ns {
				filtered[ns].WasmPlugins = append(filtered[ns].WasmPlugins, wp)
			}
		}

		for _, tm := range configList.Telemetries {
			if tm.Namespace == ns {
				filtered[ns].Telemetries = append(filtered[ns].Telemetries, tm)
			}
		}

		for _, ap := range configList.AuthorizationPolicies {
			if ap.Namespace == ns {
				filtered[ns].AuthorizationPolicies = append(filtered[ns].AuthorizationPolicies, ap)
			}
		}

		for _, pa := range configList.PeerAuthentications {
			if pa.Namespace == ns {
				filtered[ns].PeerAuthentications = append(filtered[ns].PeerAuthentications, pa)
			}
		}

		for _, ra := range configList.RequestAuthentications {
			if ra.Namespace == ns {
				filtered[ns].RequestAuthentications = append(filtered[ns].RequestAuthentications, ra)
			}
		}
		for k, v := range configList.IstioValidations {
			if k.Namespace == ns {
				filtered[ns].IstioValidations.MergeValidations(IstioValidations{k: v})
			}
		}
	}
	return &filtered
}

// Merge two config lists. To get configs from different namespaces
func (configList IstioConfigList) MergeConfigs(ns IstioConfigList) IstioConfigList {
	configList.DestinationRules = append(configList.DestinationRules, ns.DestinationRules...)
	configList.EnvoyFilters = append(configList.EnvoyFilters, ns.EnvoyFilters...)
	configList.Gateways = append(configList.Gateways, ns.Gateways...)
	configList.AuthorizationPolicies = append(configList.AuthorizationPolicies, ns.AuthorizationPolicies...)
	configList.K8sGateways = append(configList.K8sGateways, ns.K8sGateways...)
	configList.K8sGRPCRoutes = append(configList.K8sGRPCRoutes, ns.K8sGRPCRoutes...)
	configList.K8sHTTPRoutes = append(configList.K8sHTTPRoutes, ns.K8sHTTPRoutes...)
	configList.K8sReferenceGrants = append(configList.K8sReferenceGrants, ns.K8sReferenceGrants...)
	configList.K8sTCPRoutes = append(configList.K8sTCPRoutes, ns.K8sTCPRoutes...)
	configList.K8sTLSRoutes = append(configList.K8sTLSRoutes, ns.K8sTLSRoutes...)
	configList.PeerAuthentications = append(configList.PeerAuthentications, ns.PeerAuthentications...)
	configList.RequestAuthentications = append(configList.RequestAuthentications, ns.RequestAuthentications...)
	configList.ServiceEntries = append(configList.ServiceEntries, ns.ServiceEntries...)
	configList.Sidecars = append(configList.Sidecars, ns.Sidecars...)
	configList.Telemetries = append(configList.Telemetries, ns.Telemetries...)
	configList.VirtualServices = append(configList.VirtualServices, ns.VirtualServices...)
	configList.WasmPlugins = append(configList.WasmPlugins, ns.WasmPlugins...)
	configList.WorkloadEntries = append(configList.WorkloadEntries, ns.WorkloadEntries...)
	configList.WorkloadGroups = append(configList.WorkloadGroups, ns.WorkloadGroups...)
	configList.Namespace = Namespace{}

	return configList
}
