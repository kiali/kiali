package models

import (
	"encoding/json"

	extentions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	telemetry_v1 "istio.io/client-go/pkg/apis/telemetry/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"
	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/kubernetes"
)

// IstioConfigList istioConfigList
// This type is used for returning a response of IstioConfigList
// swagger:model IstioConfigList
type IstioConfigList struct {
	DestinationRules []*networking_v1.DestinationRule   `json:"-"`
	EnvoyFilters     []*networking_v1alpha3.EnvoyFilter `json:"-"`
	Gateways         []*networking_v1.Gateway           `json:"-"`
	ServiceEntries   []*networking_v1.ServiceEntry      `json:"-"`
	Sidecars         []*networking_v1.Sidecar           `json:"-"`
	VirtualServices  []*networking_v1.VirtualService    `json:"-"`
	WorkloadEntries  []*networking_v1.WorkloadEntry     `json:"-"`
	WorkloadGroups   []*networking_v1.WorkloadGroup     `json:"-"`
	WasmPlugins      []*extentions_v1alpha1.WasmPlugin  `json:"-"`
	Telemetries      []*telemetry_v1.Telemetry          `json:"-"`

	K8sGateways        []*k8s_networking_v1.Gateway             `json:"-"`
	K8sGRPCRoutes      []*k8s_networking_v1.GRPCRoute           `json:"-"`
	K8sHTTPRoutes      []*k8s_networking_v1.HTTPRoute           `json:"-"`
	K8sReferenceGrants []*k8s_networking_v1beta1.ReferenceGrant `json:"-"`
	K8sTCPRoutes       []*k8s_networking_v1alpha2.TCPRoute      `json:"-"`
	K8sTLSRoutes       []*k8s_networking_v1alpha2.TLSRoute      `json:"-"`

	AuthorizationPolicies  []*security_v1.AuthorizationPolicy   `json:"-"`
	PeerAuthentications    []*security_v1.PeerAuthentication    `json:"-"`
	RequestAuthentications []*security_v1.RequestAuthentication `json:"-"`
	IstioValidations       IstioValidations                     `json:"-"`
}

func (i IstioConfigList) MarshalJSON() ([]byte, error) {
	// result map with keys and values
	jsonMap := make(map[string]interface{})

	resources := make(map[string]interface{})

	resources[kubernetes.DestinationRules.String()] = i.DestinationRules
	resources[kubernetes.EnvoyFilters.String()] = i.EnvoyFilters
	resources[kubernetes.Gateways.String()] = i.Gateways
	resources[kubernetes.ServiceEntries.String()] = i.ServiceEntries
	resources[kubernetes.Sidecars.String()] = i.Sidecars
	resources[kubernetes.VirtualServices.String()] = i.VirtualServices
	resources[kubernetes.WorkloadEntries.String()] = i.WorkloadEntries
	resources[kubernetes.WorkloadGroups.String()] = i.WorkloadGroups
	resources[kubernetes.WasmPlugins.String()] = i.WasmPlugins
	resources[kubernetes.Telemetries.String()] = i.Telemetries
	resources[kubernetes.K8sGateways.String()] = i.K8sGateways
	resources[kubernetes.K8sGRPCRoutes.String()] = i.K8sGRPCRoutes
	resources[kubernetes.K8sHTTPRoutes.String()] = i.K8sHTTPRoutes
	resources[kubernetes.K8sReferenceGrants.String()] = i.K8sReferenceGrants
	resources[kubernetes.K8sTCPRoutes.String()] = i.K8sTCPRoutes
	resources[kubernetes.K8sTLSRoutes.String()] = i.K8sTLSRoutes
	resources[kubernetes.AuthorizationPolicies.String()] = i.AuthorizationPolicies
	resources[kubernetes.PeerAuthentications.String()] = i.PeerAuthentications
	resources[kubernetes.RequestAuthentications.String()] = i.RequestAuthentications

	jsonMap["resources"] = resources
	jsonMap["validations"] = i.IstioValidations

	return json.Marshal(jsonMap)
}

func (i *IstioConfigList) UnmarshalJSON(data []byte) error {
	var temp struct {
		Resources   map[string]json.RawMessage `json:"resources"`
		Validations IstioValidations           `json:"validations"`
	}

	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	i.ConvertToResponse()
	i.IstioValidations = temp.Validations

	// Iterate over the resources map and unmarshal each resource type
	for resourceType, rawMessage := range temp.Resources {
		if len(rawMessage) == 0 || string(rawMessage) == "[]" {
			continue
		}

		switch resourceType {
		case kubernetes.DestinationRules.String():
			if err := json.Unmarshal(rawMessage, &i.DestinationRules); err != nil {
				return err
			}
		case kubernetes.EnvoyFilters.String():
			if err := json.Unmarshal(rawMessage, &i.EnvoyFilters); err != nil {
				return err
			}
		case kubernetes.Gateways.String():
			if err := json.Unmarshal(rawMessage, &i.Gateways); err != nil {
				return err
			}
		case kubernetes.ServiceEntries.String():
			if err := json.Unmarshal(rawMessage, &i.ServiceEntries); err != nil {
				return err
			}
		case kubernetes.Sidecars.String():
			if err := json.Unmarshal(rawMessage, &i.Sidecars); err != nil {
				return err
			}
		case kubernetes.VirtualServices.String():
			if err := json.Unmarshal(rawMessage, &i.VirtualServices); err != nil {
				return err
			}
		case kubernetes.WorkloadEntries.String():
			if err := json.Unmarshal(rawMessage, &i.WorkloadEntries); err != nil {
				return err
			}
		case kubernetes.WorkloadGroups.String():
			if err := json.Unmarshal(rawMessage, &i.WorkloadGroups); err != nil {
				return err
			}
		case kubernetes.WasmPlugins.String():
			if err := json.Unmarshal(rawMessage, &i.WasmPlugins); err != nil {
				return err
			}
		case kubernetes.Telemetries.String():
			if err := json.Unmarshal(rawMessage, &i.Telemetries); err != nil {
				return err
			}
		case kubernetes.K8sGateways.String():
			if err := json.Unmarshal(rawMessage, &i.K8sGateways); err != nil {
				return err
			}
		case kubernetes.K8sGRPCRoutes.String():
			if err := json.Unmarshal(rawMessage, &i.K8sGRPCRoutes); err != nil {
				return err
			}
		case kubernetes.K8sHTTPRoutes.String():
			if err := json.Unmarshal(rawMessage, &i.K8sHTTPRoutes); err != nil {
				return err
			}
		case kubernetes.K8sReferenceGrants.String():
			if err := json.Unmarshal(rawMessage, &i.K8sReferenceGrants); err != nil {
				return err
			}
		case kubernetes.K8sTCPRoutes.String():
			if err := json.Unmarshal(rawMessage, &i.K8sTCPRoutes); err != nil {
				return err
			}
		case kubernetes.K8sTLSRoutes.String():
			if err := json.Unmarshal(rawMessage, &i.K8sTLSRoutes); err != nil {
				return err
			}
		case kubernetes.AuthorizationPolicies.String():
			if err := json.Unmarshal(rawMessage, &i.AuthorizationPolicies); err != nil {
				return err
			}
		case kubernetes.PeerAuthentications.String():
			if err := json.Unmarshal(rawMessage, &i.PeerAuthentications); err != nil {
				return err
			}
		case kubernetes.RequestAuthentications.String():
			if err := json.Unmarshal(rawMessage, &i.RequestAuthentications); err != nil {
				return err
			}
		default:
			// Ignore unrecognized resource types
		}
	}

	return nil
}

func (i *IstioConfigList) ConvertToResponse() {
	// The frontend blows up when you return a nil array so coercing these to
	// empty before returning them.

	// There's probably a more clever way of doing this but due to typed nils
	// we can't just put all the slices into a new generic slice as putting
	// them in that slice would cause them to no longer be nil.
	if i.DestinationRules == nil {
		i.DestinationRules = []*networking_v1.DestinationRule{}
	}
	if i.EnvoyFilters == nil {
		i.EnvoyFilters = []*networking_v1alpha3.EnvoyFilter{}
	}
	if i.Gateways == nil {
		i.Gateways = []*networking_v1.Gateway{}
	}
	if i.ServiceEntries == nil {
		i.ServiceEntries = []*networking_v1.ServiceEntry{}
	}
	if i.Sidecars == nil {
		i.Sidecars = []*networking_v1.Sidecar{}
	}
	if i.VirtualServices == nil {
		i.VirtualServices = []*networking_v1.VirtualService{}
	}
	if i.WorkloadEntries == nil {
		i.WorkloadEntries = []*networking_v1.WorkloadEntry{}
	}
	if i.WorkloadGroups == nil {
		i.WorkloadGroups = []*networking_v1.WorkloadGroup{}
	}
	if i.WasmPlugins == nil {
		i.WasmPlugins = []*extentions_v1alpha1.WasmPlugin{}
	}
	if i.Telemetries == nil {
		i.Telemetries = []*telemetry_v1.Telemetry{}
	}

	if i.K8sGateways == nil {
		i.K8sGateways = []*k8s_networking_v1.Gateway{}
	}
	if i.K8sGRPCRoutes == nil {
		i.K8sGRPCRoutes = []*k8s_networking_v1.GRPCRoute{}
	}
	if i.K8sHTTPRoutes == nil {
		i.K8sHTTPRoutes = []*k8s_networking_v1.HTTPRoute{}
	}
	if i.K8sReferenceGrants == nil {
		i.K8sReferenceGrants = []*k8s_networking_v1beta1.ReferenceGrant{}
	}
	if i.K8sTCPRoutes == nil {
		i.K8sTCPRoutes = []*k8s_networking_v1alpha2.TCPRoute{}
	}
	if i.K8sTLSRoutes == nil {
		i.K8sTLSRoutes = []*k8s_networking_v1alpha2.TLSRoute{}
	}

	if i.AuthorizationPolicies == nil {
		i.AuthorizationPolicies = []*security_v1.AuthorizationPolicy{}
	}
	if i.PeerAuthentications == nil {
		i.PeerAuthentications = []*security_v1.PeerAuthentication{}
	}
	if i.RequestAuthentications == nil {
		i.RequestAuthentications = []*security_v1.RequestAuthentication{}
	}
}

// IstioConfigMap holds a map of IstioConfigList per cluster
type IstioConfigMap map[string]IstioConfigList

type IstioConfigDetails struct {
	Namespace Namespace               `json:"-"`
	ObjectGVK schema.GroupVersionKind `json:"-"`

	AuthorizationPolicy   *security_v1.AuthorizationPolicy   `json:"-"`
	DestinationRule       *networking_v1.DestinationRule     `json:"-"`
	EnvoyFilter           *networking_v1alpha3.EnvoyFilter   `json:"-"`
	Gateway               *networking_v1.Gateway             `json:"-"`
	PeerAuthentication    *security_v1.PeerAuthentication    `json:"-"`
	RequestAuthentication *security_v1.RequestAuthentication `json:"-"`
	ServiceEntry          *networking_v1.ServiceEntry        `json:"-"`
	Sidecar               *networking_v1.Sidecar             `json:"-"`
	VirtualService        *networking_v1.VirtualService      `json:"-"`
	WorkloadEntry         *networking_v1.WorkloadEntry       `json:"-"`
	WorkloadGroup         *networking_v1.WorkloadGroup       `json:"-"`
	WasmPlugin            *extentions_v1alpha1.WasmPlugin    `json:"-"`
	Telemetry             *telemetry_v1.Telemetry            `json:"-"`

	K8sGateway        *k8s_networking_v1.Gateway             `json:"-"`
	K8sGRPCRoute      *k8s_networking_v1.GRPCRoute           `json:"-"`
	K8sHTTPRoute      *k8s_networking_v1.HTTPRoute           `json:"-"`
	K8sReferenceGrant *k8s_networking_v1beta1.ReferenceGrant `json:"-"`
	K8sTCPRoute       *k8s_networking_v1alpha2.TCPRoute      `json:"-"`
	K8sTLSRoute       *k8s_networking_v1alpha2.TLSRoute      `json:"-"`

	Permissions           ResourcePermissions `json:"-"`
	IstioValidation       *IstioValidation    `json:"-"`
	IstioReferences       *IstioReferences    `json:"-"`
	IstioConfigHelpFields []IstioConfigHelp   `json:"-"`
}

func (i IstioConfigDetails) MarshalJSON() ([]byte, error) {
	// result map with keys and values
	jsonMap := make(map[string]interface{})

	var resource interface{}

	// Check not nil field and assign to `resource`, should be only one field
	if i.AuthorizationPolicy != nil {
		resource = i.AuthorizationPolicy
	} else if i.DestinationRule != nil {
		resource = i.DestinationRule
	} else if i.EnvoyFilter != nil {
		resource = i.EnvoyFilter
	} else if i.Gateway != nil {
		resource = i.Gateway
	} else if i.PeerAuthentication != nil {
		resource = i.PeerAuthentication
	} else if i.RequestAuthentication != nil {
		resource = i.RequestAuthentication
	} else if i.ServiceEntry != nil {
		resource = i.ServiceEntry
	} else if i.Sidecar != nil {
		resource = i.Sidecar
	} else if i.VirtualService != nil {
		resource = i.VirtualService
	} else if i.WorkloadEntry != nil {
		resource = i.WorkloadEntry
	} else if i.WorkloadGroup != nil {
		resource = i.WorkloadGroup
	} else if i.WasmPlugin != nil {
		resource = i.WasmPlugin
	} else if i.Telemetry != nil {
		resource = i.Telemetry
	} else if i.K8sGateway != nil {
		resource = i.K8sGateway
	} else if i.K8sGRPCRoute != nil {
		resource = i.K8sGRPCRoute
	} else if i.K8sHTTPRoute != nil {
		resource = i.K8sHTTPRoute
	} else if i.K8sReferenceGrant != nil {
		resource = i.K8sReferenceGrant
	} else if i.K8sTCPRoute != nil {
		resource = i.K8sTCPRoute
	} else if i.K8sTLSRoute != nil {
		resource = i.K8sTLSRoute
	}

	jsonMap["resource"] = resource
	jsonMap["namespace"] = i.Namespace
	jsonMap["gvk"] = i.ObjectGVK
	jsonMap["permissions"] = i.Permissions
	jsonMap["validation"] = i.IstioValidation
	jsonMap["references"] = i.IstioReferences
	jsonMap["help"] = i.IstioConfigHelpFields

	return json.Marshal(jsonMap)
}

func (icd *IstioConfigDetails) UnmarshalJSON(data []byte) error {
	var temp struct {
		Namespace             Namespace               `json:"namespace"`
		ObjectGVK             schema.GroupVersionKind `json:"gvk"`
		Permissions           ResourcePermissions     `json:"permissions"`
		IstioValidation       *IstioValidation        `json:"validation"`
		IstioReferences       *IstioReferences        `json:"references"`
		IstioConfigHelpFields []IstioConfigHelp       `json:"help"`
		Resource              json.RawMessage         `json:"resource"`
	}

	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	icd.Namespace = temp.Namespace
	icd.ObjectGVK = temp.ObjectGVK
	icd.Permissions = temp.Permissions
	icd.IstioValidation = temp.IstioValidation
	icd.IstioReferences = temp.IstioReferences
	icd.IstioConfigHelpFields = temp.IstioConfigHelpFields

	// Based on the GVK, determine which resource type to unmarshal the resource into
	switch temp.ObjectGVK.String() {
	case kubernetes.AuthorizationPolicies.String():
		var ap security_v1.AuthorizationPolicy
		if err := json.Unmarshal(temp.Resource, &ap); err != nil {
			return err
		}
		icd.AuthorizationPolicy = &ap

	case kubernetes.DestinationRules.String():
		var dr networking_v1.DestinationRule
		if err := json.Unmarshal(temp.Resource, &dr); err != nil {
			return err
		}
		icd.DestinationRule = &dr

	case kubernetes.EnvoyFilters.String():
		var ef networking_v1alpha3.EnvoyFilter
		if err := json.Unmarshal(temp.Resource, &ef); err != nil {
			return err
		}
		icd.EnvoyFilter = &ef

	case kubernetes.Gateways.String():
		var gw networking_v1.Gateway
		if err := json.Unmarshal(temp.Resource, &gw); err != nil {
			return err
		}
		icd.Gateway = &gw

	case kubernetes.PeerAuthentications.String():
		var pa security_v1.PeerAuthentication
		if err := json.Unmarshal(temp.Resource, &pa); err != nil {
			return err
		}
		icd.PeerAuthentication = &pa

	case kubernetes.RequestAuthentications.String():
		var ra security_v1.RequestAuthentication
		if err := json.Unmarshal(temp.Resource, &ra); err != nil {
			return err
		}
		icd.RequestAuthentication = &ra

	case kubernetes.ServiceEntries.String():
		var se networking_v1.ServiceEntry
		if err := json.Unmarshal(temp.Resource, &se); err != nil {
			return err
		}
		icd.ServiceEntry = &se

	case kubernetes.Sidecars.String():
		var sc networking_v1.Sidecar
		if err := json.Unmarshal(temp.Resource, &sc); err != nil {
			return err
		}
		icd.Sidecar = &sc

	case kubernetes.VirtualServices.String():
		var vs networking_v1.VirtualService
		if err := json.Unmarshal(temp.Resource, &vs); err != nil {
			return err
		}
		icd.VirtualService = &vs

	case kubernetes.WorkloadEntries.String():
		var we networking_v1.WorkloadEntry
		if err := json.Unmarshal(temp.Resource, &we); err != nil {
			return err
		}
		icd.WorkloadEntry = &we

	case kubernetes.WorkloadGroups.String():
		var wg networking_v1.WorkloadGroup
		if err := json.Unmarshal(temp.Resource, &wg); err != nil {
			return err
		}
		icd.WorkloadGroup = &wg

	case kubernetes.WasmPlugins.String():
		var wp extentions_v1alpha1.WasmPlugin
		if err := json.Unmarshal(temp.Resource, &wp); err != nil {
			return err
		}
		icd.WasmPlugin = &wp

	case kubernetes.Telemetries.String():
		var tm telemetry_v1.Telemetry
		if err := json.Unmarshal(temp.Resource, &tm); err != nil {
			return err
		}
		icd.Telemetry = &tm

	case kubernetes.K8sGateways.String():
		var kg k8s_networking_v1.Gateway
		if err := json.Unmarshal(temp.Resource, &kg); err != nil {
			return err
		}
		icd.K8sGateway = &kg

	case kubernetes.K8sGRPCRoutes.String():
		var grpcRoute k8s_networking_v1.GRPCRoute
		if err := json.Unmarshal(temp.Resource, &grpcRoute); err != nil {
			return err
		}
		icd.K8sGRPCRoute = &grpcRoute

	case kubernetes.K8sHTTPRoutes.String():
		var httpRoute k8s_networking_v1.HTTPRoute
		if err := json.Unmarshal(temp.Resource, &httpRoute); err != nil {
			return err
		}
		icd.K8sHTTPRoute = &httpRoute

	case kubernetes.K8sReferenceGrants.String():
		var refGrant k8s_networking_v1beta1.ReferenceGrant
		if err := json.Unmarshal(temp.Resource, &refGrant); err != nil {
			return err
		}
		icd.K8sReferenceGrant = &refGrant

	case kubernetes.K8sTCPRoutes.String():
		var tcpRoute k8s_networking_v1alpha2.TCPRoute
		if err := json.Unmarshal(temp.Resource, &tcpRoute); err != nil {
			return err
		}
		icd.K8sTCPRoute = &tcpRoute

	case kubernetes.K8sTLSRoutes.String():
		var tlsRoute k8s_networking_v1alpha2.TLSRoute
		if err := json.Unmarshal(temp.Resource, &tlsRoute); err != nil {
			return err
		}
		icd.K8sTLSRoute = &tlsRoute

	default:
		return nil
	}
	return nil
}

// IstioConfigHelp represents a help message for a given Istio object type and field
type IstioConfigHelp struct {
	ObjectField string `json:"objectField"`
	Message     string `json:"message"`
}

// IstioConfigHelpMessages represents the help messages for a given Istio object type
var IstioConfigHelpMessages = map[string][]IstioConfigHelp{
	kubernetes.AuthorizationPolicies.String(): {
		{ObjectField: "spec.selector", Message: "Optional. The selector decides where to apply the authorization policy. The selector will match with workloads in the same namespace as the authorization policy. If the authorization policy is in the root namespace, the selector will additionally match with workloads in all namespaces."},
		{ObjectField: "spec.selector.matchLabels", Message: "One or more labels that indicate a specific set of pods/VMs on which a policy should be applied."},
		{ObjectField: "spec.rules", Message: "Optional. A list of rules to match the request. A match occurs when at least one rule matches the request."},
		{ObjectField: "spec.rules.from", Message: "Optional. from specifies the source of a request. If not set, any source is allowed."},
		{ObjectField: "spec.rules.from.source.principals", Message: "Optional. A list of peer identities derived from the peer certificate. If not set, any principal is allowed."},
		{ObjectField: "spec.rules.to", Message: "Optional. to specifies the operation of a request. If not set, any operation is allowed."},
		{ObjectField: "spec.rules.when", Message: "Optional. when specifies a list of additional conditions of a request. If not set, any condition is allowed."},
		{ObjectField: "spec.action", Message: "Optional. The action to take if the request is matched with the rules. Default is ALLOW if not specified."},
	},
	kubernetes.DestinationRules.String(): {
		{ObjectField: "spec.host", Message: "The name of a service from the service registry. Rules defined for services that do not exist in the service registry will be ignored."},
		{ObjectField: "spec.trafficPolicy", Message: "Traffic policies to apply (load balancing policy, connection pool sizes, outlier detection)."},
		{ObjectField: "spec.subsets", Message: "One or more named sets that represent individual versions of a service. Traffic policies can be overridden at subset level."},
		{ObjectField: "spec.exportTo", Message: "A list of namespaces to which this destination rule is exported. The resolution of a destination rule to apply to a service occurs in the context of a hierarchy of namespaces. This feature provides a mechanism for service owners and mesh administrators to control the visibility of destination rules across namespace boundaries. If no namespaces are specified then the destination rule is exported to all namespaces by default."},
	},
	kubernetes.EnvoyFilters.String(): {
		{ObjectField: "spec.workloadSelector", Message: "Criteria used to select the specific set of pods/VMs on which this patch configuration should be applied. If omitted, the set of patches in this configuration will be applied to all workload instances in the same namespace."},
		{ObjectField: "spec.configPatches", Message: "One or more patches with match conditions."},
		{ObjectField: "spec.configPatches.applyTo", Message: "Specifies where in the Envoy configuration, the patch should be applied."},
		{ObjectField: "spec.configPatches.match", Message: "Match on listener/route configuration/cluster."},
		{ObjectField: "spec.configPatches.patch", Message: "The patch to apply along with the operation."},
		{ObjectField: "spec.priority", Message: "riority defines the order in which patch sets are applied within a context. When one patch depends on another patch, the order of patch application is significant."},
	},
	kubernetes.Gateways.String(): {
		{ObjectField: "spec.servers", Message: "A list of server specifications."},
		{ObjectField: "spec.selector", Message: "One or more labels that indicate a specific set of pods/VMs on which this gateway configuration should be applied. By default workloads are searched across all namespaces based on label selectors."},
		{ObjectField: "spec.servers.port", Message: "The port on which the proxy should listen for incoming connections."},
		{ObjectField: "spec.servers.hosts", Message: "One or more hosts exposed by this gateway. While typically applicable to HTTP services, it can also be used for TCP services using TLS with SNI."},
		{ObjectField: "spec.servers.tls", Message: "Set of TLS related options that govern the server’s behavior. Use these options to control if all http requests should be redirected to https, and the TLS modes to use."},
	},
	kubernetes.Sidecars.String(): {
		{ObjectField: "spec.workloadSelector", Message: "Criteria used to select the specific set of pods/VMs on which this Sidecar configuration should be applied. If omitted, the Sidecar configuration will be applied to all workload instances in the same namespace."},
		{ObjectField: "spec.ingress", Message: "Ingress specifies the configuration of the sidecar for processing inbound traffic to the attached workload instance."},
		{ObjectField: "spec.egress", Message: "Egress specifies the configuration of the sidecar for processing outbound traffic from the attached workload instance to other services in the mesh"},
	},
	kubernetes.PeerAuthentications.String(): {
		{ObjectField: "spec.selector", Message: "The selector determines the workloads to apply the ChannelAuthentication on. If not set, the policy will be applied to all workloads in the same namespace as the policy."},
		{ObjectField: "spec.selector.matchLabels", Message: "One or more labels that indicate a specific set of pods/VMs on which a policy should be applied."},
		{ObjectField: "spec.mtls", Message: "Mutual TLS settings for workload. If not defined, inherit from parent."},
	},
	kubernetes.RequestAuthentications.String(): {
		{ObjectField: "spec.selector", Message: "Optional. The selector decides where to apply the request authentication policy. The selector will match with workloads in the same namespace as the request authentication policy. If the request authentication policy is in the root namespace, the selector will additionally match with workloads in all namespaces."},
		{ObjectField: "spec.selector.matchLabels", Message: "One or more labels that indicate a specific set of pods/VMs on which a policy should be applied."},
		{ObjectField: "spec.jwtRules", Message: "Define the list of JWTs that can be validated at the selected workloads’ proxy. A valid token will be used to extract the authenticated identity."},
	},
	kubernetes.ServiceEntries.String(): {
		{ObjectField: "spec.hosts", Message: "The hosts associated with the ServiceEntry. Could be a DNS name with wildcard prefix."},
		{ObjectField: "spec.addresses", Message: "The virtual IP addresses associated with the service. Could be CIDR prefix."},
		{ObjectField: "spec.ports", Message: "The ports associated with the external service. If the Endpoints are Unix domain socket addresses, there must be exactly one port."},
		{ObjectField: "spec.location", Message: "Specify whether the service should be considered external to the mesh or part of the mesh."},
		{ObjectField: "spec.resolution", Message: "Service discovery mode for the hosts."},
		{ObjectField: "spec.endpoints", Message: "One or more endpoints associated with the service. Only one of endpoints or workloadSelector can be specified."},
		{ObjectField: "spec.workloadSelector", Message: "Applicable only for MESH_INTERNAL services. Only one of endpoints or workloadSelector can be specified."},
		{ObjectField: "spec.exportTo", Message: "A list of namespaces to which this service is exported. Exporting a service allows it to be used by sidecars, gateways and virtual services defined in other namespaces. This feature provides a mechanism for service owners and mesh administrators to control the visibility of services across namespace boundaries."},
	},
	kubernetes.VirtualServices.String(): {
		{ObjectField: "spec.hosts", Message: "The destination hosts to which traffic is being sent. Could be a DNS name with wildcard prefix or an IP address. Depending on the platform, short-names can also be used instead of a FQDN (i.e. has no dots in the name)."},
		{ObjectField: "spec.gateways", Message: "The names of gateways and sidecars that should apply these routes. Gateways in other namespaces may be referred to by <gateway namespace>/<gateway name>; specifying a gateway with no namespace qualifier is the same as specifying the VirtualService’s namespace. To apply the rules to both gateways and sidecars, specify mesh as one of the gateway names."},
		{ObjectField: "spec.http", Message: "An ordered list of route rules for HTTP traffic."},
		{ObjectField: "spec.exportTo", Message: "A list of namespaces to which this virtual service is exported. Exporting a virtual service allows it to be used by sidecars and gateways defined in other namespaces."},
		{ObjectField: "spec.http.match", Message: "Match conditions to be satisfied for the rule to be activated."},
		{ObjectField: "spec.http.route", Message: "A HTTP rule can either redirect or forward (default) traffic. The forwarding target can be one of several versions of a service. Weights associated with the service version determine the proportion of traffic it receives."},
		{ObjectField: "spec.http.route.destination.host", Message: "The name of a service from the service registry. Service names are looked up from the platform’s service registry (e.g., Kubernetes services, Consul services, etc.) and from the hosts declared by ServiceEntry."},
		{ObjectField: "spec.http.route.destination.subset", Message: "The name of a subset within the service. Applicable only to services within the mesh. The subset must be defined in a corresponding DestinationRule."},
	},
	kubernetes.WorkloadEntries.String(): {
		{ObjectField: "spec.address", Message: "Address associated with the network endpoint without the port."},
		{ObjectField: "spec.ports", Message: "Set of ports associated with the endpoint."},
		{ObjectField: "spec.labels", Message: "One or more labels associated with the endpoint."},
		{ObjectField: "spec.network", Message: "Network enables Istio to group endpoints resident in the same L3 domain/network. All endpoints in the same network are assumed to be directly reachable from one another."},
		{ObjectField: "spec.locality", Message: "The locality associated with the endpoint. A locality corresponds to a failure domain (e.g., country/region/zone). Arbitrary failure domain hierarchies can be represented by separating each encapsulating failure domain by /."},
		{ObjectField: "spec.weight", Message: "The load balancing weight associated with the endpoint. Endpoints with higher weights will receive proportionally higher traffic."},
		{ObjectField: "spec.serviceAccount", Message: "The service account associated with the workload if a sidecar is present in the workload."},
	},
	kubernetes.WorkloadGroups.String(): {
		{ObjectField: "spec.metadata", Message: "Metadata that will be used for all corresponding WorkloadEntries. User labels for a workload group should be set here in metadata rather than in template."},
		{ObjectField: "spec.template", Message: "Template to be used for the generation of WorkloadEntry resources that belong to this WorkloadGroup."},
		{ObjectField: "spec.probe", Message: "ReadinessProbe describes the configuration the user must provide for healthchecking on their workload."},
	},
	kubernetes.WasmPlugins.String(): { // TODO
		{},
	},
	kubernetes.Telemetries.String(): { // TODO
		{},
	},
	kubernetes.K8sGateways.String(): {
		{ObjectField: "spec", Message: "Kubernetes Gateway API Configuration Object. A Gateway describes how traffic can be translated to Services within the cluster."},
		{ObjectField: "spec.gatewayClassName", Message: "Defines the name of a GatewayClass object used by this Gateway."},
		{ObjectField: "spec.listeners", Message: "Define the hostnames, ports, protocol, termination, TLS settings and which routes can be attached to a listener."},
		{ObjectField: "spec.addresses", Message: "Define the network addresses requested for this gateway."},
	},
	kubernetes.K8sGRPCRoutes.String(): {
		{ObjectField: "", Message: "Kubernetes Gateway API Configuration Object. GRPCRoute provides a way to route gRPC requests"},
	},
	kubernetes.K8sHTTPRoutes.String(): { // TODO
		{ObjectField: "", Message: "Kubernetes Gateway API Configuration Object. HTTPRoute is for multiplexing HTTP or terminated HTTPS connections."},
	},
	kubernetes.K8sReferenceGrants.String(): {
		{ObjectField: "spec", Message: "Kubernetes Gateway API Configuration Object. ReferenceGrant is for enabling cross namespace references within Gateway API."},
		{ObjectField: "spec.from", Message: "Define the group, kind, and namespace of resources that may reference items described in the to list."},
		{ObjectField: "spec.to", Message: "Define the group and kind of resources that may be referenced by items described in the from list."},
	},
	kubernetes.K8sTCPRoutes.String(): {
		{ObjectField: "", Message: "Kubernetes Gateway API Configuration Object. TCPRoute provides a way to route TCP requests"},
	},
	kubernetes.K8sTLSRoutes.String(): {
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
			filtered[ns].DestinationRules = []*networking_v1.DestinationRule{}
			filtered[ns].EnvoyFilters = []*networking_v1alpha3.EnvoyFilter{}
			filtered[ns].Gateways = []*networking_v1.Gateway{}
			filtered[ns].K8sGateways = []*k8s_networking_v1.Gateway{}
			filtered[ns].K8sGRPCRoutes = []*k8s_networking_v1.GRPCRoute{}
			filtered[ns].K8sHTTPRoutes = []*k8s_networking_v1.HTTPRoute{}
			filtered[ns].K8sReferenceGrants = []*k8s_networking_v1beta1.ReferenceGrant{}
			filtered[ns].K8sTCPRoutes = []*k8s_networking_v1alpha2.TCPRoute{}
			filtered[ns].K8sTLSRoutes = []*k8s_networking_v1alpha2.TLSRoute{}
			filtered[ns].VirtualServices = []*networking_v1.VirtualService{}
			filtered[ns].ServiceEntries = []*networking_v1.ServiceEntry{}
			filtered[ns].Sidecars = []*networking_v1.Sidecar{}
			filtered[ns].WorkloadEntries = []*networking_v1.WorkloadEntry{}
			filtered[ns].WorkloadGroups = []*networking_v1.WorkloadGroup{}
			filtered[ns].AuthorizationPolicies = []*security_v1.AuthorizationPolicy{}
			filtered[ns].PeerAuthentications = []*security_v1.PeerAuthentication{}
			filtered[ns].RequestAuthentications = []*security_v1.RequestAuthentication{}
			filtered[ns].WasmPlugins = []*extentions_v1alpha1.WasmPlugin{}
			filtered[ns].Telemetries = []*telemetry_v1.Telemetry{}
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

	return configList
}
