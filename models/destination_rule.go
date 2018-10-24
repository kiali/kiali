package models

import (
	"github.com/kiali/kiali/config"
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

func (dRule *DestinationRule) HasCircuitBreaker(namespace string, serviceName string, version string) bool {
	if host, ok := dRule.Host.(string); ok && kubernetes.FilterByHost(host, serviceName, namespace) {
		// CB is set at DR level, so it's true for the service and all versions
		if isCircuitBreakerTrafficPolicy(dRule.TrafficPolicy) {
			return true
		}
		if subsets, ok := dRule.Subsets.([]interface{}); ok {
			cfg := config.Get()
			for _, subsetInterface := range subsets {
				if subset, ok := subsetInterface.(map[string]interface{}); ok {
					if trafficPolicy, ok := subset["trafficPolicy"]; ok && isCircuitBreakerTrafficPolicy(trafficPolicy) {
						// set the service true if it has a subset with a CB
						if "" == version {
							return true
						}
						if labels, ok := subset["labels"]; ok {
							if dLabels, ok := labels.(map[string]interface{}); ok {
								if versionValue, ok := dLabels[cfg.IstioLabels.VersionLabelName]; ok && versionValue == version {
									return true
								}
							}
						}
					}
				}
			}
		}
	}
	return false
}

func isCircuitBreakerTrafficPolicy(trafficPolicy interface{}) bool {
	if trafficPolicy == nil {
		return false
	}
	if dTrafficPolicy, ok := trafficPolicy.(map[string]interface{}); ok {
		if _, ok := dTrafficPolicy["connectionPool"]; ok {
			return true
		}
		if _, ok := dTrafficPolicy["outlierDetection"]; ok {
			return true
		}
	}
	return false
}
