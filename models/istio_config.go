package models

// IstioConfigList istioConfigList
//
// This type is used for returning a response of IstioConfigList
//
// swagger:model IstioConfigList
type IstioConfigList struct {
	// The namespace of istioConfiglist
	//
	// required: true
	Namespace              Namespace              `json:"namespace"`
	Gateways               Gateways               `json:"gateways"`
	VirtualServices        VirtualServices        `json:"virtualServices"`
	DestinationRules       DestinationRules       `json:"destinationRules"`
	ServiceEntries         ServiceEntries         `json:"serviceEntries"`
	WorkloadEntries        WorkloadEntries        `json:"workloadEntries"`
	EnvoyFilters           EnvoyFilters           `json:"envoyFilters"`
	Sidecars               Sidecars               `json:"sidecars"`
	AuthorizationPolicies  AuthorizationPolicies  `json:"authorizationPolicies"`
	PeerAuthentications    PeerAuthentications    `json:"peerAuthentications"`
	RequestAuthentications RequestAuthentications `json:"requestAuthentications"`
	IstioValidations       IstioValidations       `json:"validations"`
}

type IstioConfigDetails struct {
	Namespace             Namespace              `json:"namespace"`
	ObjectType            string                 `json:"objectType"`
	Gateway               *Gateway               `json:"gateway"`
	VirtualService        *VirtualService        `json:"virtualService"`
	DestinationRule       *DestinationRule       `json:"destinationRule"`
	ServiceEntry          *ServiceEntry          `json:"serviceEntry"`
	WorkloadEntry         *WorkloadEntry         `json:"workloadEntry"`
	EnvoyFilter           *EnvoyFilter           `json:"envoyFilter"`
	Sidecar               *Sidecar               `json:"sidecar"`
	AuthorizationPolicy   *AuthorizationPolicy   `json:"authorizationPolicy"`
	PeerAuthentication    *PeerAuthentication    `json:"peerAuthentication"`
	RequestAuthentication *RequestAuthentication `json:"requestAuthentication"`
	Permissions           ResourcePermissions    `json:"permissions"`
	IstioValidation       *IstioValidation       `json:"validation"`
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
