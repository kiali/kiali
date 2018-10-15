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
	Namespace         Namespace         `json:"namespace"`
	Gateways          Gateways          `json:"gateways"`
	VirtualServices   VirtualServices   `json:"virtualServices"`
	DestinationRules  DestinationRules  `json:"destinationRules"`
	ServiceEntries    ServiceEntries    `json:"serviceEntries"`
	Rules             IstioRules        `json:"rules"`
	QuotaSpecs        QuotaSpecs        `json:"quotaSpecs"`
	QuotaSpecBindings QuotaSpecBindings `json:"quotaSpecBindings"`
	// The permissions associated with the Istio objects. This is a map of Istio object kind (destinationrules, virtualservices, etc.) x ResourcePermissions
	// Example: {"destinationrules": {create: false, update: true, delete: false}}
	Permissions map[string]ResourcePermissions `json:"permissions"`
}

type IstioConfigDetails struct {
	Namespace        Namespace           `json:"namespace"`
	ObjectType       string              `json:"objectType"`
	Gateway          *Gateway            `json:"gateway"`
	VirtualService   *VirtualService     `json:"virtualService"`
	DestinationRule  *DestinationRule    `json:"destinationRule"`
	ServiceEntry     *ServiceEntry       `json:"serviceEntry"`
	Rule             *IstioRuleDetails   `json:"rule"`
	QuotaSpec        *QuotaSpec          `json:"quotaSpec"`
	QuotaSpecBinding *QuotaSpecBinding   `json:"quotaSpecBinding"`
	Permissions      ResourcePermissions `json:"permissions"`
}

// ResourcePermissions holds permission flags for an object type
// True means allowed.
type ResourcePermissions struct {
	Create bool `json:"create"`
	Update bool `json:"update"`
	Delete bool `json:"delete"`
}
