package models

type IstioConfigList struct {
	Namespace           Namespace           `json:"namespace"`
	Gateways            Gateways            `json:"gateways"`
	RouteRules          RouteRules          `json:"routeRules"`
	DestinationPolicies DestinationPolicies `json:"destinationPolicies"`
	VirtualServices     VirtualServices     `json:"virtualServices"`
	DestinationRules    DestinationRules    `json:"destinationRules"`
	Rules               IstioRules          `json:"rules"`
}

type IstioConfigDetails struct {
	Namespace         Namespace          `json:"namespace"`
	ObjectType        string             `json:"objectType"`
	Gateway           *Gateway           `json:"gateway"`
	RouteRule         *RouteRule         `json:"routeRule"`
	DestinationPolicy *DestinationPolicy `json:"destinationPolicy"`
	VirtualService    *VirtualService    `json:"virtualService"`
	DestinationRule   *DestinationRule   `json:"destinationRule"`
	Rule              *IstioRuleDetails  `json:"rule"`
}
