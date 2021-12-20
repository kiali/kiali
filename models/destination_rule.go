package models

import (
	api_networking_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

func HasDRCircuitBreaker(dr *networking_v1alpha3.DestinationRule, namespace, serviceName, version string) bool {
	if kubernetes.FilterByHost(dr.Spec.Host, dr.Namespace, serviceName, namespace) {
		if isCB(dr.Spec.TrafficPolicy) {
			return true
		}
		for _, subset := range dr.Spec.Subsets {
			cfg := config.Get()
			if subset == nil {
				continue
			}
			if isCB(subset.TrafficPolicy) {
				if version == "" {
					return true
				}
				if versionValue, ok := subset.Labels[cfg.IstioLabels.VersionLabelName]; ok && versionValue == version {
					return true
				}
			}
		}
	}
	return false
}

func isCB(trafficPolicy *api_networking_v1alpha3.TrafficPolicy) bool {
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
