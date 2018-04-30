package models

import (
	"time"

	"github.com/kiali/kiali/kubernetes"
)

type DestinationPolicies []DestinationPolicy
type DestinationPolicy struct {
	Name            string      `json:"name"`
	CreatedAt       string      `json:"created_at"`
	ResourceVersion string      `json:"resource_version"`
	Source          interface{} `json:"source,omitempty"`
	Destination     interface{} `json:"destination,omitempty"`
	LoadBalancing   interface{} `json:"loadbalancing,omitempty"`
	CircuitBreaker  interface{} `json:"circuitBreaker,omitempty"`
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
	policy.CreatedAt = destinationPolicy.GetObjectMeta().CreationTimestamp.Time.Format(time.RFC3339)
	policy.ResourceVersion = destinationPolicy.GetObjectMeta().ResourceVersion
	policy.Source = destinationPolicy.GetSpec()["source"]
	policy.Destination = destinationPolicy.GetSpec()["destination"]
	policy.LoadBalancing = destinationPolicy.GetSpec()["loadBalancing"]
	policy.CircuitBreaker = destinationPolicy.GetSpec()["circuitBreaker"]
}
