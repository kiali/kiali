package models

import (
	"github.com/kiali/kiali/kubernetes"
)

type DestinationRules []DestinationRule
type DestinationRule struct {
	Name            string      `json:"name"`
	CreatedAt       string      `json:"createdAt"`
	ResourceVersion string      `json:"resourceVersion"`
	Host            interface{} `json:"host"`
	TrafficPolicy   interface{} `json:"trafficPolicy"`
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
	dRule.CreatedAt = formatTime(destinationRule.GetObjectMeta().CreationTimestamp.Time)
	dRule.ResourceVersion = destinationRule.GetObjectMeta().ResourceVersion
	dRule.Host = destinationRule.GetSpec()["host"]
	dRule.TrafficPolicy = destinationRule.GetSpec()["trafficPolicy"]
	dRule.Subsets = destinationRule.GetSpec()["subsets"]
}
