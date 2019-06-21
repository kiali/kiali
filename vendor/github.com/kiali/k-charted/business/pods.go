package business

import (
	"strings"

	"github.com/kiali/k-charted/model"
)

func extractUniqueDashboards(pods []model.Pod) []string {
	// Get uniqueness from plain list rather than map to preserve ordering; anyway, very low amount of objects is expected
	uniqueRefs := []string{}
	for _, pod := range pods {
		// Check for custom dashboards annotation
		dashboards := extractDashboardsFromAnnotation(pod, "kiali.io/runtimes")
		dashboards = append(dashboards, extractDashboardsFromAnnotation(pod, "kiali.io/dashboards")...)
		for _, ref := range dashboards {
			if ref != "" {
				exists := false
				for _, existingRef := range uniqueRefs {
					if ref == existingRef {
						exists = true
						break
					}
				}
				if !exists {
					uniqueRefs = append(uniqueRefs, ref)
				}
			}
		}
	}
	return uniqueRefs
}

func extractDashboardsFromAnnotation(pod model.Pod, annotation string) []string {
	dashboards := []string{}
	if rawDashboards, ok := pod.GetAnnotations()[annotation]; ok {
		rawDashboardsSlice := strings.Split(rawDashboards, ",")
		for _, dashboard := range rawDashboardsSlice {
			dashboards = append(dashboards, strings.TrimSpace(dashboard))
		}
	}
	return dashboards
}
