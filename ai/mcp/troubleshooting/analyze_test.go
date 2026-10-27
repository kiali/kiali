package troubleshooting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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
