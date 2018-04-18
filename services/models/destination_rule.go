package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type DestinationRules []DestinationRule
type DestinationRule struct {
	Name            string      `json:"name"`
	DestinationName interface{} `json:"destination_name"`
	TrafficPolicy   interface{} `json:"traffic_policy"`
	Subsets         interface{} `json:"subsets"`
}

func (dRules *DestinationRules) Parse(destinationRules []kubernetes.IstioObject) {
	for _, dr := range destinationRules {
		destinationRule := DestinationRule{}
		destinationRule.Parse(dr)
		*dRules = append(*dRules, destinationRule)
	}
}

func (dRule *DestinationRule) Parse(destinationRule kubernetes.IstioObject) {
	dRule.Name = destinationRule.GetObjectMeta().Name
	dRule.DestinationName = destinationRule.GetSpec()["name"]
	dRule.TrafficPolicy = destinationRule.GetSpec()["trafficPolicy"]
	dRule.Subsets = destinationRule.GetSpec()["subsets"]
}
