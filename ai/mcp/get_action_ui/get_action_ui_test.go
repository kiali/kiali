package get_action_ui

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestExecute(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient()
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()

	t.Run("Overview Action", func(t *testing.T) {
		args := map[string]interface{}{
			"resourceType": "overview",
		}
		req := httptest.NewRequest("GET", "http://kiali/api/ai/mcp/get_action_ui", nil)
		res, status := Execute(req, args, businessLayer, conf)
		assert.Equal(t, http.StatusOK, status)
		resp := res.(GetActionUIResponse)
		require.Len(t, resp.Actions, 1)
		assert.Equal(t, "View Overview", resp.Actions[0].Title)
		assert.Equal(t, "/overview", resp.Actions[0].Payload)
	})

	t.Run("Graph Action - Mesh", func(t *testing.T) {
		args := map[string]interface{}{
			"resourceType": "graph",
			"graph":        "mesh",
		}
		req := httptest.NewRequest("GET", "http://kiali/api/ai/mcp/get_action_ui", nil)
		res, status := Execute(req, args, businessLayer, conf)
		assert.Equal(t, http.StatusOK, status)
		resp := res.(GetActionUIResponse)
		require.Len(t, resp.Actions, 1)
		assert.Equal(t, "View Mesh Graph", resp.Actions[0].Title)
		assert.Equal(t, "/mesh", resp.Actions[0].Payload)
	})

	t.Run("Graph Action - Namespace", func(t *testing.T) {
		args := map[string]interface{}{
			"resourceType": "graph",
			"namespaces":   "bookinfo",
		}
		req := httptest.NewRequest("GET", "http://kiali/api/ai/mcp/get_action_ui", nil)
		res, status := Execute(req, args, businessLayer, conf)
		assert.Equal(t, http.StatusOK, status)
		resp := res.(GetActionUIResponse)
		require.Len(t, resp.Actions, 1)
		assert.Contains(t, resp.Actions[0].Title, "View Traffic Graph for :bookinfo")
		assert.Contains(t, resp.Actions[0].Payload, "/graph/namespaces?namespaces=bookinfo")
	})

	t.Run("Workload List Action", func(t *testing.T) {
		args := map[string]interface{}{
			"resourceType": "workload",
			"namespaces":   "bookinfo",
		}
		req := httptest.NewRequest("GET", "http://kiali/api/ai/mcp/get_action_ui", nil)
		res, status := Execute(req, args, businessLayer, conf)
		assert.Equal(t, http.StatusOK, status)
		resp := res.(GetActionUIResponse)
		require.Len(t, resp.Actions, 1)
		assert.Equal(t, "View workloads List", resp.Actions[0].Title)
		assert.Equal(t, "/workloads?namespaces=bookinfo", resp.Actions[0].Payload)
	})

	t.Run("Workload Details Action", func(t *testing.T) {
		args := map[string]interface{}{
			"resourceType": "workload",
			"namespaces":   "bookinfo",
			"resourceName": "details-v1",
			"tab":          "logs",
		}
		req := httptest.NewRequest("GET", "http://kiali/api/ai/mcp/get_action_ui", nil)
		res, status := Execute(req, args, businessLayer, conf)
		assert.Equal(t, http.StatusOK, status)
		resp := res.(GetActionUIResponse)
		require.Len(t, resp.Actions, 1)
		assert.Equal(t, "View workload Details", resp.Actions[0].Title)
		assert.Equal(t, "/namespaces/bookinfo/workloads/details-v1?tab=logs", resp.Actions[0].Payload)
	})

	t.Run("Istio List Action", func(t *testing.T) {
		args := map[string]interface{}{
			"resourceType": "istio",
			"namespaces":   "istio-system",
		}
		req := httptest.NewRequest("GET", "http://kiali/api/ai/mcp/get_action_ui", nil)
		res, status := Execute(req, args, businessLayer, conf)
		assert.Equal(t, http.StatusOK, status)
		resp := res.(GetActionUIResponse)
		require.Len(t, resp.Actions, 1)
		assert.Equal(t, "View Istio List of Configs", resp.Actions[0].Title)
		assert.Equal(t, "/istio?namespaces=istio-system", resp.Actions[0].Payload)
	})

	t.Run("Service Details Action with metric tab", func(t *testing.T) {
		args := map[string]interface{}{
			"resourceType": "service",
			"namespaces":   "bookinfo",
			"resourceName": "productpage",
			"tab":          "in_metrics",
		}
		req := httptest.NewRequest("GET", "http://kiali/api/ai/mcp/get_action_ui", nil)
		res, status := Execute(req, args, businessLayer, conf)
		assert.Equal(t, http.StatusOK, status)
		resp := res.(GetActionUIResponse)
		require.Len(t, resp.Actions, 1)
		assert.Equal(t, "View service Details", resp.Actions[0].Title)
		assert.Equal(t, "/namespaces/bookinfo/services/productpage?tab=metrics", resp.Actions[0].Payload)
	})

	t.Run("All Namespaces Action", func(t *testing.T) {
		args := map[string]interface{}{
			"resourceType": "workload",
			"namespaces":   "all",
		}
		req := httptest.NewRequest("GET", "http://kiali/api/ai/mcp/get_action_ui", nil)
		res, status := Execute(req, args, businessLayer, conf)
		assert.Equal(t, http.StatusOK, status)
		resp := res.(GetActionUIResponse)
		require.Len(t, resp.Actions, 1)
		assert.Equal(t, "View workloads List", resp.Actions[0].Title)
		assert.Equal(t, "/workloads", resp.Actions[0].Payload)
	})
}

func TestGetTabLabel(t *testing.T) {
	assert.Equal(t, "info", getTabLabel("", "workload"))
	assert.Equal(t, "logs", getTabLabel("logs", "workload"))
	assert.Equal(t, "metrics", getTabLabel("in_metrics", "service"))
	assert.Equal(t, "metrics", getTabLabel("out_metrics", "service"))
	assert.Equal(t, "info", getTabLabel("invalid", "service"))
}
