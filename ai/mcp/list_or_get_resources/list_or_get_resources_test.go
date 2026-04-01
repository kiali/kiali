package list_or_get_resources

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/util"
)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func setupMocks(t *testing.T) *mcputil.KialiInterface {
	t.Helper()
	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)
	prom := &prometheustest.PromClientMock{}
	grafanaSvc := grafana.NewService(conf, cf.GetSAHomeClusterClient())
	persesSvc := perses.NewService(conf, cf.GetSAHomeClusterClient())

	req, _ := http.NewRequestWithContext(context.TODO(), "POST", "/", nil)

	cpm := &business.FakeControlPlaneMonitor{}
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}
	userClients, _ := cf.GetClients(authInfo)
	businessLayer, _ := business.NewLayerWithSAClients(conf, kialiCache, prom, nil, cpm, grafanaSvc, discovery, userClients)

	return &mcputil.KialiInterface{
		Request:       req,
		BusinessLayer: businessLayer,
		Prom:          prom,
		ClientFactory: cf,
		KialiCache:    kialiCache,
		Conf:          conf,
		Graphana:      grafanaSvc,
		Perses:        persesSvc,
		Discovery:     discovery,
	}
}

// ---------------------------------------------------------------------------
// 1. Schema / input validation tests
// ---------------------------------------------------------------------------

func TestExecute_MissingResourceType(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusBadRequest, code)
	assert.Equal(t, "Resource type is required", resp)
}

func TestExecute_InvalidResourceType(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "invalid_type",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, resp.(string), "unsupported resource type invalid_type")
}

func TestExecute_ValidResourceTypes(t *testing.T) {
	util.Clock = util.RealClock{}

	validTypes := []string{"service", "workload", "app", "application"}

	for _, rt := range validTypes {
		t.Run("ResourceType_"+rt, func(t *testing.T) {
			ki := setupMocks(t)

			args := map[string]interface{}{
				"resource_type": rt,
			}

			_, code := Execute(ki, args)

			assert.Equal(t, http.StatusOK, code)
		})
	}
}

func TestExecute_WithResourceNameAndNamespaces(t *testing.T) {
	util.Clock = util.RealClock{}

	t.Run("ResourceNameWithoutNamespaces", func(t *testing.T) {
		ki := setupMocks(t)

		args := map[string]interface{}{
			"resource_type": "service",
			"resource_name": "my-service",
		}

		resp, code := Execute(ki, args)

		assert.Equal(t, http.StatusBadRequest, code)
		assert.Equal(t, "Namespaces are required when resource name is provided", resp)
	})

	t.Run("WithAllParameters", func(t *testing.T) {
		ki := setupMocks(t)

		args := map[string]interface{}{
			"resource_type": "service",
			"resource_name": "my-service",
			"namespaces":    "default",
			"cluster_name":  "Kubernetes",
		}

		_, code := Execute(ki, args)

		assert.Equal(t, http.StatusNotFound, code)
	})
}

func TestExecute_DefaultsRateInterval(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "service",
	}

	_, code := Execute(ki, args)

	assert.Equal(t, http.StatusOK, code)
}

// ---------------------------------------------------------------------------
// 2. Namespace handling tests
// ---------------------------------------------------------------------------

func TestExecute_InvalidNamespace(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "app",
		"namespaces":    "non-existent-namespace",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusNotFound, code)
	respStr, ok := resp.(string)
	assert.True(t, ok, "Expected response to be a string")
	assert.Contains(t, respStr, "non-existent-namespace")
	assert.Contains(t, respStr, "not found or not accessible")
}

func TestExecute_AllInvalidNamespacesReturnsErrorMessage(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "service",
		"namespaces":    "invalid1,invalid2",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusNotFound, code)
	respStr, ok := resp.(string)
	assert.True(t, ok, "Expected response to be a string")
	assert.Contains(t, respStr, "invalid1")
	assert.Contains(t, respStr, "invalid2")
	assert.Contains(t, respStr, "not found or not accessible")
}

func TestExecute_NamespacesWithWhitespace(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "service",
		"namespaces":    "  invalid1 , invalid2 ",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusNotFound, code)
	respStr, ok := resp.(string)
	assert.True(t, ok, "Expected response to be a string")
	assert.Contains(t, respStr, "invalid1")
	assert.Contains(t, respStr, "invalid2")
	assert.NotContains(t, respStr, "  invalid1")
	assert.NotContains(t, respStr, "invalid2 ,")
}

func TestExecute_NamespacesWithEmptySegments(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "service",
		"namespaces":    "invalid1,,invalid2,",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusNotFound, code)
	respStr, ok := resp.(string)
	assert.True(t, ok, "Expected response to be a string")
	assert.Contains(t, respStr, "invalid1")
	assert.Contains(t, respStr, "invalid2")
}

func TestExecute_ResourceNameWithMultipleNamespacesReturnsError(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "service",
		"resource_name": "my-service",
		"namespaces":    "ns1,ns2",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusNotFound, code)
	respStr, ok := resp.(string)
	assert.True(t, ok, "Expected response to be a string")
	assert.Contains(t, respStr, "not found or not accessible")
}

// ---------------------------------------------------------------------------
// 3. Namespace resource type tests
// ---------------------------------------------------------------------------

func TestExecute_NamespaceResourceType(t *testing.T) {
	util.Clock = util.RealClock{}

	t.Run("NamespaceList", func(t *testing.T) {
		ki := setupMocks(t)

		args := map[string]interface{}{
			"resource_type": "namespace",
		}

		resp, code := Execute(ki, args)

		assert.Equal(t, http.StatusOK, code)
		_, ok := resp.(NamespaceListResponse)
		assert.True(t, ok, "Expected NamespaceListResponse type")
	})

	t.Run("NamespaceWithResourceNameUsedAsFilter", func(t *testing.T) {
		ki := setupMocks(t)

		args := map[string]interface{}{
			"resource_type": "namespace",
			"resource_name": "nonexistent",
		}

		resp, code := Execute(ki, args)

		assert.Equal(t, http.StatusNotFound, code)
		respStr, ok := resp.(string)
		assert.True(t, ok, "Expected response to be a string")
		assert.Contains(t, respStr, "nonexistent")
		assert.Contains(t, respStr, "not found or not accessible")
	})
}

func TestExecute_NamespaceDetailNotFound(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "namespace",
		"resource_name": "nonexistent-namespace",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusNotFound, code)
	respStr, ok := resp.(string)
	assert.True(t, ok, "Expected response to be a string")
	assert.Contains(t, respStr, "nonexistent-namespace")
	assert.Contains(t, respStr, "not found or not accessible")
}

// ---------------------------------------------------------------------------
// 4. classifyError tests
// ---------------------------------------------------------------------------

func TestClassifyError(t *testing.T) {
	tests := []struct {
		name    string
		err     error
		wantMsg string
	}{
		{
			name:    "not found",
			err:     k8serrors.NewNotFound(schema.GroupResource{Resource: "services"}, "my-svc"),
			wantMsg: "not found",
		},
		{
			name:    "forbidden",
			err:     k8serrors.NewForbidden(schema.GroupResource{Resource: "services"}, "my-svc", fmt.Errorf("not allowed")),
			wantMsg: "Access denied",
		},
		{
			name:    "bad request",
			err:     k8serrors.NewBadRequest("invalid field"),
			wantMsg: "invalid field",
		},
		{
			name:    "unknown error",
			err:     errors.New("something unexpected"),
			wantMsg: "something unexpected",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg := classifyError(tt.err, "service", "reviews", "bookinfo")
			assert.Contains(t, msg, tt.wantMsg)
		})
	}
}

// ---------------------------------------------------------------------------
// 5. Panic recovery tests
// ---------------------------------------------------------------------------

func TestRecoverFromPanic_CatchesPanic(t *testing.T) {
	var res interface{}
	var status int

	func() {
		defer recoverFromPanic(&res, &status, "service", "reviews", "bookinfo")
		panic("simulated nil pointer dereference")
	}()

	assert.Equal(t, http.StatusInternalServerError, status)
	resStr, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, resStr, "Internal error")
	assert.Contains(t, resStr, "service")
	assert.Contains(t, resStr, "reviews")
	assert.Contains(t, resStr, "bookinfo")
}

func TestRecoverFromPanic_NoPanic(t *testing.T) {
	var res interface{}
	var status int

	func() {
		defer recoverFromPanic(&res, &status, "service", "reviews", "bookinfo")
		res = "success"
		status = http.StatusOK
	}()

	assert.Equal(t, http.StatusOK, status)
	assert.Equal(t, "success", res)
}

// ---------------------------------------------------------------------------
// 6. ArgoCD Application tests
// ---------------------------------------------------------------------------

func TestExecute_ApplicationList(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "application",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusOK, code)
	// The fake K8s client has no real REST config, so the dynamic client
	// creation fails gracefully with a friendly error message.
	respStr, ok := resp.(string)
	assert.True(t, ok, "Expected string error response from fake client, got %T", resp)
	assert.Contains(t, respStr, "ArgoCD Application resources could not be queried")
}

func TestExecute_ApplicationListWithNonExistentNamespace(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "application",
		"namespaces":    "argocd-wrong",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusOK, code)
	respStr, ok := resp.(string)
	assert.True(t, ok, "Expected string response, got %T", resp)
	assert.Contains(t, respStr, "argocd-wrong")
	assert.Contains(t, respStr, "not found or not accessible")
}

func TestExecute_ApplicationDetailWithoutNamespace(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "application",
		"resource_name": "guestbook",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "Namespaces are required when resource name is provided", resp)
}

func TestExecute_ApplicationDetailInNonExistentNamespace(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "application",
		"resource_name": "nonexistent-app",
		"namespaces":    "argocd-wrong",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusOK, code)
	respStr, ok := resp.(string)
	assert.True(t, ok, "Expected string response, got %T", resp)
	assert.Contains(t, respStr, "argocd-wrong")
	assert.Contains(t, respStr, "not found or not accessible")
}

func TestValidateNamespacesViaK8s(t *testing.T) {
	fakeClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "argocd"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "default"}},
	)

	t.Run("all valid", func(t *testing.T) {
		valid, invalid := validateNamespacesViaK8s(fakeClient, []string{"argocd", "default"})
		assert.Equal(t, []string{"argocd", "default"}, valid)
		assert.Empty(t, invalid)
	})

	t.Run("all invalid", func(t *testing.T) {
		valid, invalid := validateNamespacesViaK8s(fakeClient, []string{"no-such-ns"})
		assert.Empty(t, valid)
		assert.Equal(t, []string{"no-such-ns"}, invalid)
	})

	t.Run("mixed", func(t *testing.T) {
		valid, invalid := validateNamespacesViaK8s(fakeClient, []string{"argocd", "bogus"})
		assert.Equal(t, []string{"argocd"}, valid)
		assert.Equal(t, []string{"bogus"}, invalid)
	})
}

func TestParseNamespaceCSV(t *testing.T) {
	tests := []struct {
		input    string
		expected []string
	}{
		{"", nil},
		{"argocd", []string{"argocd"}},
		{"ns1,ns2", []string{"ns1", "ns2"}},
		{"  ns1 , ns2 ", []string{"ns1", "ns2"}},
		{"ns1,,ns2,", []string{"ns1", "ns2"}},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := parseNamespaceCSV(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestExecute_ApplicationAlwaysReturns200(t *testing.T) {
	util.Clock = util.RealClock{}

	scenarios := []struct {
		name         string
		args         map[string]interface{}
		wantContains string
	}{
		{
			name:         "list all namespaces",
			args:         map[string]interface{}{"resource_type": "application"},
			wantContains: "could not be queried",
		},
		{
			name:         "list non-existent namespace",
			args:         map[string]interface{}{"resource_type": "application", "namespaces": "argocd"},
			wantContains: "not found or not accessible",
		},
		{
			name:         "get from non-existent namespace",
			args:         map[string]interface{}{"resource_type": "application", "resource_name": "myapp", "namespaces": "does-not-exist"},
			wantContains: "not found or not accessible",
		},
	}
	for _, sc := range scenarios {
		t.Run(sc.name, func(t *testing.T) {
			ki := setupMocks(t)
			resp, code := Execute(ki, sc.args)
			assert.Equal(t, http.StatusOK, code, "Application queries must never return non-200 status")
			if sc.wantContains != "" {
				respStr, ok := resp.(string)
				assert.True(t, ok, "Expected string response, got %T", resp)
				assert.Contains(t, respStr, sc.wantContains)
			}
		})
	}
}
