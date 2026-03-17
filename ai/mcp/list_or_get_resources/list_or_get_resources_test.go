package list_or_get_resources

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func setupMocks(t *testing.T) *mcputil.KialiInterface {
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

func TestExecute_InvalidNamespace(t *testing.T) {
	require := require.New(t)
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "app",
		"namespaces":    "non-existent-namespace",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusOK, code)

	respMap, ok := resp.(map[string]interface{})
	require.True(ok, "Expected response to be a map")

	errorsMap, ok := respMap["errors"].(map[string]string)
	require.True(ok, "Expected 'errors' to be a map[string]string")
	assert.Contains(t, errorsMap["namespaces"], "requested namespace(s) not accessible or do not exist (skipped): non-existent-namespace")
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

		assert.NotEqual(t, http.StatusBadRequest, code)
	})
}

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

		assert.Equal(t, http.StatusOK, code)
		respMap, ok := resp.(map[string]interface{})
		if ok {
			assert.Contains(t, respMap, "errors")
		}
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

func TestExecute_AllInvalidNamespacesReturnsEmptyWithErrors(t *testing.T) {
	util.Clock = util.RealClock{}
	ki := setupMocks(t)

	args := map[string]interface{}{
		"resource_type": "service",
		"namespaces":    "invalid1,invalid2",
	}

	resp, code := Execute(ki, args)

	assert.Equal(t, http.StatusOK, code)
	respMap, ok := resp.(map[string]interface{})
	assert.True(t, ok)
	errorsMap, ok := respMap["errors"].(map[string]string)
	assert.True(t, ok)
	assert.Contains(t, errorsMap["namespaces"], "invalid1")
	assert.Contains(t, errorsMap["namespaces"], "invalid2")
}
