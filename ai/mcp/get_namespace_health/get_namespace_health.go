package get_namespace_health

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

type GetNamespaceHealthResponse struct {
	Errors     string                   `json:"errors,omitempty"`
	Namespaces []NamespaceHealthSummary `json:"namespaces"`
	Summary    string                   `json:"summary"`
}

type HealthCounts struct {
	Degraded     int `json:"degraded"`
	Failure      int `json:"failure"`
	Healthy      int `json:"healthy"`
	NotAvailable int `json:"not_available"`
	Total        int `json:"total"`
}

type IstioConfigCounts struct {
	Errors   int `json:"errors"`
	Total    int `json:"total"`
	Valid    int `json:"valid"`
	Warnings int `json:"warnings"`
}

type MTLSInfo struct {
	AutoMTLSEnabled bool   `json:"auto_mtls_enabled"`
	Status          string `json:"status"`
}

type NamespaceHealthSummary struct {
	Apps           HealthCounts      `json:"apps"`
	Cluster        string            `json:"cluster"`
	IsAmbient      bool              `json:"is_ambient"`
	IsControlPlane bool              `json:"is_control_plane"`
	IstioConfig    IstioConfigCounts `json:"istio_config"`
	Labels         map[string]string `json:"labels,omitempty"`
	MTLS           MTLSInfo          `json:"mtls"`
	Namespace      string            `json:"namespace"`
	Revision       string            `json:"revision,omitempty"`
	Services       HealthCounts      `json:"services"`
	Type           string            `json:"type"`
	Workloads      HealthCounts      `json:"workloads"`
}

func Execute(r *http.Request, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
	namespacesArg := mcputil.GetStringArg(args, "namespaces")
	clusterName := mcputil.GetStringArg(args, "clusterName", "cluster_name")

	if clusterName == "" {
		clusterName = conf.KubernetesConfig.ClusterName
	}

	nsList, err := businessLayer.Namespace.GetClusterNamespaces(r.Context(), clusterName)
	if err != nil {
		return GetNamespaceHealthResponse{
			Errors: fmt.Sprintf("Error fetching namespaces: %v", err),
		}, http.StatusInternalServerError
	}

	requestedNs := map[string]bool{}
	if namespacesArg != "" {
		for _, ns := range strings.Split(namespacesArg, ",") {
			requestedNs[strings.TrimSpace(ns)] = true
		}
	}

	// Filter namespaces if specific ones were requested
	var filteredNs []models.Namespace
	for _, ns := range nsList {
		if len(requestedNs) > 0 && !requestedNs[ns.Name] {
			continue
		}
		filteredNs = append(filteredNs, ns)
	}

	// Fetch mTLS status for all namespaces in one call
	mtlsMap := make(map[string]models.MTLSStatus)
	tlsStatuses, err := businessLayer.TLS.ClusterWideNSmTLSStatus(r.Context(), filteredNs, clusterName)
	if err != nil {
		log.Warningf("Error fetching mTLS status: %v", err)
	} else {
		for _, ts := range tlsStatuses {
			mtlsMap[ts.Namespace] = ts
		}
	}

	// Fetch all validations for the cluster in one call, then filter per namespace
	allValidations, err := businessLayer.Validations.GetValidations(r.Context(), clusterName)
	if err != nil {
		log.Warningf("Error fetching Istio validations: %v", err)
	}

	var results []NamespaceHealthSummary
	rateInterval := "10m"
	queryTime := util.Clock.Now()

	for _, ns := range filteredNs {
		nsType := "Data Plane"
		if ns.IsControlPlane {
			nsType = "Control Plane"
		}

		summary := NamespaceHealthSummary{
			Cluster:        clusterName,
			IsAmbient:      ns.IsAmbient,
			IsControlPlane: ns.IsControlPlane,
			Labels:         ns.Labels,
			Namespace:      ns.Name,
			Revision:       ns.Revision,
			Type:           nsType,
		}

		// mTLS
		if ts, ok := mtlsMap[ns.Name]; ok {
			summary.MTLS = MTLSInfo{
				AutoMTLSEnabled: ts.AutoMTLSEnabled,
				Status:          ts.Status,
			}
		}

		// Istio config validations per namespace
		if allValidations != nil {
			validCount, warningCount, errorCount, totalCount := 0, 0, 0, 0
			for key, v := range allValidations {
				if key.Namespace != ns.Name {
					continue
				}
				if key.ObjectGVK.Kind == "workload" {
					continue
				}
				totalCount++
				if v.Valid {
					hasWarning := false
					for _, check := range v.Checks {
						if check.Severity == models.WarningSeverity {
							hasWarning = true
							break
						}
					}
					if hasWarning {
						warningCount++
					} else {
						validCount++
					}
				} else {
					errorCount++
				}
			}
			summary.IstioConfig = IstioConfigCounts{
				Errors:   errorCount,
				Total:    totalCount,
				Valid:    validCount,
				Warnings: warningCount,
			}
		}

		// Health
		criteria := business.NamespaceHealthCriteria{
			Cluster:        clusterName,
			IncludeMetrics: true,
			Namespace:      ns.Name,
			QueryTime:      queryTime,
			RateInterval:   rateInterval,
		}

		appHealth, err := businessLayer.Health.GetNamespaceAppHealth(r.Context(), criteria)
		if err != nil {
			log.Warningf("Error fetching app health for namespace %s: %v", ns.Name, err)
		} else {
			summary.Apps = countHealth(appHealth, getAppStatus)
		}

		svcHealth, err := businessLayer.Health.GetNamespaceServiceHealth(r.Context(), criteria)
		if err != nil {
			log.Warningf("Error fetching service health for namespace %s: %v", ns.Name, err)
		} else {
			summary.Services = countHealth(svcHealth, getServiceStatus)
		}

		wlHealth, err := businessLayer.Health.GetNamespaceWorkloadHealth(r.Context(), criteria)
		if err != nil {
			log.Warningf("Error fetching workload health for namespace %s: %v", ns.Name, err)
		} else {
			summary.Workloads = countHealth(wlHealth, getWorkloadStatus)
		}

		results = append(results, summary)
	}

	return GetNamespaceHealthResponse{
		Namespaces: results,
		Summary:    buildSummaryText(results),
	}, http.StatusOK
}

func countHealth[T any](health map[string]T, statusFn func(T) models.HealthStatus) HealthCounts {
	counts := HealthCounts{}
	for _, h := range health {
		counts.Total++
		switch statusFn(h) {
		case models.HealthStatusHealthy:
			counts.Healthy++
		case models.HealthStatusDegraded:
			counts.Degraded++
		case models.HealthStatusFailure:
			counts.Failure++
		default:
			counts.NotAvailable++
		}
	}
	return counts
}

func getAppStatus(ah *models.AppHealth) models.HealthStatus {
	if ah == nil || ah.Status == nil {
		return models.HealthStatusNA
	}
	return ah.Status.Status
}

func getServiceStatus(sh *models.ServiceHealth) models.HealthStatus {
	if sh == nil || sh.Status == nil {
		return models.HealthStatusNA
	}
	return sh.Status.Status
}

func getWorkloadStatus(wh *models.WorkloadHealth) models.HealthStatus {
	if wh == nil || wh.Status == nil {
		return models.HealthStatusNA
	}
	return wh.Status.Status
}

func buildSummaryText(results []NamespaceHealthSummary) string {
	totalNs := len(results)
	cpCount := 0
	dpCount := 0
	ambientCount := 0
	unhealthy := 0
	degraded := 0
	mtlsEnabled := 0
	istioErrors := 0
	for _, ns := range results {
		if ns.IsControlPlane {
			cpCount++
		} else {
			dpCount++
		}
		if ns.IsAmbient {
			ambientCount++
		}
		if ns.Apps.Failure > 0 || ns.Services.Failure > 0 || ns.Workloads.Failure > 0 {
			unhealthy++
		} else if ns.Apps.Degraded > 0 || ns.Services.Degraded > 0 || ns.Workloads.Degraded > 0 {
			degraded++
		}
		if ns.MTLS.Status == "MTLS_ENABLED" || ns.MTLS.Status == "MTLS_ENABLED_EXTENDED" {
			mtlsEnabled++
		}
		istioErrors += ns.IstioConfig.Errors
	}
	healthy := totalNs - unhealthy - degraded
	return fmt.Sprintf(
		"Total namespaces: %d (%d control plane, %d data plane, %d ambient). "+
			"Health: %d healthy, %d degraded, %d unhealthy. "+
			"mTLS enabled: %d/%d. Istio config errors: %d.",
		totalNs, cpCount, dpCount, ambientCount,
		healthy, degraded, unhealthy,
		mtlsEnabled, totalNs, istioErrors,
	)
}
