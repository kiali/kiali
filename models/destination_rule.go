package models

import (
	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

type (
	// DestinationRuleSubsets is a mapping of DestinationRule's hosts to their subsets and associated Host objects
	// - The first key represents the host in FQDN format
	// - The second key represents the subset name
	// - The value is a Host object containing additional details such as the service, cluster, etc.
	DestinationRuleSubsets map[string]map[string]kubernetes.Host
)

func HasDRCircuitBreaker(dr *networking_v1.DestinationRule, namespace, serviceName, version string) bool {
	conf := config.Get()
	if kubernetes.FilterByHost(dr.Spec.Host, dr.Namespace, serviceName, namespace, conf) {
		if isCB(dr.Spec.TrafficPolicy) {
			return true
		}
		for _, subset := range dr.Spec.Subsets {
			if subset == nil {
				continue
			}
			if isCB(subset.TrafficPolicy) {
				if version == "" {
					return true
				}
				if verLabelName, found := conf.GetVersionLabelName(subset.Labels); found {
					if versionValue, ok := subset.Labels[verLabelName]; ok && versionValue == version {
						return true
					}
				}
			}
		}
	}
	return false
}

func isCB(trafficPolicy *api_networking_v1.TrafficPolicy) bool {
	if trafficPolicy == nil {
		return false
	}
	if trafficPolicy.ConnectionPool != nil {
		return true
	}
	if trafficPolicy.OutlierDetection != nil {
		return true
	}
	return false
}
