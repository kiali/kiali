package models

type IstioConfigList struct {
	Namespace           Namespace           `json:"namespace"`
	RouteRules          RouteRules          `json:"route_rules"`
	DestinationPolicies DestinationPolicies `json:"destination_policies"`
	VirtualServices     VirtualServices     `json:"virtual_services"`
	DestinationRules    DestinationRules    `json:"destination_rules"`
	Rules               []IstioRule         `json:"rules"`
}

type IstioConfigDetails struct {
	Namespace         Namespace          `json:"namespace"`
	ObjectType        string             `json:"object_type"`
	RouteRule         *RouteRule         `json:"route_rule"`
	DestinationPolicy *DestinationPolicy `json:"destination_policy"`
	VirtualService    *VirtualService    `json:"virtual_service"`
	DestinationRule   *DestinationRule   `json:"destination_rule"`
	Rule              *IstioRuleDetails  `json:"rule"`
}
