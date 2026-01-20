package get_action_ui

import (
	"fmt"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/models"
)

// GroupVersionKind is the struct representation of the value object
type GroupVersionKind struct {
	Group   string
	Version string
	Kind    string
}

// Define the gvkType constants
// (In TS this was likely an Enum or String Union)
const (
	// Istio Security
	AuthorizationPolicy   = "AuthorizationPolicy"
	PeerAuthentication    = "PeerAuthentication"
	RequestAuthentication = "RequestAuthentication"

	// Istio Networking
	DestinationRule = "DestinationRule"
	Gateway         = "Gateway"
	EnvoyFilter     = "EnvoyFilter"
	Sidecar         = "Sidecar"
	ServiceEntry    = "ServiceEntry"
	VirtualService  = "VirtualService"
	WorkloadEntry   = "WorkloadEntry"
	WorkloadGroup   = "WorkloadGroup"

	// Istio Extensions / Telemetry
	WasmPlugin = "WasmPlugin"
	Telemetry  = "Telemetry"

	// K8s Gateway API
	K8sGateway        = "K8sGateway"
	K8sGatewayClass   = "K8sGatewayClass"
	K8sGRPCRoute      = "K8sGRPCRoute"
	K8sHTTPRoute      = "K8sHTTPRoute"
	K8sInferencePool  = "K8sInferencePool"
	K8sReferenceGrant = "K8sReferenceGrant"
	K8sTCPRoute       = "K8sTCPRoute"
	K8sTLSRoute       = "K8sTLSRoute"

	// K8s Workloads
	CronJob               = "CronJob"
	DaemonSet             = "DaemonSet"
	Deployment            = "Deployment"
	DeploymentConfig      = "DeploymentConfig"
	Job                   = "Job"
	Pod                   = "Pod"
	ReplicaSet            = "ReplicaSet"
	ReplicationController = "ReplicationController"
	StatefulSet           = "StatefulSet"
)

// DicTypeToGVK is the map translation
var DicTypeToGVK = map[string]GroupVersionKind{
	// Istio Security
	AuthorizationPolicy:   {Group: "security.istio.io", Version: "v1", Kind: AuthorizationPolicy},
	PeerAuthentication:    {Group: "security.istio.io", Version: "v1", Kind: PeerAuthentication},
	RequestAuthentication: {Group: "security.istio.io", Version: "v1", Kind: RequestAuthentication},

	// Istio Networking
	DestinationRule: {Group: "networking.istio.io", Version: "v1", Kind: DestinationRule},
	Gateway:         {Group: "networking.istio.io", Version: "v1", Kind: Gateway},
	EnvoyFilter:     {Group: "networking.istio.io", Version: "v1alpha3", Kind: EnvoyFilter},
	Sidecar:         {Group: "networking.istio.io", Version: "v1", Kind: Sidecar},
	ServiceEntry:    {Group: "networking.istio.io", Version: "v1", Kind: ServiceEntry},
	VirtualService:  {Group: "networking.istio.io", Version: "v1", Kind: VirtualService},
	WorkloadEntry:   {Group: "networking.istio.io", Version: "v1", Kind: WorkloadEntry},
	WorkloadGroup:   {Group: "networking.istio.io", Version: "v1", Kind: WorkloadGroup},

	// Istio Extensions / Telemetry
	WasmPlugin: {Group: "extensions.istio.io", Version: "v1alpha1", Kind: WasmPlugin},
	Telemetry:  {Group: "telemetry.istio.io", Version: "v1", Kind: Telemetry},

	// K8s Gateway API
	// Note: The 'Kind' here is hardcoded string (e.g. "Gateway") rather than the key constant (K8sGateway)
	// to match the logic in your TypeScript snippet.
	K8sGateway:        {Group: "gateway.networking.k8s.io", Version: "v1", Kind: "Gateway"},
	K8sGatewayClass:   {Group: "gateway.networking.k8s.io", Version: "v1", Kind: "GatewayClass"},
	K8sGRPCRoute:      {Group: "gateway.networking.k8s.io", Version: "v1", Kind: "GRPCRoute"},
	K8sHTTPRoute:      {Group: "gateway.networking.k8s.io", Version: "v1", Kind: "HTTPRoute"},
	K8sInferencePool:  {Group: "inference.networking.k8s.io", Version: "v1", Kind: "InferencePool"},
	K8sReferenceGrant: {Group: "gateway.networking.k8s.io", Version: "v1beta1", Kind: "ReferenceGrant"},
	K8sTCPRoute:       {Group: "gateway.networking.k8s.io", Version: "v1alpha2", Kind: "TCPRoute"},
	K8sTLSRoute:       {Group: "gateway.networking.k8s.io", Version: "v1alpha2", Kind: "TLSRoute"},

	// K8s Workloads
	CronJob:               {Group: "batch", Version: "v1", Kind: "CronJob"},
	DaemonSet:             {Group: "apps", Version: "v1", Kind: "DaemonSet"},
	Deployment:            {Group: "apps", Version: "v1", Kind: "Deployment"},
	DeploymentConfig:      {Group: "apps.openshift.io", Version: "v1", Kind: "DeploymentConfig"},
	Job:                   {Group: "batch", Version: "v1", Kind: "Job"},
	Pod:                   {Group: "", Version: "v1", Kind: "Pod"},
	ReplicaSet:            {Group: "apps", Version: "v1", Kind: "ReplicaSet"},
	ReplicationController: {Group: "", Version: "v1", Kind: "ReplicationController"},
	StatefulSet:           {Group: "apps", Version: "v1", Kind: "StatefulSet"},
}

func gvkToString(gvk GroupVersionKind) string {
	if gvk.Group == "" {
		return fmt.Sprintf("%s/%s", gvk.Version, gvk.Kind)
	}
	return fmt.Sprintf("%s/%s/%s", gvk.Group, gvk.Version, gvk.Kind)
}

func GetGVKTypeString(gvk any) (string, error) {
	// Type switch acts like the "typeof" check in TypeScript
	switch v := gvk.(type) {

	case string:
		// Logic: Lookup in map
		gvkEntry, exists := DicTypeToGVK[v]
		if !exists {
			return "", fmt.Errorf("GVK type '%s' not found in DicTypeToGVK", v)
		}
		return gvkToString(gvkEntry), nil

	case GroupVersionKind:
		// Logic: Direct formatting
		return gvkToString(v), nil

	default:
		// Logic: Handle unexpected types
		return "", fmt.Errorf("unsupported type: %T", v)
	}
}

func filterIstioObjectsByName(istioObjectsList *models.IstioConfigList, name string) []runtime.Object {
	result := []runtime.Object{}
	result = appendFiltered(result, istioObjectsList.AuthorizationPolicies, name)
	result = appendFiltered(result, istioObjectsList.DestinationRules, name)
	result = appendFiltered(result, istioObjectsList.EnvoyFilters, name)
	result = appendFiltered(result, istioObjectsList.Gateways, name)
	result = appendFiltered(result, istioObjectsList.K8sGateways, name)
	result = appendFiltered(result, istioObjectsList.K8sGRPCRoutes, name)
	result = appendFiltered(result, istioObjectsList.K8sHTTPRoutes, name)
	result = appendFiltered(result, istioObjectsList.K8sInferencePools, name)
	result = appendFiltered(result, istioObjectsList.K8sReferenceGrants, name)
	result = appendFiltered(result, istioObjectsList.K8sTCPRoutes, name)
	result = appendFiltered(result, istioObjectsList.K8sTLSRoutes, name)
	result = appendFiltered(result, istioObjectsList.PeerAuthentications, name)
	result = appendFiltered(result, istioObjectsList.RequestAuthentications, name)
	result = appendFiltered(result, istioObjectsList.ServiceEntries, name)
	result = appendFiltered(result, istioObjectsList.Sidecars, name)
	result = appendFiltered(result, istioObjectsList.Telemetries, name)
	result = appendFiltered(result, istioObjectsList.VirtualServices, name)
	result = appendFiltered(result, istioObjectsList.WasmPlugins, name)
	result = appendFiltered(result, istioObjectsList.WorkloadEntries, name)
	result = appendFiltered(result, istioObjectsList.WorkloadGroups, name)
	return result
}

func appendFiltered[T runtime.Object](result []runtime.Object, objects []T, name string) []runtime.Object {
	for _, obj := range FilterByName(objects, name) {
		result = append(result, obj)
	}
	return result
}

// FilterByName filters a list of runtime.Objects by the provided name.
// If the object's name is not in the provided name, the object
// is filtered out.
func FilterByName[T runtime.Object](objects []T, name string) []T {
	filtered := []T{}
	for _, obj := range objects {
		o, err := meta.Accessor(obj)
		// This shouldn't happen since we are using runtime.Object for T
		// and all the API objects should implement meta.Object.
		if err != nil {
			return filtered
		}

		if o.GetName() == name {
			filtered = append(filtered, obj)
		}
	}
	return filtered
}

// GetActionsForIstioObjects gets the actions for the Istio objects
// It returns a list of actions that can be used to navigate to the Istio object details page.
func GetActionsForIstioObjects(istioObjectsFiltered []runtime.Object) []Action {
	actions := []Action{}
	for _, istioObject := range istioObjectsFiltered {
		o, err := meta.Accessor(istioObject)
		// This shouldn't happen since we are using runtime.Object for T
		// and all the API objects should implement meta.Object.
		if err != nil {
			continue
		}
		gvk := istioObject.GetObjectKind().GroupVersionKind()
		kind := gvk.Kind
		apiVersion := gvk.GroupVersion().String()
		actions = append(actions, Action{
			Title:   "View Istio " + o.GetName() + " Details",
			Kind:    ActionKindNavigation,
			Payload: "/namespaces/" + o.GetNamespace() + "/istio/" + apiVersion + "/" + kind + "/" + o.GetName(),
		})
	}

	return actions
}
