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
	CircuitBreaker interface{} `json:"route"`
}

func (policies *DestinationPolicies) Parse(destinationPolicies []*kubernetes.DestinationPolicy) {
	for _, dp := range destinationPolicies {
		destinationPolicy := DestinationPolicy{}
		destinationPolicy.Parse(dp)
		*policies = append(*policies, destinationPolicy)
	}
}

func (policy *DestinationPolicy) Parse(destinationPolicy *kubernetes.DestinationPolicy) {
	policy.Name = destinationPolicy.ObjectMeta.Name
	policy.Source = destinationPolicy.Spec["source"]
	policy.Destination = destinationPolicy.Spec["destination"]
	policy.LoadBalancing = destinationPolicy.Spec["loadBalancing"]
	policy.CircuitBreaker = destinationPolicy.Spec["circuitBreaker"]
}
