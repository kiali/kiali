package models

import (
	"github.com/kiali/swscore/kubernetes"
)

type DestinationPolicies []DestinationPolicy
type DestinationPolicy struct {
	Name           string      `json:"name"`
	Source         interface{} `json:"source"`
	Destination    interface{} `json:"destination"`
	LoadBalancing  interface{} `json:"loadbalancing"`
	CircuitBreaker interface{} `json:"circuitBreaker"`
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
	policy.Source = destinationPolicy.GetSpec()["source"]
	policy.Destination = destinationPolicy.GetSpec()["destination"]
	policy.LoadBalancing = destinationPolicy.GetSpec()["loadBalancing"]
	policy.CircuitBreaker = destinationPolicy.GetSpec()["circuitBreaker"]
}
