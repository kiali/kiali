package models

// HTTP status code 200 and IstioConfigList model in data
// swagger:response istioConfigList
type swaggIstioConfigList struct {
	// in:body
	Body struct {
		// HTTP status code
		// default: 200
		Code int `json:"code"`
		// IstioConfigList model
		Data IstioConfigList `json:"data"`
	}
}

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
}

type IstioConfigDetails struct {
	Namespace        Namespace         `json:"namespace"`
	ObjectType       string            `json:"objectType"`
	Gateway          *Gateway          `json:"gateway"`
	VirtualService   *VirtualService   `json:"virtualService"`
	DestinationRule  *DestinationRule  `json:"destinationRule"`
	ServiceEntry     *ServiceEntry     `json:"serviceEntry"`
	Rule             *IstioRuleDetails `json:"rule"`
	QuotaSpec        *QuotaSpec        `json:"quotaSpec"`
	QuotaSpecBinding *QuotaSpecBinding `json:"quotaSpecBinding"`
}
