package models

import (
	"github.com/kiali/kiali/kubernetes"
)

// DestinationRules destinationRules
//
// This is used for returning an array of DestinationRules
//
// swagger:model destinationRules
// An array of destinationRule
// swagger:allOf
type DestinationRules []DestinationRule

// DestinationRule destinationRule
//
// This is used for returning a DestinationRule
//
// swagger:model destinationRule
type DestinationRule struct {
	// The name of the destinationRule
	//
	// required: true
	Name string `json:"name"`
	// The creation date of the destinationRule
	//
	// required: true
	CreatedAt string `json:"createdAt"`
	// The resource version of the destinationRule
	//
	// required: true
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
