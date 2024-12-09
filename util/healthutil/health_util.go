package healthutil

import (
	"strconv"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"istio.io/api/meta/v1alpha1"
)

// Reused an Istio code

const (
	// WorkloadEntryHealthCheckAnnotation is the annotation that is added to workload entries when
	// health checks are enabled.
	// If this annotation is present, a WorkloadEntry with the condition Healthy=False or Healthy not set
	// should be treated as unhealthy and not sent to proxies
	WorkloadEntryHealthCheckAnnotation = "proxy.istio.io/health-checks-enabled"

	// ConditionHealthy defines a status field to declare if a WorkloadEntry is healthy or not
	ConditionHealthy = "Healthy"
)

// IsWorkloadEntryHealthy checks that the provided WorkloadEntry is healthy. If health checks are not enabled,
// it is assumed to always be healthy
func IsWorkloadEntryHealthy(wentry *networking_v1.WorkloadEntry) bool {
	if parseHealthAnnotation(wentry.Annotations[WorkloadEntryHealthCheckAnnotation]) {
		// We default to false if the condition is not set. This ensures newly created WorkloadEntries
		// are treated as unhealthy until we prove they are healthy by probe success.
		return GetBoolCondition(wentry.Status.Conditions, ConditionHealthy, false)
	}
	// If health check is not enabled, assume its healthy
	return true
}

func parseHealthAnnotation(s string) bool {
	if s == "" {
		return false
	}
	p, err := strconv.ParseBool(s)
	if err != nil {
		return false
	}
	return p
}

func GetBoolCondition(conditions []*v1alpha1.IstioCondition, condition string, defaultValue bool) bool {
	got := GetCondition(conditions, condition)
	if got == nil {
		return defaultValue
	}
	if got.Status == "True" {
		return true
	}
	if got.Status == "False" {
		return false
	}
	return defaultValue
}

func GetCondition(conditions []*v1alpha1.IstioCondition, condition string) *v1alpha1.IstioCondition {
	for _, cond := range conditions {
		if cond.Type == condition {
			return cond
		}
	}
	return nil
}
