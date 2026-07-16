package analyze_ambient_policies

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	networking_v1_api "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/business/checkers/ambient"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestGenerateSummary_NoAmbient(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:      "test-ns",
		IsAmbient: false,
	}

	summary := generateSummary(2, 3, 0, nsStatus)
	assert.Contains(t, summary, "NOT in Ambient mode")
	assert.Contains(t, summary, "sidecars")
}

func TestGenerateSummary_AmbientWithWaypoint(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:         "test-ns",
		IsAmbient:    true,
		HasWaypoint:  true,
		WaypointName: "waypoint-proxy",
	}

	summary := generateSummary(1, 2, 0, nsStatus)
	assert.Contains(t, summary, "waypoint-proxy")
	assert.NotContains(t, summary, "WARNING")
}

func TestGenerateSummary_AmbientWithoutWaypoint(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:        "test-ns",
		IsAmbient:   true,
		HasWaypoint: false,
	}

	summary := generateSummary(1, 2, 2, nsStatus)
	assert.Contains(t, summary, "WARNING")
	assert.Contains(t, summary, "will NOT work!")
}

func TestGenerateRecommendations_NeedWaypoint(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:        "test-ns",
		IsAmbient:   true,
		HasWaypoint: false,
	}

	recommendations := generateRecommendations(nsStatus, 2, 2)
	assert.NotEmpty(t, recommendations)
	assert.Contains(t, recommendations[0], "Deploy a waypoint")
	assert.Contains(t, recommendations[0], "istioctl waypoint apply")
}

func TestGenerateRecommendations_NoIssues(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:         "test-ns",
		IsAmbient:    true,
		HasWaypoint:  true,
		WaypointName: "waypoint-proxy",
	}

	recommendations := generateRecommendations(nsStatus, 2, 0)
	assert.NotEmpty(t, recommendations)
	assert.Contains(t, recommendations[0], "No issues found")
}

func TestAnalyzeVirtualService_HTTPRoutes_IsL7(t *testing.T) {
	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "my-vs"},
		Spec: networking_v1_api.VirtualService{
			Http: []*networking_v1_api.HTTPRoute{
				{Name: "route-1"},
			},
		},
	}
	nsStatus := ambient.NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, IsEnrolled: true, HasWaypoint: true, WaypointName: "waypoint"}
	result := analyzeVirtualService(vs, nsStatus)
	assert.Equal(t, ambient.LayerL7, result.Layer)
	assert.Empty(t, result.Warning, "No warning expected when namespace is enrolled")
}

func TestAnalyzeVirtualService_TCPOnly_IsL4(t *testing.T) {
	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "tcp-vs"},
		Spec: networking_v1_api.VirtualService{
			Tcp: []*networking_v1_api.TCPRoute{
				{},
			},
		},
	}
	nsStatus := ambient.NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, IsEnrolled: false, HasWaypoint: false}
	result := analyzeVirtualService(vs, nsStatus)
	assert.Equal(t, ambient.LayerL4, result.Layer, "TCP-only VirtualService should be L4")
	assert.Empty(t, result.Warning, "No warning for L4 config without enrollment")
}

func TestAnalyzeVirtualService_HTTPNoEnrollment_HasWarning(t *testing.T) {
	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "my-vs"},
		Spec: networking_v1_api.VirtualService{
			Http: []*networking_v1_api.HTTPRoute{
				{Name: "route-1"},
			},
		},
	}
	nsStatus := ambient.NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, IsEnrolled: false, HasWaypoint: false}
	result := analyzeVirtualService(vs, nsStatus)
	assert.Equal(t, ambient.LayerL7, result.Layer)
	assert.NotEmpty(t, result.Warning)
	assert.Contains(t, result.Warning, "NOT enrolled")
}

func TestAnalyzeVirtualService_IngressGatewayOnly_NoWarning(t *testing.T) {
	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "ingress-vs"},
		Spec: networking_v1_api.VirtualService{
			Gateways: []string{"my-ingress-gateway"},
			Http: []*networking_v1_api.HTTPRoute{
				{Name: "route-1"},
			},
		},
	}
	nsStatus := ambient.NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, IsEnrolled: false, HasWaypoint: false}
	result := analyzeVirtualService(vs, nsStatus)
	assert.Equal(t, ambient.LayerL7, result.Layer)
	assert.Empty(t, result.Warning, "VS targeting ingress Gateway should NOT warn about missing enrollment")
	assert.Contains(t, result.Reason, "ingress/egress Gateway")
}

func TestAnalyzeVirtualService_MeshAndGateway_HasWarning(t *testing.T) {
	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "mesh-and-ingress-vs"},
		Spec: networking_v1_api.VirtualService{
			Gateways: []string{"mesh", "my-ingress-gateway"},
			Http: []*networking_v1_api.HTTPRoute{
				{Name: "route-1"},
			},
		},
	}
	nsStatus := ambient.NamespaceAmbientStatus{Name: "test-ns", IsAmbient: true, IsEnrolled: false, HasWaypoint: false}
	result := analyzeVirtualService(vs, nsStatus)
	assert.Equal(t, ambient.LayerL7, result.Layer)
	assert.NotEmpty(t, result.Warning, "VS targeting both mesh and Gateway still needs enrollment for mesh traffic")
}

func setupExecuteTest(t *testing.T, objs ...runtime.Object) (*mcputil.KialiInterface, *config.Config) {
	t.Helper()
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(objs...)
	layer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	r := httptest.NewRequest(http.MethodPost, "/api/chat/mcp/analyze_ambient_policies", nil)
	r.Header.Set("Kiali-User", "test-user")
	return &mcputil.KialiInterface{
		Request:       r,
		BusinessLayer: layer,
		Conf:          conf,
	}, conf
}

func TestExecute_BothNamespaceAndNamespaces_ReturnsBadRequest(t *testing.T) {
	ki, _ := setupExecuteTest(t,
		kubetest.FakeNamespaceWithLabels("ambient-ns", map[string]string{
			config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
		}),
	)

	result, status := Execute(ki, map[string]interface{}{
		"namespace":  "ambient-ns",
		"namespaces": []interface{}{"ambient-ns"},
	})
	assert.Equal(t, http.StatusBadRequest, status)
	assert.Contains(t, result.(string), "cannot specify both")
}

func TestExecute_AutoDiscoverAmbientNamespaces(t *testing.T) {
	ki, _ := setupExecuteTest(t,
		kubetest.FakeNamespaceWithLabels("ambient-ns", map[string]string{
			config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
		}),
		kubetest.FakeNamespace("default"),
	)

	result, status := Execute(ki, map[string]interface{}{})
	assert.Equal(t, http.StatusOK, status)

	resp, ok := result.(PolicyAnalysisResponse)
	require.True(t, ok)
	require.Len(t, resp.Namespaces, 1)
	assert.Equal(t, "ambient-ns", resp.Namespaces[0].NamespaceStatus.Name)
}

func TestExecute_InvalidNamespace_RecordsPerNamespaceError(t *testing.T) {
	ki, _ := setupExecuteTest(t,
		kubetest.FakeNamespaceWithLabels("ambient-ns", map[string]string{
			config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
		}),
	)

	result, status := Execute(ki, map[string]interface{}{
		"namespaces": []interface{}{"ambient-ns", "missing-ns"},
	})
	assert.Equal(t, http.StatusOK, status)

	resp, ok := result.(PolicyAnalysisResponse)
	require.True(t, ok)
	require.Len(t, resp.Namespaces, 2)
	assert.Equal(t, "ambient-ns", resp.Namespaces[0].NamespaceStatus.Name)
	assert.NotContains(t, resp.Namespaces[0].Summary, "Error:")
	assert.Equal(t, "missing-ns", resp.Namespaces[1].NamespaceStatus.Name)
	assert.Contains(t, resp.Namespaces[1].Summary, "Error:")
}
