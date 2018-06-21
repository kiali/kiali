package models

import (
	"github.com/kiali/kiali/kubernetes"
)

// DestinationPolicies destinationPolicies
//
// This is used for returning an array of DestinationPolicies
//
// swagger:model destinationPolicies
// An array of destinationPolicie
// swagger:allOf
type DestinationPolicies []DestinationPolicy

// DestinationPolicy destinationPolicy
//
// This is used for returning a DestinationPolicy
//
// swagger:model destinationPolicy
type DestinationPolicy struct {
	// The name of the destinationPolicy
	//
	// required: true
	Name string `json:"name"`
	// The creation date of the destinationPolicy
	//
	// required: true
	CreatedAt string `json:"createdAt"`
	// The resource version of the destinationPolicy
	//
	// required: true
	ResourceVersion string      `json:"resourceVersion"`
	Source          interface{} `json:"source"`
	Destination     interface{} `json:"destination"`
	LoadBalancing   interface{} `json:"loadbalancing"`
	CircuitBreaker  interface{} `json:"circuitBreaker"`
}

func (policies *DestinationPolicies) Parse(destinationPolicies []kubernetes.IstioObject) {
	for _, dp := range destinationPolicies {
		destinationPolicy := DestinationPolicy{}
		destinationPolicy.Parse(dp)
		*policies = append(*policies, destinationPolicy)
	}
}

func (policy *DestinationPolicy) Parse(destinationPolicy kubernetes.IstioObject) {
	policy.Name = destinationPolicy.GetObjectMeta().Name
	policy.CreatedAt = formatTime(destinationPolicy.GetObjectMeta().CreationTimestamp.Time)
	policy.ResourceVersion = destinationPolicy.GetObjectMeta().ResourceVersion
	policy.Source = destinationPolicy.GetSpec()["source"]
	policy.Destination = destinationPolicy.GetSpec()["destination"]
	policy.LoadBalancing = destinationPolicy.GetSpec()["loadBalancing"]
	policy.CircuitBreaker = destinationPolicy.GetSpec()["circuitBreaker"]
}
