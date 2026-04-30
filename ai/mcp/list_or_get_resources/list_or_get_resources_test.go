package list_or_get_resources

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
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

	validTypes := []string{"service", "workload", "app"}

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
