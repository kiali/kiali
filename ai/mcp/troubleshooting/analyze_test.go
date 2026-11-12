package troubleshooting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/ai/mcp/analyze_ambient_policies"
	"github.com/kiali/kiali/ai/mcp/get_mesh_status"
	"github.com/kiali/kiali/ai/mcp/get_mesh_traffic_graph"
	"github.com/kiali/kiali/ai/mcp/list_or_get_resources"
	"github.com/kiali/kiali/ai/mcp/manage_istio_config"
	"github.com/kiali/kiali/models"
)

func TestSubProblemsFromResourceList(t *testing.T) {
	services := map[string][]list_or_get_resources.ResourceListItem{
		"Kubernetes": {
			{Name: "details", Namespace: "bookinfo", Health: "Healthy"},
			{Name: "ratings", Namespace: "bookinfo", Health: "Failure"},
		},
	}
	subs := subProblemsFromResourceList("Kubernetes", "bookinfo", "service", services)
	require.Len(t, subs, 1)
	assert.Equal(t, "dp-kubernetes-bookinfo-service-ratings", subs[0].ID)
	assert.Equal(t, "Service: bookinfo/ratings", subs[0].Target)
	assert.Equal(t, "health is Failure", subs[0].Issue)
	assert.Equal(t, SeverityCritical, subs[0].Severity)

	workloads := map[string][]list_or_get_resources.ResourceListItem{
		"Kubernetes": {
			{Name: "reviews-v2", Namespace: "bookinfo", Health: "DEGRADED", Type: "Deployment"},
			{Name: "reviews-v1", Namespace: "bookinfo", Health: "NA"},
		},
	}
	subs = subProblemsFromResourceList("Kubernetes", "bookinfo", "workload", workloads)
	require.Len(t, subs, 1)
	assert.Equal(t, "Workload (Deployment): bookinfo/reviews-v2", subs[0].Target)

	apps := list_or_get_resources.AppListResponse{Applications: []list_or_get_resources.AppListItem{
		{Name: "productpage", Health: "DEGRADED"},
		{Name: "reviews", Health: "NA"},
	}}
	subs = subProblemsFromResourceList("Kubernetes", "bookinfo", "app", apps)
	require.Len(t, subs, 1)
	assert.Equal(t, "dp-kubernetes-bookinfo-app-productpage", subs[0].ID)

	argo := list_or_get_resources.ArgoCDAppListResponse{Applications: []list_or_get_resources.ArgoCDAppListItem{
		{Name: "bookinfo", Health: "Healthy"},
		{Name: "bookinfo-dev", Health: "Degraded"},
	}}
	subs = subProblemsFromResourceList("Kubernetes", "bookinfo", "argoapp", argo)
	require.Len(t, subs, 1)
	assert.Contains(t, subs[0].Target, "ArgoCD Application")
	assert.Contains(t, subs[0].Target, "bookinfo-dev")

	assert.Empty(t, subProblemsFromResourceList("Kubernetes", "bookinfo", "argoapp", "ArgoCD is not installed"))
}

func TestNamespaceFindings(t *testing.T) {
	namespaceSub := newSubProblem("dp-kubernetes-bookinfo-ns", "Namespace: bookinfo", "health is NOT_READY", "namespace is not ready")
	workload := newSubProblem("dp-kubernetes-bookinfo-workload-ratings-v1", "Workload: bookinfo/ratings-v1", "health is Not Ready", "workload is not healthy")
	warning := istioNotValidatedSubProblem("bookinfo", "VirtualService", "details", "dp-kubernetes-bookinfo-istio-virtualservice-details")

	onlyNamespace := namespaceFindings(namespaceSub, nil, nil)
	require.Len(t, onlyNamespace, 1)
	assert.Equal(t, "dp-kubernetes-bookinfo-ns", onlyNamespace[0].ID)

	withCause := namespaceFindings(namespaceSub, []SubProblem{workload}, []SubProblem{warning})
	require.Len(t, withCause, 2)
	assert.Equal(t, workload.ID, withCause[0].ID)
	assert.Equal(t, SeverityWarning, withCause[1].Severity)
	assert.NotEqual(t, namespaceSub.ID, withCause[0].ID)

	warningsOnly := namespaceFindings(namespaceSub, nil, []SubProblem{warning})
	require.Len(t, warningsOnly, 2)
	assert.Equal(t, namespaceSub.ID, warningsOnly[0].ID)
	assert.Equal(t, SeverityWarning, warningsOnly[1].Severity)
}

func TestIstioSubProblems(t *testing.T) {
	namespaces := map[string]map[string]manage_istio_config.KindValidationResult{
		"bookinfo": {
			"networking.istio.io/v1/DestinationRule": {
				Valid:   []string{"productpage", "ratings"},
				Invalid: []string{"details"},
			},
			"networking.istio.io/v1/VirtualService": {
				NotValidated: []string{"reviews"},
			},
		},
		"default": {
			"networking.istio.io/v1/DestinationRule": {
				Invalid: []string{"skipped"},
			},
		},
	}
	lookup := func(namespace, group, version, kind, name string) *models.IstioValidation {
		switch name {
		case "details":
			return &models.IstioValidation{Checks: []*models.IstioCheck{{
				Code:     "KIA0203",
				Message:  "This subset's labels are not found in any matching host",
				Path:     "spec/subsets[0]",
				Severity: models.ErrorSeverity,
			}}}
		case "productpage":
			return &models.IstioValidation{Checks: []*models.IstioCheck{{
				Code:     "KIA0201",
				Message:  "More than one DestinationRules for the same host subset combination",
				Path:     "spec/host",
				Severity: models.WarningSeverity,
			}}}
		default:
			return &models.IstioValidation{}
		}
	}
	critical, warnings, reported := istioSubProblems(namespaces, map[string]bool{"default/DestinationRule/skipped": true}, lookup, nil)

	require.Len(t, critical, 1)
	assert.Equal(t, "istio-bookinfo-destinationrule-details", critical[0].ID)
	require.Len(t, critical[0].Checks, 1)
	assert.Equal(t, "KIA0203", critical[0].Checks[0].Code)
	assert.Equal(t, SeverityCritical, critical[0].Checks[0].Severity)
	assert.Equal(t, "spec/subsets[0]", critical[0].Checks[0].Path)
	assert.Equal(t, SeverityCritical, critical[0].Severity)
	assert.Equal(t, "DestinationRule: bookinfo/details", critical[0].Target)
	assert.Equal(t, `DestinationRule "details" fails validation`, critical[0].Issue)
	require.NotNil(t, critical[0].IstioObject)
	assert.Equal(t, IstioObjectRef{Group: "networking.istio.io", Kind: "DestinationRule", Name: "details", Namespace: "bookinfo", Version: "v1"}, *critical[0].IstioObject)
	assert.Contains(t, critical[0].Checks[0].Message, "This subset's labels are not found in any matching host")
	assert.Contains(t, critical[0].Checks[0].SuggestedPrompt, "KIA0203")
	require.GreaterOrEqual(t, len(critical[0].SuggestedActions), 2)
	assert.Equal(t, ActionTypeAnalyze, critical[0].SuggestedActions[0].Type)
	assert.Contains(t, critical[0].SuggestedActions[0].Prompt, "istio/networking.istio.io/v1/DestinationRule/details")
	assert.Contains(t, critical[0].SuggestedActions[0].Prompt, `namespace="bookinfo"`)
	assert.Contains(t, critical[0].SuggestedActions[0].Prompt, `object="details"`)
	assert.Contains(t, critical[0].SuggestedActions[0].Prompt, "manage_istio_config_read")
	assert.Contains(t, critical[0].SuggestedActions[1].Command, "kubectl get destinationrule details -n bookinfo")

	require.Len(t, warnings, 2)
	assert.Equal(t, "istio-bookinfo-destinationrule-productpage", warnings[0].ID)
	assert.Equal(t, SeverityWarning, warnings[0].Severity)
	assert.Equal(t, `DestinationRule "productpage" has validation checks`, warnings[0].Issue)
	assert.Contains(t, warnings[0].Impact, "is valid but has warning validation checks")
	require.NotNil(t, warnings[0].IstioObject)
	assert.Equal(t, "productpage", warnings[0].IstioObject.Name)
	require.Len(t, warnings[0].Checks, 1)
	assert.Equal(t, "KIA0201", warnings[0].Checks[0].Code)
	assert.Equal(t, SeverityWarning, warnings[1].Severity)
	assert.Equal(t, "istio-bookinfo-virtualservice-reviews", warnings[1].ID)
	assert.Equal(t, "validation is not available", warnings[1].Issue)
	require.NotNil(t, warnings[1].IstioObject)
	assert.Equal(t, IstioObjectRef{Group: "networking.istio.io", Kind: "VirtualService", Name: "reviews", Namespace: "bookinfo", Version: "v1"}, *warnings[1].IstioObject)
	assert.True(t, reported["bookinfo/DestinationRule/details"])
	assert.True(t, reported["bookinfo/DestinationRule/productpage"])
	assert.False(t, reported["bookinfo/DestinationRule/ratings"])
	assert.True(t, reported["bookinfo/VirtualService/reviews"])
	assert.False(t, reported["default/DestinationRule/skipped"])
}

func TestIstioSubProblems_ValidObjectStaysWarningEvenWithAnErrorCheck(t *testing.T) {
	namespaces := map[string]map[string]manage_istio_config.KindValidationResult{
		"bookinfo": {
			"networking.istio.io/v1/DestinationRule": {
				Valid: []string{"details"},
			},
		},
	}
	lookup := func(namespace, group, version, kind, name string) *models.IstioValidation {
		return &models.IstioValidation{Checks: []*models.IstioCheck{{
			Code:     "KIA0203",
			Message:  "This subset's labels are not found in any matching host",
			Severity: models.ErrorSeverity,
		}}}
	}
	critical, warnings, _ := istioSubProblems(namespaces, nil, lookup, nil)

	assert.Empty(t, critical)
	require.Len(t, warnings, 1)
	assert.Equal(t, SeverityWarning, warnings[0].Severity)
	assert.Equal(t, SeverityCritical, warnings[0].Checks[0].Severity)
}

func TestIstioSubProblems_InvalidObjectIsCriticalEvenWhenChecksAreWarnings(t *testing.T) {
	namespaces := map[string]map[string]manage_istio_config.KindValidationResult{
		"bookinfo": {
			"networking.istio.io/v1/VirtualService": {
				Invalid: []string{"reviews"},
			},
		},
	}
	lookup := func(namespace, group, version, kind, name string) *models.IstioValidation {
		return &models.IstioValidation{Checks: []*models.IstioCheck{
			{Code: "KIA1101", Message: "DestinationWeight on route doesn't have a valid service (host not found)", Path: "spec/http[0]/route[2]/destination/host", Severity: models.WarningSeverity},
			{Code: "KIA1107", Message: "Subset not found", Path: "spec/http[0]/route[1]/destination", Severity: models.WarningSeverity},
			{Code: "KIA1107", Message: "Subset not found", Path: "spec/http[0]/route[2]/destination", Severity: models.WarningSeverity},
		}}
	}
	critical, warnings, _ := istioSubProblems(namespaces, nil, lookup, nil)

	assert.Empty(t, warnings)
	require.Len(t, critical, 1)
	assert.Equal(t, "istio-bookinfo-virtualservice-reviews", critical[0].ID)
	assert.Equal(t, SeverityCritical, critical[0].Severity)
	assert.Contains(t, critical[0].Impact, "fails validation")
	require.NotNil(t, critical[0].IstioObject)
	assert.Equal(t, IstioObjectRef{Group: "networking.istio.io", Kind: "VirtualService", Name: "reviews", Namespace: "bookinfo", Version: "v1"}, *critical[0].IstioObject)
	require.Len(t, critical[0].Checks, 3)
	assert.Equal(t, "KIA1101", critical[0].Checks[0].Code)
	assert.Equal(t, SeverityWarning, critical[0].Checks[0].Severity)
	assert.Equal(t, "KIA1107", critical[0].Checks[1].Code)
	assert.Equal(t, "spec/http[0]/route[1]/destination", critical[0].Checks[1].Path)
	assert.Equal(t, "spec/http[0]/route[2]/destination", critical[0].Checks[2].Path)
	assert.Contains(t, critical[0].Checks[1].SuggestedPrompt, "spec/http[0]/route[1]/destination")
	assert.Contains(t, critical[0].Checks[2].SuggestedPrompt, "spec/http[0]/route[2]/destination")
	require.NotEmpty(t, critical[0].SuggestedActions)
	assert.Equal(t, ActionTypeAnalyze, critical[0].SuggestedActions[0].Type)
	assert.Contains(t, critical[0].SuggestedActions[0].Prompt, "istio/networking.istio.io/v1/VirtualService/reviews")
	assert.Contains(t, critical[0].SuggestedActions[0].Prompt, `group="networking.istio.io"`)
	assert.Contains(t, critical[0].SuggestedActions[0].Prompt, `version="v1"`)
	assert.Contains(t, critical[0].SuggestedActions[0].Prompt, `kind="VirtualService"`)
	assert.Contains(t, critical[0].SuggestedActions[0].Prompt, `object="reviews"`)
	assert.Contains(t, critical[0].SuggestedActions[0].Prompt, "KIA1101")
	assert.Contains(t, critical[0].SuggestedActions[0].Prompt, "spec/http[0]/route[2]/destination/host")
}

func TestIstioSubProblems_OneErrorCheckMakesTheObjectCritical(t *testing.T) {
	namespaces := map[string]map[string]manage_istio_config.KindValidationResult{
		"bookinfo": {
			"networking.istio.io/v1/VirtualService": {
				Invalid: []string{"reviews"},
			},
		},
	}
	lookup := func(namespace, group, version, kind, name string) *models.IstioValidation {
		return &models.IstioValidation{Checks: []*models.IstioCheck{
			{Code: "KIA1107", Message: "Subset not found", Path: "spec/http[0]/route[1]/destination", Severity: models.WarningSeverity},
			{Code: "KIA0101", Message: "VirtualService host not found", Severity: models.ErrorSeverity},
		}}
	}
	critical, warnings, _ := istioSubProblems(namespaces, nil, lookup, nil)

	assert.Empty(t, warnings)
	require.Len(t, critical, 1)
	assert.Equal(t, SeverityCritical, critical[0].Severity)
	require.Len(t, critical[0].Checks, 2)
	assert.Equal(t, SeverityWarning, critical[0].Checks[0].Severity)
	assert.Equal(t, SeverityCritical, critical[0].Checks[1].Severity)
}

func TestSubProblemsFromResourceListWithContext_SidecarConfigAndArgoSync(t *testing.T) {
	services := map[string][]list_or_get_resources.ResourceListItem{
		"Kubernetes": {
			{
				Configuration: "False",
				Details:       "KIA0701: Port name must follow <protocol>[-<suffix>] form (warning)",
				Health:        "Healthy",
				Name:          "reviews",
				Namespace:     "bookinfo",
			},
		},
	}
	svcSubs := subProblemsFromResourceListWithContext("Kubernetes", "bookinfo", "service", services, true, false)
	require.Len(t, svcSubs, 1)
	assert.Equal(t, "dp-kubernetes-bookinfo-config-service-reviews", svcSubs[0].ID)
	assert.Equal(t, SeverityWarning, svcSubs[0].Severity)
	assert.Contains(t, svcSubs[0].Issue, "KIA0701")

	workloads := map[string][]list_or_get_resources.ResourceListItem{
		"Kubernetes": {
			{
				Health:    "Healthy",
				Istio:     &list_or_get_resources.ResourceListIstioFlags{IstioSidecar: false},
				Name:      "productpage-v1",
				Namespace: "bookinfo",
				Type:      "Deployment",
			},
		},
	}
	wlSubs := subProblemsFromResourceListWithContext("Kubernetes", "bookinfo", "workload", workloads, true, false)
	require.Len(t, wlSubs, 1)
	assert.Equal(t, "mesh-kubernetes-bookinfo-sidecar-productpage-v1", wlSubs[0].ID)
	assert.Equal(t, SeverityWarning, wlSubs[0].Severity)
	assert.Contains(t, wlSubs[0].Issue, "missing Istio sidecar")

	argo := list_or_get_resources.ArgoCDAppListResponse{Applications: []list_or_get_resources.ArgoCDAppListItem{
		{Name: "bookinfo-prod", Health: "Healthy", SyncStatus: "OutOfSync"},
	}}
	argoSubs := subProblemsFromResourceListWithContext("Kubernetes", "bookinfo", "argoapp", argo, false, false)
	require.Len(t, argoSubs, 1)
	assert.Equal(t, "dp-kubernetes-bookinfo-argoapp-bookinfo-prod", argoSubs[0].ID)
	assert.Equal(t, SeverityWarning, argoSubs[0].Severity)
	assert.Equal(t, "sync status is OutOfSync", argoSubs[0].Issue)
}

func TestInspectWorkloadDetail_XDSSyncProxyVersionAndPodLifecycle(t *testing.T) {
	detail := list_or_get_resources.WorkloadDetailResponse{
		Istio: list_or_get_resources.WorkloadIstioInfo{
			IstioSidecar: true,
			ProxyVersion: "1.28.0",
			SyncStatus: &list_or_get_resources.SyncStatus{
				CDS: "SYNCED",
				EDS: "STALE",
				LDS: "SYNCED",
				RDS: "NOT_SENT",
			},
		},
		Pods: []list_or_get_resources.PodInfo{
			{
				IstioProxy: "NotReady",
				Name:       "reviews-v1-6f8b9c-crash",
				Status:     "CrashLoopBackOff",
			},
		},
		Workload: list_or_get_resources.WorkloadInfo{
			Kind:      "Deployment",
			Name:      "reviews-v1",
			Namespace: "bookinfo",
		},
	}

	subs := inspectWorkloadDetail("Kubernetes", "bookinfo", "1.30.5", detail)
	require.Len(t, subs, 3)

	assert.Equal(t, "mesh-kubernetes-bookinfo-xds-reviews-v1", subs[0].ID)
	assert.Equal(t, SeverityCritical, subs[0].Severity)
	assert.Contains(t, subs[0].Issue, "EDS=STALE")
	assert.Contains(t, subs[0].Issue, "RDS=NOT_SENT")

	assert.Equal(t, "mesh-kubernetes-bookinfo-version-reviews-v1", subs[1].ID)
	assert.Equal(t, SeverityWarning, subs[1].Severity)
	assert.Contains(t, subs[1].Issue, "1.28.0")
	assert.Contains(t, subs[1].Issue, "1.30.5")

	assert.Equal(t, "k8s-kubernetes-bookinfo-reviews-v1-reviews-v1-6f8b9c-crash", subs[2].ID)
	assert.Equal(t, SeverityCritical, subs[2].Severity)
	assert.Contains(t, subs[2].Issue, "CrashLoopBackOff")
	assert.Contains(t, subs[2].SuggestedPrompt, "get_pod_performance")
}

func TestInspectServiceDetail_ZeroEndpoints(t *testing.T) {
	detail := list_or_get_resources.ServiceDetailResponse{
		Endpoints: []list_or_get_resources.EndpointInfo{},
		Service: list_or_get_resources.ServiceInfo{
			Name:      "ratings",
			Namespace: "bookinfo",
			Selectors: map[string]string{"app": "ratings"},
			Type:      "ClusterIP",
		},
	}

	subs := inspectServiceDetail("Kubernetes", "bookinfo", detail)
	require.Len(t, subs, 1)
	assert.Equal(t, "k8s-kubernetes-bookinfo-endpoints-ratings", subs[0].ID)
	assert.Equal(t, SeverityCritical, subs[0].Severity)
	assert.Equal(t, "service has 0 active endpoints", subs[0].Issue)
}

func TestSubProblemsFromAmbientAnalysis(t *testing.T) {
	analysis := analyze_ambient_policies.PolicyAnalysisResponse{
		Namespaces: []analyze_ambient_policies.NamespaceAnalysis{
			{
				NamespaceStatus: analyze_ambient_policies.NamespaceAmbientStatus{
					Cluster:     "Kubernetes",
					HasWaypoint: false,
					IsAmbient:   true,
					Name:        "bookinfo",
				},
				Policies: []analyze_ambient_policies.AnalyzedPolicy{
					{
						ConfigType:    "AuthorizationPolicy",
						Layer:         "L7",
						Name:          "allow-get",
						NeedsWaypoint: true,
						Reason:        "uses HTTP methods",
						Warning:       "Namespace has no waypoint proxy. This L7 policy will NOT be enforced.",
					},
					{
						ConfigType:    "WasmPlugin",
						Layer:         "L7",
						Name:          "header-plugin",
						NeedsWaypoint: false,
						Warning:       "WasmPlugin in Ambient mode should use targetRefs instead of workload selector.",
					},
				},
			},
		},
	}

	subs := subProblemsFromAmbientAnalysis(analysis)
	require.Len(t, subs, 2)

	assert.Equal(t, "sec-ambient-bookinfo-authorizationpolicy-allow-get", subs[0].ID)
	assert.Equal(t, SeverityCritical, subs[0].Severity)
	require.NotNil(t, subs[0].IstioObject)
	assert.Equal(t, "security.istio.io", subs[0].IstioObject.Group)
	assert.Equal(t, "AuthorizationPolicy", subs[0].IstioObject.Kind)
	assert.Equal(t, ActionTypeAnalyze, subs[0].SuggestedActions[0].Type)

	assert.Equal(t, "sec-ambient-bookinfo-wasmplugin-header-plugin", subs[1].ID)
	assert.Equal(t, SeverityWarning, subs[1].Severity)
	require.NotNil(t, subs[1].IstioObject)
	assert.Equal(t, "extensions.istio.io", subs[1].IstioObject.Group)
}

func TestSubProblemsFromTrafficGraph(t *testing.T) {
	graphResp := get_mesh_traffic_graph.CompactGraphResponse{
		Errors: map[string]string{
			"health": "prometheus query timeout",
		},
		Traffic: []get_mesh_traffic_graph.CompactEdge{
			{
				Health:         "Failure",
				MTLS:           false,
				Protocol:       "http",
				ResponseTimeMs: 240,
				Source:         "productpage (v1)",
				Target:         "reviews (v2)",
				Throughput:     "12.5rps",
			},
			{
				Health:         "Healthy",
				MTLS:           true,
				Protocol:       "http",
				ResponseTimeMs: 1450,
				Source:         "reviews (v3)",
				Target:         "ratings (v1)",
			},
			{
				Health:   "Healthy",
				MTLS:     false,
				Protocol: "tcp",
				Source:   "ratings (v1)",
				Target:   "BlackHoleCluster",
			},
			{
				Health:   "Healthy",
				MTLS:     false,
				Protocol: "http",
				Source:   "details (v1)",
				Target:   "PassthroughCluster",
			},
		},
	}

	trafficSubs, plaintextSubs, promScrapeSubs := subProblemsFromTrafficGraph("bookinfo", graphResp)

	require.Len(t, promScrapeSubs, 1)
	assert.Equal(t, "obs-prometheus-health", promScrapeSubs[0].ID)

	require.Len(t, plaintextSubs, 1)
	assert.Equal(t, "sec-plaintext-bookinfo-productpage-v1-reviews-v2", plaintextSubs[0].ID)
	assert.Equal(t, SeverityWarning, plaintextSubs[0].Severity)

	require.Len(t, trafficSubs, 4)
	assert.Equal(t, "traffic-edge-bookinfo-productpage-v1-reviews-v2", trafficSubs[0].ID)
	assert.Equal(t, SeverityCritical, trafficSubs[0].Severity)

	assert.Equal(t, "traffic-latency-bookinfo-reviews-v3-ratings-v1", trafficSubs[1].ID)
	assert.Equal(t, SeverityWarning, trafficSubs[1].Severity)

	assert.Equal(t, "traffic-egress-bookinfo-ratings-v1-blackholecluster", trafficSubs[2].ID)
	assert.Equal(t, SeverityCritical, trafficSubs[2].Severity)

	assert.Equal(t, "traffic-egress-bookinfo-details-v1-passthroughcluster", trafficSubs[3].ID)
	assert.Equal(t, SeverityWarning, trafficSubs[3].Severity)
}

func TestBuildZtunnelIssue_IncludesUnreadyPods(t *testing.T) {
	ztunnel := &get_mesh_status.MeshSummaryZtunnel{
		DaemonSet: get_mesh_status.MeshSummaryZtunnelDaemonSet{
			DesiredPods: 2,
			ReadyPods:   1,
			Status:      "DEGRADED",
		},
		Pods: []get_mesh_status.MeshSummaryZtunnelPod{
			{Name: "ztunnel-node1", Node: "worker-1", Phase: "Running", Ready: true},
			{Name: "ztunnel-node2", Node: "worker-2", Phase: "CrashLoopBackOff", Ready: false},
		},
	}

	issue := buildZtunnelIssue(ztunnel, map[string]bool{})
	require.NotNil(t, issue)
	require.Len(t, issue.SubProblems, 2)
	assert.Equal(t, idDataPlaneZtunnelDS, issue.SubProblems[0].ID)
	assert.Equal(t, SeverityWarning, issue.SubProblems[0].Severity)
	assert.Equal(t, "dp-ztunnel-pod-ztunnel-node2", issue.SubProblems[1].ID)
	assert.Equal(t, SeverityCritical, issue.SubProblems[1].Severity)
	assert.Contains(t, issue.SubProblems[1].Target, "worker-2")
}

func TestFilterRedundantAppSubProblems(t *testing.T) {
	workloadList := map[string][]list_or_get_resources.ResourceListItem{
		"Kubernetes": {
			{
				Health:    "DEGRADED",
				Labels:    "app=reviews, version=v2",
				Name:      "reviews-v2",
				Namespace: "bookinfo",
				Type:      "Deployment",
			},
		},
	}
	wlSubs := subProblemsFromResourceList("Kubernetes", "bookinfo", "workload", workloadList)
	require.Len(t, wlSubs, 1)
	assert.Contains(t, wlSubs[0].Impact, `(app "reviews")`)

	appList := list_or_get_resources.AppListResponse{
		Applications: []list_or_get_resources.AppListItem{
			{Name: "reviews", Health: "DEGRADED"},
			{Name: "productpage", Health: "DEGRADED"},
		},
	}
	appSubs := subProblemsFromResourceList("Kubernetes", "bookinfo", "app", appList)
	require.Len(t, appSubs, 2)

	covered := appsCoveredByWorkloadIssues("bookinfo", workloadList, wlSubs, nil)
	filtered := filterRedundantAppSubProblems("bookinfo", appSubs, covered)
	require.Len(t, filtered, 1)
	assert.Equal(t, "App: bookinfo/productpage", filtered[0].Target)
}
