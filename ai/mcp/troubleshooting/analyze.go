package troubleshooting

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"

	"github.com/kiali/kiali/ai/mcp/analyze_ambient_policies"
	"github.com/kiali/kiali/ai/mcp/get_mesh_status"
	"github.com/kiali/kiali/ai/mcp/get_mesh_traffic_graph"
	"github.com/kiali/kiali/ai/mcp/list_or_get_resources"
	"github.com/kiali/kiali/ai/mcp/manage_istio_config"
	"github.com/kiali/kiali/ai/mcp/manage_istio_config_read"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// resourceTypesChecked are listed inside a monitored namespace before the dashboard is returned.
var resourceTypesChecked = []string{"service", "workload", "app", "argoapp"}

// troubleshootingLookupParallelism bounds concurrent Kiali reads during one troubleshooting scan.
// Istio object gets and data-plane resource lists (services, workloads, apps, Argo apps) share this limit.
const troubleshootingLookupParallelism = 8

// highLatencyThresholdMs flags traffic edges whose response time is at or above 1000ms.
const highLatencyThresholdMs = 1000

// namespaceFindings keeps the generic namespace sub-problem only when no critical
// cause was found. Warnings are always appended.
func namespaceFindings(namespaceSub SubProblem, critical, warnings []SubProblem) []SubProblem {
	subs := make([]SubProblem, 0, 1+len(critical)+len(warnings))
	if len(critical) == 0 {
		subs = append(subs, namespaceSub)
	}
	subs = append(subs, critical...)
	subs = append(subs, warnings...)
	return subs
}

// unhealthyNamespace is one data-plane namespace whose services, workloads, apps, and Argo apps are listed together.
type unhealthyNamespace struct {
	Cluster          string
	InjectionEnabled bool
	IsAmbient        bool
	Name             string
}

type namespaceMetadata struct {
	InjectionEnabled bool
	MTLS             string
}

// analyzeMonitoredNamespaces lists unhealthy or misconfigured resources for each namespace in parallel.
// Results stay in the same order as namespaces. Resource types inside a namespace are also fetched together.
func analyzeMonitoredNamespaces(ki *mcputil.KialiInterface, namespaces []unhealthyNamespace, controlPlaneVersion string, sem chan struct{}) [][]SubProblem {
	results := make([][]SubProblem, len(namespaces))
	if ki == nil || len(namespaces) == 0 {
		return results
	}
	if sem == nil {
		sem = make(chan struct{}, troubleshootingLookupParallelism)
	}
	var wg sync.WaitGroup
	for i, ns := range namespaces {
		wg.Add(1)
		go func(i int, ns unhealthyNamespace) {
			defer wg.Done()
			results[i] = analyzeNamespaceResources(ki, ns, controlPlaneVersion, sem)
		}(i, ns)
	}
	wg.Wait()
	return results
}

func fetchNamespaceMetadata(ki *mcputil.KialiInterface, cluster string, sem chan struct{}) map[string]namespaceMetadata {
	out := make(map[string]namespaceMetadata)
	if ki == nil {
		return out
	}
	if sem != nil {
		sem <- struct{}{}
		defer func() { <-sem }()
	}
	args := map[string]interface{}{
		"resourceType": "namespace",
	}
	if cluster != "" {
		args["clusterName"] = cluster
	}
	result, code := list_or_get_resources.Execute(ki, args)
	if code != http.StatusOK {
		return out
	}
	nsResp, ok := result.(list_or_get_resources.NamespaceListResponse)
	if !ok {
		return out
	}
	for _, ns := range nsResp.Namespaces {
		out[ns.Name] = namespaceMetadata{
			InjectionEnabled: strings.EqualFold(ns.Injection, "enabled"),
			MTLS:             ns.MTLS,
		}
	}
	return out
}

func namespaceMTLSSubProblems(
	monitored []get_mesh_status.MeshSummaryMonitoredNamespace,
	nsMeta map[string]namespaceMetadata,
	cluster, namespace string,
) []SubProblem {
	var subs []SubProblem
	for _, ns := range monitored {
		if cluster != "" && ns.Cluster != "" && ns.Cluster != cluster {
			continue
		}
		if namespace != "" && ns.Name != namespace {
			continue
		}
		meta, ok := nsMeta[ns.Name]
		if !ok {
			continue
		}
		mtls := strings.ToUpper(strings.TrimSpace(meta.MTLS))
		if mtls != "PARTIALLY" && mtls != "DISABLED" {
			continue
		}
		nsCluster := ns.Cluster
		if nsCluster == "" {
			nsCluster = cluster
		}
		sub := newSubProblemWithSeverity(
			securityNamespaceMTLSID(nsCluster, ns.Name),
			"Namespace: "+ns.Name,
			fmt.Sprintf("mTLS status is %s", meta.MTLS),
			fmt.Sprintf("Namespace %q has %s mTLS status. Mixed PeerAuthentication / DestinationRule TLS settings may cause mTLS lockouts or allow plaintext traffic.", ns.Name, meta.MTLS),
			SeverityWarning,
		)
		sub.SuggestedPrompt = fmt.Sprintf(
			"Analyze why namespace %q has mTLS status %q. Use manage_istio_config_read (action=\"list\", namespace=%q) to inspect PeerAuthentication and DestinationRule objects for mTLS conflicts or lockouts.",
			ns.Name, meta.MTLS, ns.Name,
		)
		subs = append(subs, sub)
	}
	return subs
}

// istioObjectsIssue lists Istio objects that fail validation, were not validated, or are valid but still have checks.
// namespace limits the list to that namespace; an empty namespace scans the cluster.
func istioObjectsIssue(ki *mcputil.KialiInterface, cluster, namespace string, sem chan struct{}) *Issue {
	critical, warnings, _ := istioFindings(ki, cluster, namespace, nil, sem)
	subs := append(critical, warnings...)
	if len(subs) == 0 {
		return nil
	}
	problem := "Istio objects are invalid, not validated, or have validation checks"
	if namespace != "" {
		problem = fmt.Sprintf("Istio objects in namespace %q are invalid, not validated, or have validation checks", namespace)
	}
	return &Issue{
		ID:          idIstioConfig,
		Category:    CategoryIstioObjects,
		Problem:     problem,
		Description: "An object that is not valid is critical. An object that is valid but still has checks is a warning, as is an object Kiali did not validate. A valid object with no checks is not reported.",
		SubProblems: subs,
	}
}

func analyzeNamespaceResources(ki *mcputil.KialiInterface, ns unhealthyNamespace, controlPlaneVersion string, sem chan struct{}) []SubProblem {
	if ki == nil || ns.Name == "" {
		return nil
	}
	if sem == nil {
		sem = make(chan struct{}, troubleshootingLookupParallelism)
	}
	grouped := make([][]SubProblem, len(resourceTypesChecked))
	rawResults := make([]interface{}, len(resourceTypesChecked))
	var wg sync.WaitGroup
	for i, resourceType := range resourceTypesChecked {
		wg.Add(1)
		go func(i int, resourceType string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			res, ok := fetchResourceList(ki, ns.Cluster, ns.Name, resourceType)
			if !ok {
				return
			}
			rawResults[i] = res
			grouped[i] = subProblemsFromResourceListWithContext(ns.Cluster, ns.Name, resourceType, res, ns.InjectionEnabled, ns.IsAmbient)
		}(i, resourceType)
	}
	wg.Wait()

	// Deep-inspect services and workloads for 0 endpoints, xDS sync status, proxy version drift, and pod lifecycle failures.
	serviceDetailSubs := inspectNamespaceServices(ki, ns.Cluster, ns.Name, rawResults[0], sem)
	workloadDetailSubs := inspectNamespaceWorkloads(ki, ns.Cluster, ns.Name, controlPlaneVersion, rawResults[1], sem)

	// Avoid duplicating App and Workload sub-problems when an unhealthy workload already explains the App's status.
	if len(grouped) > 2 && len(grouped[2]) > 0 {
		coveredApps := appsCoveredByWorkloadIssues(ns.Name, rawResults[1], grouped[1], workloadDetailSubs)
		grouped[2] = filterRedundantAppSubProblems(ns.Name, grouped[2], coveredApps)
	}

	var subs []SubProblem
	for _, group := range grouped {
		subs = append(subs, group...)
	}
	subs = append(subs, serviceDetailSubs...)
	subs = append(subs, workloadDetailSubs...)

	sortSubProblemsBySeverity(subs)
	return subs
}

func sortSubProblemsBySeverity(subs []SubProblem) {
	sort.SliceStable(subs, func(i, j int) bool {
		return (subs[i].Severity == SeverityCritical) && (subs[j].Severity != SeverityCritical)
	})
}

func fetchResourceList(ki *mcputil.KialiInterface, cluster, namespace, resourceType string) (interface{}, bool) {
	args := map[string]interface{}{
		"namespace":    namespace,
		"resourceType": resourceType,
	}
	if cluster != "" {
		args["clusterName"] = cluster
	}
	result, code := list_or_get_resources.Execute(ki, args)
	if code != http.StatusOK {
		log.Debugf("troubleshooting: list_or_get_resources %s in namespace %s returned %d: %v", resourceType, namespace, code, result)
		return nil, false
	}
	return result, true
}

type namedHealth struct {
	appLabel      string
	configuration string
	details       string
	health        string
	istio         *list_or_get_resources.ResourceListIstioFlags
	kind          string
	name          string
	syncStatus    string
}

func subProblemsFromResourceList(cluster, namespace, resourceType string, result interface{}) []SubProblem {
	return subProblemsFromResourceListWithContext(cluster, namespace, resourceType, result, false, false)
}

func subProblemsFromResourceListWithContext(
	cluster, namespace, resourceType string,
	result interface{},
	nsInjectionEnabled, nsIsAmbient bool,
) []SubProblem {
	var found []namedHealth
	switch typed := result.(type) {
	case map[string][]list_or_get_resources.ResourceListItem:
		for _, items := range typed {
			for _, item := range items {
				found = append(found, namedHealth{
					appLabel:      extractAppFromLabelsString(item.Labels),
					configuration: item.Configuration,
					details:       item.Details,
					health:        item.Health,
					istio:         item.Istio,
					kind:          item.Type,
					name:          item.Name,
				})
			}
		}
	case list_or_get_resources.AppListResponse:
		for _, app := range typed.Applications {
			found = append(found, namedHealth{health: app.Health, name: app.Name})
		}
	case list_or_get_resources.ArgoCDAppListResponse:
		for _, app := range typed.Applications {
			found = append(found, namedHealth{
				health:     app.Health,
				name:       app.Name,
				syncStatus: app.SyncStatus,
			})
		}
	default:
		return nil
	}
	sort.Slice(found, func(i, j int) bool { return found[i].name < found[j].name })

	var subs []SubProblem
	for _, item := range found {
		if item.name == "" {
			continue
		}
		label := resourceLabel(resourceType, item.kind)
		target := fmt.Sprintf("%s: %s/%s", label, namespace, item.name)

		if !isHealthyStatus(item.health) {
			impact := formatResourceImpact(label, item.name, namespace, item.appLabel, item.details, item.istio)
			sub := newSubProblemWithSeverity(
				dataPlaneResourceID(cluster, namespace, resourceType, item.name),
				target,
				fmt.Sprintf("health is %s", item.health),
				impact,
				severityForHealth(item.health),
			)
			attachResourceAnalyzeAction(&sub, cluster, namespace, resourceType, item.name, item.health, item.details)
			subs = append(subs, sub)
		} else if strings.EqualFold(item.configuration, "false") {
			issueText := "configuration validation failed"
			if item.details != "" {
				issueText = fmt.Sprintf("configuration validation failed (%s)", item.details)
			}
			impact := formatResourceImpact(label, item.name, namespace, item.appLabel, item.details, item.istio)
			sub := newSubProblemWithSeverity(
				dataPlaneConfigID(cluster, namespace, resourceType, item.name),
				target,
				issueText,
				impact,
				SeverityWarning,
			)
			attachResourceAnalyzeAction(&sub, cluster, namespace, resourceType, item.name, "configuration invalid", item.details)
			subs = append(subs, sub)
		} else if resourceType == "argoapp" && strings.EqualFold(item.syncStatus, "OutOfSync") {
			sub := newSubProblemWithSeverity(
				dataPlaneResourceID(cluster, namespace, resourceType, item.name),
				target,
				"sync status is OutOfSync",
				fmt.Sprintf("ArgoCD Application %q in namespace %q is OutOfSync with its target Git revision.", item.name, namespace),
				SeverityWarning,
			)
			attachResourceAnalyzeAction(&sub, cluster, namespace, resourceType, item.name, "OutOfSync", "")
			subs = append(subs, sub)
		}

		if resourceType == "workload" && isMissingExpectedSidecar(item.istio, nsInjectionEnabled, nsIsAmbient) {
			sub := newSubProblemWithSeverity(
				meshSidecarInjectionID(cluster, namespace, item.name),
				target,
				"missing Istio sidecar in injection-enabled namespace",
				fmt.Sprintf("%s %q in namespace %q is running without an Istio sidecar proxy despite namespace injection being enabled. mTLS and mesh policies will not apply.", label, item.name, namespace),
				SeverityWarning,
			)
			sub.SuggestedPrompt = fmt.Sprintf(
				"Analyze why workload %q in namespace %q is missing an Istio sidecar proxy even though istio-injection is enabled. Use list_or_get_resources (resourceType=\"workload\", namespace=%q, resourceName=%q) to inspect pod labels, annotations, and init containers.",
				item.name, namespace, namespace, item.name,
			)
			subs = append(subs, sub)
		}
	}
	return subs
}

func isMissingExpectedSidecar(istio *list_or_get_resources.ResourceListIstioFlags, nsInjectionEnabled, nsIsAmbient bool) bool {
	if !nsInjectionEnabled || nsIsAmbient || istio == nil {
		return false
	}
	if istio.IstioSidecar || istio.IsAmbient || istio.IsGateway || istio.IsWaypoint || istio.IsZtunnel {
		return false
	}
	if istio.IstioInjectionAnnotation != nil && !*istio.IstioInjectionAnnotation {
		return false
	}
	return true
}

func formatResourceImpact(label, name, namespace, appLabel, details string, istio *list_or_get_resources.ResourceListIstioFlags) string {
	base := fmt.Sprintf("%s %q in namespace %q is not healthy.", label, name, namespace)
	if appLabel != "" {
		base = fmt.Sprintf("%s %q (app %q) in namespace %q is not healthy.", label, name, appLabel, namespace)
	}
	var extra []string
	if mode := describeIstioFlags(istio); mode != "" {
		extra = append(extra, "mesh mode: "+mode)
	}
	if strings.TrimSpace(details) != "" {
		extra = append(extra, "details: "+details)
	}
	if len(extra) == 0 {
		return base
	}
	return fmt.Sprintf("%s (%s)", base, strings.Join(extra, "; "))
}

func extractAppFromLabelsString(labels string) string {
	if labels == "" || labels == "None" {
		return ""
	}
	for _, part := range strings.Split(labels, ",") {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		key := strings.TrimSpace(kv[0])
		val := strings.TrimSpace(kv[1])
		if (key == "app" || key == "app.kubernetes.io/name") && val != "" {
			return val
		}
	}
	return ""
}

// appsCoveredByWorkloadIssues returns the set of application names in namespace that already have
// at least one workload or pod sub-problem reported, so redundant App sub-problems can be omitted.
func appsCoveredByWorkloadIssues(namespace string, workloadListResult interface{}, workloadListSubs, workloadDetailSubs []SubProblem) map[string]bool {
	covered := make(map[string]bool)
	unhealthyWorkloads := make(map[string]bool)

	prefix := "/" + namespace + "/"
	for _, sub := range append(append([]SubProblem(nil), workloadListSubs...), workloadDetailSubs...) {
		if i := strings.Index(sub.Target, ": "+namespace+"/"); i >= 0 {
			wlName := strings.TrimSpace(sub.Target[i+len(": "+namespace+"/"):])
			if wlName != "" {
				unhealthyWorkloads[wlName] = true
			}
		} else if i := strings.Index(sub.Target, prefix); i >= 0 {
			wlName := strings.TrimSpace(sub.Target[i+len(prefix):])
			if wlName != "" {
				unhealthyWorkloads[wlName] = true
			}
		}
	}

	if typed, ok := workloadListResult.(map[string][]list_or_get_resources.ResourceListItem); ok {
		for _, items := range typed {
			for _, item := range items {
				if item.Name == "" {
					continue
				}
				if !isHealthyStatus(item.Health) || strings.EqualFold(item.Configuration, "false") || unhealthyWorkloads[item.Name] {
					unhealthyWorkloads[item.Name] = true
					if app := extractAppFromLabelsString(item.Labels); app != "" {
						covered[app] = true
					}
				}
			}
		}
	}

	for wlName := range unhealthyWorkloads {
		covered[wlName] = true
	}
	return covered
}

func filterRedundantAppSubProblems(namespace string, appSubs []SubProblem, coveredApps map[string]bool) []SubProblem {
	if len(appSubs) == 0 || len(coveredApps) == 0 {
		return appSubs
	}
	prefix := "App: " + namespace + "/"
	out := make([]SubProblem, 0, len(appSubs))
	for _, sub := range appSubs {
		appName := strings.TrimSpace(strings.TrimPrefix(sub.Target, prefix))
		if appName != "" && isAppCovered(appName, coveredApps) {
			continue
		}
		out = append(out, sub)
	}
	return out
}

func isAppCovered(appName string, coveredApps map[string]bool) bool {
	if coveredApps[appName] {
		return true
	}
	for key := range coveredApps {
		if strings.HasPrefix(key, appName+"-") {
			return true
		}
	}
	return false
}

func describeIstioFlags(istio *list_or_get_resources.ResourceListIstioFlags) string {
	if istio == nil {
		return ""
	}
	switch {
	case istio.IsWaypoint:
		return "Waypoint"
	case istio.IsZtunnel:
		return "Ztunnel"
	case istio.IsGateway:
		return "Gateway"
	case istio.IsAmbient:
		return "Ambient"
	case istio.IstioSidecar:
		return "Sidecar"
	default:
		return "No sidecar"
	}
}

func attachResourceAnalyzeAction(sub *SubProblem, cluster, namespace, resourceType, name, status, details string) {
	if sub == nil {
		return
	}
	prompt := resourceAnalyzePrompt(cluster, namespace, resourceType, name, status, details)
	sub.SuggestedPrompt = prompt
	if len(sub.SuggestedActions) > 0 && sub.SuggestedActions[0].Type == ActionTypeQuestion {
		sub.SuggestedActions[0].Prompt = prompt
	}
}

func resourceAnalyzePrompt(cluster, namespace, resourceType, name, status, details string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Analyze %s %q in namespace %q", resourceType, name, namespace)
	if cluster != "" {
		fmt.Fprintf(&b, " (cluster %q)", cluster)
	}
	fmt.Fprintf(&b, " reporting %q.", status)
	if details != "" {
		fmt.Fprintf(&b, " Reported details: %s.", details)
	}
	switch resourceType {
	case "workload":
		fmt.Fprintf(&b, " Fetch workload details with list_or_get_resources (resourceType=\"workload\", namespace=%q, resourceName=%q), check error/warn logs with get_logs (namespace=%q, workload=%q, severity=\"ERROR,WARN\"), check CPU/memory usage against limits with get_pod_performance (namespace=%q, workloadName=%q), and inspect traffic metrics with get_metrics (resourceType=\"workload\", namespace=%q, resourceName=%q).",
			namespace, name, namespace, name, namespace, name, namespace, name)
	case "service":
		fmt.Fprintf(&b, " Fetch service details and endpoints with list_or_get_resources (resourceType=\"service\", namespace=%q, resourceName=%q), inspect request error rates and latency with get_metrics (resourceType=\"service\", namespace=%q, resourceName=%q), and check error traces with list_traces (namespace=%q, service_name=%q, error_only=true).",
			namespace, name, namespace, name, namespace, name)
	case "app":
		fmt.Fprintf(&b, " Fetch application details with list_or_get_resources (resourceType=\"app\", namespace=%q, resourceName=%q), inspect traffic topology with get_mesh_traffic_graph (namespaces=%q), and check metrics with get_metrics (resourceType=\"app\", namespace=%q, resourceName=%q).",
			namespace, name, namespace, namespace, name)
	case "argoapp":
		fmt.Fprintf(&b, " Fetch ArgoCD Application details and sync status with list_or_get_resources (resourceType=\"argoapp\", namespace=%q, resourceName=%q).",
			namespace, name)
	}
	return b.String()
}

func inspectNamespaceServices(ki *mcputil.KialiInterface, cluster, namespace string, listResult interface{}, sem chan struct{}) []SubProblem {
	if ki == nil || listResult == nil {
		return nil
	}
	typed, ok := listResult.(map[string][]list_or_get_resources.ResourceListItem)
	if !ok {
		return nil
	}
	var candidates []string
	for _, items := range typed {
		for _, item := range items {
			if item.Name == "" {
				continue
			}
			// Check service details when unhealthy or when configuration validation failed.
			if !isHealthyStatus(item.Health) || strings.EqualFold(item.Configuration, "false") {
				candidates = append(candidates, item.Name)
			}
		}
	}
	sort.Strings(candidates)
	if len(candidates) == 0 {
		return nil
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	var subs []SubProblem
	for _, svcName := range candidates {
		wg.Add(1)
		go func(svcName string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			args := map[string]interface{}{
				"namespace":    namespace,
				"resourceName": svcName,
				"resourceType": "service",
			}
			if cluster != "" {
				args["clusterName"] = cluster
			}
			res, code := list_or_get_resources.Execute(ki, args)
			if code != http.StatusOK {
				return
			}
			detail, ok := res.(list_or_get_resources.ServiceDetailResponse)
			if !ok {
				return
			}
			found := inspectServiceDetail(cluster, namespace, detail)
			if len(found) > 0 {
				mu.Lock()
				subs = append(subs, found...)
				mu.Unlock()
			}
		}(svcName)
	}
	wg.Wait()
	sort.Slice(subs, func(i, j int) bool { return subs[i].ID < subs[j].ID })
	return subs
}

func inspectServiceDetail(cluster, namespace string, detail list_or_get_resources.ServiceDetailResponse) []SubProblem {
	svcName := detail.Service.Name
	if svcName == "" {
		return nil
	}
	if len(detail.Endpoints) == 0 && !strings.EqualFold(detail.Service.Type, "ExternalName") && len(detail.Service.Selectors) > 0 {
		sub := newSubProblemWithSeverity(
			k8sServiceEndpointsID(cluster, namespace, svcName),
			fmt.Sprintf("Service: %s/%s", namespace, svcName),
			"service has 0 active endpoints",
			fmt.Sprintf("Service %q in namespace %q has 0 ready endpoints matching selector %v. Traffic to this service will fail with HTTP 503 (NR/UH).", svcName, namespace, detail.Service.Selectors),
			SeverityCritical,
		)
		sub.SuggestedPrompt = fmt.Sprintf(
			"Analyze why Service %q in namespace %q has 0 active endpoints for selector %v. Use list_or_get_resources (resourceType=\"workload\", namespace=%q) to check if matching workloads exist and why their pods are not ready.",
			svcName, namespace, detail.Service.Selectors, namespace,
		)
		return []SubProblem{sub}
	}
	return nil
}

func inspectNamespaceWorkloads(ki *mcputil.KialiInterface, cluster, namespace, controlPlaneVersion string, listResult interface{}, sem chan struct{}) []SubProblem {
	if ki == nil || listResult == nil {
		return nil
	}
	typed, ok := listResult.(map[string][]list_or_get_resources.ResourceListItem)
	if !ok {
		return nil
	}
	var candidates []string
	for _, items := range typed {
		for _, item := range items {
			if item.Name != "" {
				candidates = append(candidates, item.Name)
			}
		}
	}
	sort.Strings(candidates)
	if len(candidates) == 0 {
		return nil
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	var subs []SubProblem
	for _, wlName := range candidates {
		wg.Add(1)
		go func(wlName string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			args := map[string]interface{}{
				"namespace":    namespace,
				"resourceName": wlName,
				"resourceType": "workload",
			}
			if cluster != "" {
				args["clusterName"] = cluster
			}
			res, code := list_or_get_resources.Execute(ki, args)
			if code != http.StatusOK {
				return
			}
			detail, ok := res.(list_or_get_resources.WorkloadDetailResponse)
			if !ok {
				return
			}
			found := inspectWorkloadDetail(cluster, namespace, controlPlaneVersion, detail)
			if len(found) > 0 {
				mu.Lock()
				subs = append(subs, found...)
				mu.Unlock()
			}
		}(wlName)
	}
	wg.Wait()
	sort.Slice(subs, func(i, j int) bool { return subs[i].ID < subs[j].ID })
	return subs
}

func inspectWorkloadDetail(cluster, namespace, controlPlaneVersion string, detail list_or_get_resources.WorkloadDetailResponse) []SubProblem {
	wlName := detail.Workload.Name
	if wlName == "" {
		return nil
	}
	label := resourceLabel("workload", detail.Workload.Kind)
	target := fmt.Sprintf("%s: %s/%s", label, namespace, wlName)
	var subs []SubProblem

	// 1. Envoy xDS Sync Status (CDS, EDS, LDS, RDS)
	if syncIssues := unsyncedXDS(detail.Istio.SyncStatus); len(syncIssues) > 0 {
		summary := strings.Join(syncIssues, ", ")
		sub := newSubProblemWithSeverity(
			meshSyncID(cluster, namespace, wlName),
			target,
			fmt.Sprintf("Envoy xDS sync status is desynchronized (%s)", summary),
			fmt.Sprintf("Sidecar proxy for %s %q in namespace %q is out of sync with istiod (%s). Routing rules or endpoints may be stale.", label, wlName, namespace, summary),
			SeverityCritical,
		)
		sub.SuggestedPrompt = fmt.Sprintf(
			"Analyze why Envoy proxy for workload %q in namespace %q has desynchronized xDS status (%s). Use list_or_get_resources (resourceType=\"workload\", namespace=%q, resourceName=%q) and get_logs to check proxy and istiod connectivity.",
			wlName, namespace, summary, namespace, wlName,
		)
		subs = append(subs, sub)
	}

	// 2. Outdated Proxy Version vs Control Plane
	if detail.Istio.ProxyVersion != "" && controlPlaneVersion != "" &&
		normalizeIstioVersion(detail.Istio.ProxyVersion) != normalizeIstioVersion(controlPlaneVersion) {
		sub := newSubProblemWithSeverity(
			meshProxyVersionID(cluster, namespace, wlName),
			target,
			fmt.Sprintf("proxy version %s differs from control plane %s", detail.Istio.ProxyVersion, controlPlaneVersion),
			fmt.Sprintf("%s %q in namespace %q is running Envoy proxy version %s while control plane is %s. Restart the workload to re-inject the matching proxy version.", label, wlName, namespace, detail.Istio.ProxyVersion, controlPlaneVersion),
			SeverityWarning,
		)
		sub.SuggestedPrompt = fmt.Sprintf(
			"Analyze the proxy version mismatch on workload %q in namespace %q (proxy=%s, control plane=%s) and explain how to safely roll out a restart.",
			wlName, namespace, detail.Istio.ProxyVersion, controlPlaneVersion,
		)
		subs = append(subs, sub)
	}

	// 3. Pod Lifecycle & Sidecar Readiness Failures
	for _, pod := range detail.Pods {
		if pod.Name == "" {
			continue
		}
		podStatus := strings.TrimSpace(pod.Status)
		if podStatus != "" && !strings.EqualFold(podStatus, "Running") && !strings.EqualFold(podStatus, "Succeeded") {
			sev := SeverityCritical
			if strings.EqualFold(podStatus, "Pending") {
				sev = SeverityWarning
			}
			sub := newSubProblemWithSeverity(
				k8sPodLifecycleID(cluster, namespace, wlName, pod.Name),
				fmt.Sprintf("Pod: %s/%s", namespace, pod.Name),
				fmt.Sprintf("pod status is %s (istio-proxy=%s)", podStatus, pod.IstioProxy),
				fmt.Sprintf("Pod %q of workload %q in namespace %q is in %s state. Check container logs and resource limits (e.g. OOMKilled or CrashLoopBackOff).", pod.Name, wlName, namespace, podStatus),
				sev,
			)
			sub.SuggestedPrompt = fmt.Sprintf(
				"Analyze why pod %q (workload %q in namespace %q) is in state %q. Use get_logs (namespace=%q, name=%q, severity=\"ERROR,WARN\") and get_pod_performance (namespace=%q, podName=%q) to check for crashes or OOMKilled containers.",
				pod.Name, wlName, namespace, podStatus, namespace, pod.Name, namespace, pod.Name,
			)
			subs = append(subs, sub)
			continue
		}
		if detail.Istio.IstioSidecar && pod.IstioProxy != "" && !strings.EqualFold(pod.IstioProxy, "Ready") {
			sub := newSubProblemWithSeverity(
				k8sPodLifecycleID(cluster, namespace, wlName, pod.Name),
				fmt.Sprintf("Pod: %s/%s", namespace, pod.Name),
				fmt.Sprintf("istio-proxy sidecar is %s", pod.IstioProxy),
				fmt.Sprintf("Sidecar container istio-proxy in pod %q (workload %q, namespace %q) is not ready (%s). Check istio-proxy logs and memory limits.", pod.Name, wlName, namespace, pod.IstioProxy),
				SeverityCritical,
			)
			sub.SuggestedPrompt = fmt.Sprintf(
				"Analyze why the istio-proxy container in pod %q (workload %q, namespace %q) is not ready (%s). Use get_logs (namespace=%q, name=%q, container=\"istio-proxy\") and get_pod_performance (namespace=%q, podName=%q).",
				pod.Name, wlName, namespace, pod.IstioProxy, namespace, pod.Name, namespace, pod.Name,
			)
			subs = append(subs, sub)
		}
	}

	return subs
}

func unsyncedXDS(syncStatus *list_or_get_resources.SyncStatus) []string {
	if syncStatus == nil {
		return nil
	}
	type pair struct {
		name, val string
	}
	fields := []pair{
		{"CDS", syncStatus.CDS},
		{"EDS", syncStatus.EDS},
		{"LDS", syncStatus.LDS},
		{"RDS", syncStatus.RDS},
	}
	var out []string
	for _, f := range fields {
		v := strings.ToUpper(strings.TrimSpace(f.val))
		if v == "" || v == "SYNCED" || v == "IGNORED" || v == "100%" {
			continue
		}
		out = append(out, fmt.Sprintf("%s=%s", f.name, f.val))
	}
	return out
}

func normalizeIstioVersion(v string) string {
	v = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(v), "v"))
	if i := strings.Index(v, "-"); i > 0 {
		v = v[:i]
	}
	return v
}

// ambientPolicySubProblems calls analyze_ambient_policies for Ambient namespaces and converts
// un-enforced L7 policies (missing waypoint) or selector warnings into SubProblems.
func ambientPolicySubProblems(
	ki *mcputil.KialiInterface,
	monitored []get_mesh_status.MeshSummaryMonitoredNamespace,
	cluster, namespace string,
	sem chan struct{},
) []SubProblem {
	if ki == nil {
		return nil
	}
	hasAmbient := false
	for _, ns := range monitored {
		if cluster != "" && ns.Cluster != "" && ns.Cluster != cluster {
			continue
		}
		if namespace != "" && ns.Name != namespace {
			continue
		}
		if ns.IsAmbient {
			hasAmbient = true
			break
		}
	}
	if !hasAmbient && namespace == "" {
		return nil
	}
	if sem != nil {
		sem <- struct{}{}
		defer func() { <-sem }()
	}
	args := map[string]interface{}{}
	if cluster != "" {
		args["clusterName"] = cluster
	}
	if namespace != "" {
		args["namespace"] = namespace
	}
	res, code := analyze_ambient_policies.Execute(ki, args)
	if code != http.StatusOK {
		return nil
	}
	typed, ok := res.(analyze_ambient_policies.PolicyAnalysisResponse)
	if !ok {
		return nil
	}
	return subProblemsFromAmbientAnalysis(typed)
}

func subProblemsFromAmbientAnalysis(analysis analyze_ambient_policies.PolicyAnalysisResponse) []SubProblem {
	var subs []SubProblem
	for _, nsAnalysis := range analysis.Namespaces {
		if !nsAnalysis.NamespaceStatus.IsAmbient {
			continue
		}
		ns := nsAnalysis.NamespaceStatus.Name
		for _, policy := range nsAnalysis.Policies {
			if !policy.NeedsWaypoint && strings.TrimSpace(policy.Warning) == "" {
				continue
			}
			target := fmt.Sprintf("%s: %s/%s", policy.ConfigType, ns, policy.Name)
			id := securityAmbientPolicyID(ns, policy.ConfigType, policy.Name)
			sev := SeverityWarning
			issue := fmt.Sprintf("Ambient policy warning on %s %q", policy.ConfigType, policy.Name)
			impact := policy.Warning
			if policy.NeedsWaypoint {
				sev = SeverityCritical
				issue = fmt.Sprintf("L7 %s %q requires a waypoint proxy but namespace has none", policy.ConfigType, policy.Name)
				if impact == "" {
					impact = fmt.Sprintf("%s %q in Ambient namespace %q uses L7 features (%s) and will NOT be enforced without a waypoint proxy.", policy.ConfigType, policy.Name, ns, policy.Reason)
				}
			}
			sub := newSubProblemWithSeverity(id, target, issue, impact, sev)
			sub.IstioObject = ambientPolicyObjectRef(ns, policy.ConfigType, policy.Name)
			sub.SuggestedPrompt = fmt.Sprintf(
				"Analyze Ambient policy %s %q in namespace %q (%s). Use analyze_ambient_policies (namespace=%q) and manage_istio_config_read to explain how to deploy a waypoint or update targetRefs so this policy is enforced.",
				policy.ConfigType, policy.Name, ns, impact, ns,
			)
			attachIstioAnalyzeAction(&sub)
			subs = append(subs, sub)
		}
	}
	return subs
}

func ambientPolicyObjectRef(namespace, kind, name string) *IstioObjectRef {
	if namespace == "" || kind == "" || name == "" {
		return nil
	}
	group := "networking.istio.io"
	version := "v1"
	switch kind {
	case "AuthorizationPolicy", "PeerAuthentication", "RequestAuthentication":
		group = "security.istio.io"
	case "WasmPlugin":
		group = "extensions.istio.io"
		version = "v1alpha1"
	case "Telemetry":
		group = "telemetry.istio.io"
	}
	return &IstioObjectRef{
		Group:     group,
		Kind:      kind,
		Name:      name,
		Namespace: namespace,
		Version:   version,
	}
}

func buildSecurityIssue(ambientSubs, mtlsSubs, plaintextSubs []SubProblem, namespace string) *Issue {
	var subs []SubProblem
	subs = append(subs, ambientSubs...)
	subs = append(subs, mtlsSubs...)
	subs = append(subs, plaintextSubs...)
	if len(subs) == 0 {
		return nil
	}
	problem := "Security, mTLS, or Ambient policy enforcement issues detected"
	if namespace != "" {
		problem = fmt.Sprintf("Security, mTLS, or Ambient policy issues in namespace %q", namespace)
	}
	return &Issue{
		ID:          idSecurity,
		Category:    CategorySecurity,
		Problem:     problem,
		Description: "Detects un-enforced L7 policies in Ambient namespaces (missing waypoint or targetRefs), partial/disabled namespace mTLS, and plaintext traffic edges.",
		SubProblems: subs,
	}
}

func trafficGraphSubProblems(
	ki *mcputil.KialiInterface,
	monitored []get_mesh_status.MeshSummaryMonitoredNamespace,
	cluster, namespace string,
	sem chan struct{},
) (trafficSubs, plaintextSubs, promScrapeSubs []SubProblem) {
	if ki == nil {
		return nil, nil, nil
	}
	var nsNames []string
	if namespace != "" {
		nsNames = []string{namespace}
	} else {
		for _, ns := range monitored {
			if cluster != "" && ns.Cluster != "" && ns.Cluster != cluster {
				continue
			}
			if ns.Name != "" {
				nsNames = append(nsNames, ns.Name)
			}
		}
	}
	if len(nsNames) == 0 {
		return nil, nil, nil
	}
	sort.Strings(nsNames)
	if sem != nil {
		sem <- struct{}{}
		defer func() { <-sem }()
	}
	args := map[string]interface{}{
		"namespaces": strings.Join(nsNames, ","),
	}
	if cluster != "" {
		args["clusterName"] = cluster
	}
	res, code := get_mesh_traffic_graph.Execute(ki, args)
	if code != http.StatusOK {
		return nil, nil, nil
	}
	graphResp, ok := res.(get_mesh_traffic_graph.CompactGraphResponse)
	if !ok {
		return nil, nil, nil
	}
	scopeLabel := namespace
	if scopeLabel == "" {
		scopeLabel = "mesh"
	}
	return subProblemsFromTrafficGraph(scopeLabel, graphResp)
}

func subProblemsFromTrafficGraph(scopeLabel string, graphResp get_mesh_traffic_graph.CompactGraphResponse) (trafficSubs, plaintextSubs, promScrapeSubs []SubProblem) {
	if errMsg, ok := graphResp.Errors["health"]; ok && strings.TrimSpace(errMsg) != "" {
		sub := newSubProblemWithSeverity(
			observabilityComponentID("prometheus-health"),
			"Prometheus (health metrics)",
			errMsg,
			"Health calculation queries to Prometheus failed; traffic health or Envoy stats may be missing or delayed.",
			SeverityWarning,
		)
		promScrapeSubs = append(promScrapeSubs, sub)
	}

	seenEdge := make(map[string]bool)
	for _, edge := range graphResp.Traffic {
		if edge.Source == "" || edge.Target == "" {
			continue
		}
		edgeKey := edge.Source + "->" + edge.Target
		if seenEdge[edgeKey] {
			continue
		}
		seenEdge[edgeKey] = true
		edgeTarget := fmt.Sprintf("%s → %s", edge.Source, edge.Target)

		// 1. BlackHoleCluster / PassthroughCluster egress calls
		if strings.EqualFold(edge.Target, "BlackHoleCluster") {
			sub := newSubProblemWithSeverity(
				trafficEgressID(scopeLabel, edge.Source, "BlackHoleCluster"),
				edgeTarget,
				"outbound traffic blocked by BlackHoleCluster",
				fmt.Sprintf("Traffic from %q is targeting BlackHoleCluster (unregistered external host while outbound traffic policy is REGISTRY_ONLY). Define a ServiceEntry to allow this traffic.", edge.Source),
				SeverityCritical,
			)
			sub.SuggestedPrompt = fmt.Sprintf(
				"Analyze why %q is sending traffic to BlackHoleCluster. Use get_mesh_traffic_graph and get_logs (for %q) to identify the target external hostname and create the required ServiceEntry.",
				edge.Source, edge.Source,
			)
			trafficSubs = append(trafficSubs, sub)
			continue
		}
		if strings.EqualFold(edge.Target, "PassthroughCluster") {
			sub := newSubProblemWithSeverity(
				trafficEgressID(scopeLabel, edge.Source, "PassthroughCluster"),
				edgeTarget,
				"outbound traffic to unregistered external host (PassthroughCluster)",
				fmt.Sprintf("Traffic from %q is routed through PassthroughCluster without a matching ServiceEntry. Register a ServiceEntry to apply Istio policies and telemetry.", edge.Source),
				SeverityWarning,
			)
			sub.SuggestedPrompt = fmt.Sprintf(
				"Analyze outbound traffic from %q to PassthroughCluster. Explain how to identify the external host and register a ServiceEntry.",
				edge.Source,
			)
			trafficSubs = append(trafficSubs, sub)
			continue
		}

		// 2. Failing or Degraded traffic edges (Golden Signals: HTTP 5xx / gRPC error rate)
		if !isHealthyStatus(edge.Health) {
			proto := strings.ToUpper(edge.Protocol)
			if proto == "" {
				proto = "Traffic"
			}
			sub := newSubProblemWithSeverity(
				trafficEdgeID(scopeLabel, edge.Source, edge.Target),
				edgeTarget,
				fmt.Sprintf("%s traffic is %s", proto, edge.Health),
				fmt.Sprintf("Traffic edge %s (%s) is reporting %s status (response time: %d ms, throughput: %s).", edgeTarget, proto, edge.Health, edge.ResponseTimeMs, edge.Throughput),
				severityForHealth(edge.Health),
			)
			sub.SuggestedPrompt = fmt.Sprintf(
				"Analyze why traffic on edge %s (%s) is %s. Use get_mesh_traffic_graph, get_metrics, and list_traces (error_only=true) to identify whether the errors are HTTP 5xx, 403 RBAC access denied, or upstream circuit breaker / outlier detection ejections.",
				edgeTarget, proto, edge.Health,
			)
			trafficSubs = append(trafficSubs, sub)
		} else if edge.ResponseTimeMs >= highLatencyThresholdMs {
			// 3. High latency spike on otherwise healthy edge
			sub := newSubProblemWithSeverity(
				trafficLatencyID(scopeLabel, edge.Source, edge.Target),
				edgeTarget,
				fmt.Sprintf("high response latency (%d ms)", edge.ResponseTimeMs),
				fmt.Sprintf("Traffic on edge %s has high response time (%d ms).", edgeTarget, edge.ResponseTimeMs),
				SeverityWarning,
			)
			sub.SuggestedPrompt = fmt.Sprintf(
				"Analyze high latency (%d ms) on traffic edge %s. Use get_metrics and list_traces to find the slowest spans and bottleneck service.",
				edge.ResponseTimeMs, edgeTarget,
			)
			trafficSubs = append(trafficSubs, sub)
		}

		// 4. Plaintext traffic between internal mesh nodes
		if !edge.MTLS && !strings.EqualFold(edge.Source, "unknown") && !strings.EqualFold(edge.Target, "unknown") {
			sub := newSubProblemWithSeverity(
				securityPlaintextEdgeID(scopeLabel, edge.Source, edge.Target),
				edgeTarget,
				"plaintext traffic detected (mTLS disabled)",
				fmt.Sprintf("Traffic between %q and %q is not encrypted with mTLS. Check PeerAuthentication, DestinationRule TLS mode, or missing sidecars.", edge.Source, edge.Target),
				SeverityWarning,
			)
			sub.SuggestedPrompt = fmt.Sprintf(
				"Analyze why traffic on %s is sent in plaintext without mTLS. Check PeerAuthentication, DestinationRule TLS settings, and sidecar injection status.",
				edgeTarget,
			)
			plaintextSubs = append(plaintextSubs, sub)
		}
	}
	return trafficSubs, plaintextSubs, promScrapeSubs
}

func buildTrafficIssue(trafficSubs []SubProblem, namespace string) *Issue {
	if len(trafficSubs) == 0 {
		return nil
	}
	problem := "Traffic anomalies, SLO degradations, or unregistered egress detected"
	if namespace != "" {
		problem = fmt.Sprintf("Traffic anomalies or SLO degradations in namespace %q", namespace)
	}
	return &Issue{
		ID:          idTraffic,
		Category:    CategoryTraffic,
		Problem:     problem,
		Description: "Detects failing or degraded service-to-service traffic edges, high latency spikes, and calls to BlackHoleCluster or PassthroughCluster.",
		SubProblems: trafficSubs,
	}
}

func resourceLabel(resourceType, kind string) string {
	switch resourceType {
	case "service":
		return "Service"
	case "workload":
		if kind != "" {
			return "Workload (" + kind + ")"
		}
		return "Workload"
	case "app":
		return "App"
	case "argoapp":
		return "ArgoCD Application"
	default:
		return resourceType
	}
}

func istioFindings(ki *mcputil.KialiInterface, cluster, namespace string, skip map[string]bool, sem chan struct{}) (critical, warnings []SubProblem, reported map[string]bool) {
	listed, ok := listIstioConfig(ki, cluster, namespace)
	if !ok {
		return nil, nil, nil
	}
	return istioSubProblems(listed.Namespaces, skip, func(ns, group, version, kind, name string) *models.IstioValidation {
		return getIstioValidation(ki, cluster, ns, group, version, kind, name)
	}, sem)
}

func istioObjectKey(namespace, kind, name string) string {
	return namespace + "/" + kind + "/" + name
}

func istioObjectRef(target istioLookupTarget) *IstioObjectRef {
	if target.Group == "" || target.Kind == "" || target.Name == "" || target.Namespace == "" || target.Version == "" {
		return nil
	}
	return &IstioObjectRef{
		Group:     target.Group,
		Kind:      target.Kind,
		Name:      target.Name,
		Namespace: target.Namespace,
		Version:   target.Version,
	}
}

// istioLookupTarget is one object whose validation is loaded with manage_istio_config_read get.
// ListedValid is true when the list put the object in valid. Kiali keeps valid true when the only checks are warnings.
type istioLookupTarget struct {
	Group       string
	Kind        string
	ListedValid bool
	Name        string
	Namespace   string
	Version     string
}

type istioWorkItem struct {
	notValidated bool
	target       istioLookupTarget
}

func istioSubProblems(namespaces map[string]map[string]manage_istio_config.KindValidationResult, skip map[string]bool, lookup func(namespace, group, version, kind, name string) *models.IstioValidation, sem chan struct{}) (critical, warnings []SubProblem, reported map[string]bool) {
	reported = map[string]bool{}
	work := istioWorkItems(namespaces, skip)
	validations := fetchIstioValidations(work, lookup, sem)

	for _, item := range work {
		if item.notValidated {
			sub := istioNotValidatedSubProblem(item.target.Namespace, item.target.Kind, item.target.Name, istioObjectID(item.target.Namespace, item.target.Kind, item.target.Name))
			sub.IstioObject = istioObjectRef(item.target)
			attachIstioAnalyzeAction(&sub)
			warnings = append(warnings, sub)
			reported[istioObjectKey(item.target.Namespace, item.target.Kind, item.target.Name)] = true
			continue
		}
		key := istioObjectKey(item.target.Namespace, item.target.Kind, item.target.Name)
		validation := validations[key]
		if item.target.ListedValid {
			checks := validationChecks(item.target.Namespace, item.target.Kind, item.target.Name, validation)
			if len(checks) == 0 {
				continue
			}
			sub := validIstioObjectSubProblem(item.target.Namespace, item.target.Kind, item.target.Name, checks)
			sub.IstioObject = istioObjectRef(item.target)
			attachIstioAnalyzeAction(&sub)
			warnings = append(warnings, sub)
			reported[key] = true
			continue
		}
		// The list marks the object invalid, so the subproblem is critical even when every check is a warning.
		sub := istioObjectSubProblem(item.target.Namespace, item.target.Kind, item.target.Name, validation)
		sub.IstioObject = istioObjectRef(item.target)
		attachIstioAnalyzeAction(&sub)
		critical = append(critical, sub)
		reported[key] = true
	}
	return critical, warnings, reported
}

func istioWorkItems(namespaces map[string]map[string]manage_istio_config.KindValidationResult, skip map[string]bool) []istioWorkItem {
	nsNames := make([]string, 0, len(namespaces))
	for ns := range namespaces {
		nsNames = append(nsNames, ns)
	}
	sort.Strings(nsNames)

	var work []istioWorkItem
	for _, ns := range nsNames {
		kinds := namespaces[ns]
		gvkKeys := make([]string, 0, len(kinds))
		for key := range kinds {
			gvkKeys = append(gvkKeys, key)
		}
		sort.Strings(gvkKeys)
		for _, key := range gvkKeys {
			group, version, kind, ok := parseGVKKey(key)
			if !ok {
				continue
			}
			result := kinds[key]
			for _, name := range sortedNames(result.NotValidated) {
				if skip[istioObjectKey(ns, kind, name)] {
					continue
				}
				work = append(work, istioWorkItem{
					notValidated: true,
					target:       istioLookupTarget{Group: group, Kind: kind, Name: name, Namespace: ns, Version: version},
				})
			}
			for _, name := range sortedNames(result.Invalid) {
				if skip[istioObjectKey(ns, kind, name)] {
					continue
				}
				work = append(work, istioWorkItem{target: istioLookupTarget{
					Group: group, Kind: kind, Name: name, Namespace: ns, Version: version,
				}})
			}
			for _, name := range sortedNames(result.Valid) {
				if skip[istioObjectKey(ns, kind, name)] {
					continue
				}
				work = append(work, istioWorkItem{target: istioLookupTarget{
					Group: group, Kind: kind, ListedValid: true, Name: name, Namespace: ns, Version: version,
				}})
			}
		}
	}
	return work
}

func fetchIstioValidations(work []istioWorkItem, lookup func(namespace, group, version, kind, name string) *models.IstioValidation, sem chan struct{}) map[string]*models.IstioValidation {
	found := map[string]*models.IstioValidation{}
	if lookup == nil {
		return found
	}
	var targets []istioLookupTarget
	for _, item := range work {
		if item.notValidated {
			continue
		}
		targets = append(targets, item.target)
	}
	if len(targets) == 0 {
		return found
	}
	if sem == nil {
		sem = make(chan struct{}, troubleshootingLookupParallelism)
	}

	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, target := range targets {
		wg.Add(1)
		go func(target istioLookupTarget) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			validation := lookup(target.Namespace, target.Group, target.Version, target.Kind, target.Name)
			mu.Lock()
			found[istioObjectKey(target.Namespace, target.Kind, target.Name)] = validation
			mu.Unlock()
		}(target)
	}
	wg.Wait()
	return found
}

func istioObjectSubProblem(namespace, kind, name string, validation *models.IstioValidation) SubProblem {
	target := fmt.Sprintf("%s: %s/%s", kind, namespace, name)
	return SubProblem{
		Checks:   validationChecks(namespace, kind, name, validation),
		ID:       istioObjectID(namespace, kind, name),
		Impact:   fmt.Sprintf("%s %q in namespace %q fails validation.", kind, name, namespace),
		Issue:    fmt.Sprintf("%s %q fails validation", kind, name),
		Severity: SeverityCritical,
		SuggestedActions: []SuggestedAction{
			{
				Type:        ActionTypeAdvice,
				Description: fmt.Sprintf("Inspect %s %s", kind, name),
				Command:     fmt.Sprintf("kubectl get %s %s -n %s -o yaml", strings.ToLower(kind), name, namespace),
			},
		},
		Target: target,
	}
}

func validIstioObjectSubProblem(namespace, kind, name string, checks []ValidationCheck) SubProblem {
	sub := istioObjectSubProblem(namespace, kind, name, nil)
	sub.Checks = checks
	sub.Impact = fmt.Sprintf("%s %q in namespace %q is valid but has warning validation checks.", kind, name, namespace)
	sub.Issue = fmt.Sprintf("%s %q has validation checks", kind, name)
	sub.Severity = SeverityWarning
	return sub
}

func validationChecks(namespace, kind, name string, validation *models.IstioValidation) []ValidationCheck {
	if validation == nil {
		return nil
	}
	checks := make([]ValidationCheck, 0, len(validation.Checks))
	for _, check := range validation.Checks {
		if check == nil || check.Code == "" {
			continue
		}
		checks = append(checks, ValidationCheck{
			Code:            check.Code,
			Message:         check.Message,
			Path:            check.Path,
			Severity:        checkDisplaySeverity(check.Severity),
			SuggestedPrompt: checkPrompt(namespace, kind, name, check),
		})
	}
	return checks
}

func checkDisplaySeverity(level models.SeverityLevel) string {
	switch strings.ToLower(string(level)) {
	case string(models.ErrorSeverity), SeverityCritical:
		return SeverityCritical
	default:
		return SeverityWarning
	}
}

func checkPrompt(namespace, kind, name string, check *models.IstioCheck) string {
	if check.Path != "" {
		return fmt.Sprintf("Analyze why %s %s/%s fails check %s at %s: %s. What change fixes it?", kind, namespace, name, check.Code, check.Path, check.Message)
	}
	return fmt.Sprintf("Analyze why %s %s/%s fails check %s: %s. What change fixes it?", kind, namespace, name, check.Code, check.Message)
}

func istioNotValidatedSubProblem(namespace, kind, name, id string) SubProblem {
	target := fmt.Sprintf("%s: %s/%s", kind, namespace, name)
	return SubProblem{
		ID:       id,
		Impact:   fmt.Sprintf("%s %q in namespace %q was not validated.", kind, name, namespace),
		Issue:    "validation is not available",
		Severity: SeverityWarning,
		SuggestedActions: []SuggestedAction{
			{
				Type:        ActionTypeAdvice,
				Description: fmt.Sprintf("Inspect %s %s", kind, name),
				Command:     fmt.Sprintf("kubectl get %s %s -n %s -o yaml", strings.ToLower(kind), name, namespace),
			},
		},
		SuggestedPrompt: fmt.Sprintf("Analyze %s %s/%s. Kiali did not validate this object. Is the configuration safe, and what should be checked?", kind, namespace, name),
		Target:          target,
	}
}

// attachIstioAnalyzeAction asks the troubleshooter to fetch this object's YAML.
// The prompt carries the object path and the manage_istio_config_read get parameters.
func attachIstioAnalyzeAction(sub *SubProblem) {
	if sub == nil || sub.IstioObject == nil {
		return
	}
	obj := sub.IstioObject
	action := SuggestedAction{
		Description: fmt.Sprintf("Analyze the YAML of %s %s", obj.Kind, obj.Name),
		Prompt:      istioAnalyzePrompt(sub),
		Type:        ActionTypeAnalyze,
	}
	sub.SuggestedActions = append([]SuggestedAction{action}, sub.SuggestedActions...)
}

func istioObjectPath(obj *IstioObjectRef) string {
	return fmt.Sprintf("istio/%s/%s/%s/%s", obj.Group, obj.Version, obj.Kind, obj.Name)
}

func istioAnalyzePrompt(sub *SubProblem) string {
	obj := sub.IstioObject
	var b strings.Builder
	fmt.Fprintf(&b, "Analyze the YAML of Istio object %s in namespace %s. ", istioObjectPath(obj), obj.Namespace)
	fmt.Fprintf(&b, "Fetch it with the manage_istio_config_read tool, action get, using namespace=%q, group=%q, version=%q, kind=%q, object=%q. ", obj.Namespace, obj.Group, obj.Version, obj.Kind, obj.Name)
	if len(sub.Checks) == 0 {
		b.WriteString("Kiali did not report validation checks. Inspect the YAML and say whether the configuration is safe.")
		return b.String()
	}
	b.WriteString("Kiali reported these validation checks:\n")
	for _, check := range sub.Checks {
		if check.Path != "" {
			fmt.Fprintf(&b, "- [%s] %s at %s: %s\n", check.Code, check.Severity, check.Path, check.Message)
			continue
		}
		fmt.Fprintf(&b, "- [%s] %s: %s\n", check.Code, check.Severity, check.Message)
	}
	b.WriteString("Explain the root cause from the YAML and the minimal change that fixes the checks.")
	return b.String()
}

func listIstioConfig(ki *mcputil.KialiInterface, cluster, namespace string) (manage_istio_config.IstioListResult, bool) {
	if ki == nil {
		return manage_istio_config.IstioListResult{}, false
	}
	args := map[string]interface{}{"action": "list"}
	if cluster != "" {
		args["clusterName"] = cluster
	}
	if namespace != "" {
		args["namespace"] = namespace
	}
	result, code := manage_istio_config_read.Execute(ki, args)
	if code != http.StatusOK {
		log.Debugf("troubleshooting: manage_istio_config_read list namespace %q returned %d: %v", namespace, code, result)
		return manage_istio_config.IstioListResult{}, false
	}
	switch typed := result.(type) {
	case manage_istio_config.IstioListResult:
		return typed, true
	case *manage_istio_config.IstioListResult:
		if typed != nil {
			return *typed, true
		}
	default:
		log.Debugf("troubleshooting: manage_istio_config_read list namespace %q returned %T", namespace, result)
	}
	return manage_istio_config.IstioListResult{}, false
}

func getIstioValidation(ki *mcputil.KialiInterface, cluster, namespace, group, version, kind, name string) *models.IstioValidation {
	if ki == nil {
		return nil
	}
	args := map[string]interface{}{
		"action":    "get",
		"namespace": namespace,
		"group":     group,
		"version":   version,
		"kind":      kind,
		"object":    name,
	}
	if cluster != "" {
		args["clusterName"] = cluster
	}
	result, code := manage_istio_config_read.Execute(ki, args)
	if code != http.StatusOK {
		log.Debugf("troubleshooting: manage_istio_config_read get %s/%s returned %d: %v", namespace, name, code, result)
		return nil
	}
	switch typed := result.(type) {
	case models.IstioConfigDetails:
		return typed.IstioValidation
	case *models.IstioConfigDetails:
		if typed != nil {
			return typed.IstioValidation
		}
	default:
		log.Debugf("troubleshooting: manage_istio_config_read get %s/%s returned %T", namespace, name, result)
	}
	return nil
}

func parseGVKKey(key string) (group, version, kind string, ok bool) {
	parts := strings.Split(key, "/")
	if len(parts) < 3 {
		return "", "", "", false
	}
	kind = parts[len(parts)-1]
	version = parts[len(parts)-2]
	group = strings.Join(parts[:len(parts)-2], "/")
	if group == "" || version == "" || kind == "" {
		return "", "", "", false
	}
	return group, version, kind, true
}

func sortedNames(names []string) []string {
	out := append([]string(nil), names...)
	sort.Strings(out)
	return out
}
