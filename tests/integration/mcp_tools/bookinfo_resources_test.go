package mcp_tools

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const bookinfoNS = "bookinfo"

// Expected bookinfo resources present in CI
var (
	bookinfoApps      = []string{"details", "productpage", "ratings", "reviews"}
	bookinfoWorkloads = []string{"details-v1", "productpage-v1", "ratings-v1", "reviews-v1", "reviews-v2", "reviews-v3"}
	bookinfoServices  = []string{"details", "productpage", "ratings", "reviews"}
)

// --- Namespace counts consistency ---

func TestBookinfo_NamespaceCountsMatchResourceLists(t *testing.T) {
	// Get namespace detail to retrieve counts
	nsResp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "namespace",
		"resourceName": bookinfoNS,
	})
	require.NoError(t, err)
	require.Equal(t, 200, nsResp.StatusCode)

	counts, ok := nsResp.Parsed["counts"].(map[string]interface{})
	require.True(t, ok, "namespace detail should have 'counts'")

	expectedApps := int(counts["apps"].(float64))
	expectedServices := int(counts["services"].(float64))
	expectedWorkloads := int(counts["workloads"].(float64))

	t.Run("AppCountMatchesList", func(t *testing.T) {
		appResp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
			"resourceType": "app",
			"namespaces":   bookinfoNS,
		})
		require.NoError(t, err)
		require.Equal(t, 200, appResp.StatusCode)

		apps, ok := appResp.Parsed["applications"].([]interface{})
		require.True(t, ok, "app list should have 'applications' array")
		assert.Equal(t, expectedApps, len(apps),
			"namespace counts.apps (%d) should match app list length (%d)", expectedApps, len(apps))
	})

	t.Run("ServiceCountMatchesList", func(t *testing.T) {
		svcResp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
			"resourceType": "service",
			"namespaces":   bookinfoNS,
		})
		require.NoError(t, err)
		require.Equal(t, 200, svcResp.StatusCode)

		// Service list is keyed by cluster name
		var services []interface{}
		for _, v := range svcResp.Parsed {
			if arr, ok := v.([]interface{}); ok {
				services = arr
				break
			}
		}
		require.NotNil(t, services, "service list should contain a cluster array")
		assert.Equal(t, expectedServices, len(services),
			"namespace counts.services (%d) should match service list length (%d)", expectedServices, len(services))
	})

	t.Run("WorkloadCountMatchesList", func(t *testing.T) {
		wlResp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
			"resourceType": "workload",
			"namespaces":   bookinfoNS,
		})
		require.NoError(t, err)
		require.Equal(t, 200, wlResp.StatusCode)

		// Workload list is keyed by cluster name
		var workloads []interface{}
		for _, v := range wlResp.Parsed {
			if arr, ok := v.([]interface{}); ok {
				workloads = arr
				break
			}
		}
		require.NotNil(t, workloads, "workload list should contain a cluster array")
		assert.Equal(t, expectedWorkloads, len(workloads),
			"namespace counts.workloads (%d) should match workload list length (%d)", expectedWorkloads, len(workloads))
	})
}

// --- App detail ---

func TestBookinfo_AppDetail_Productpage(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "app",
		"namespaces":   bookinfoNS,
		"resourceName": "productpage",
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	assert.Equal(t, "productpage", resp.Parsed["app"])
	assert.Equal(t, bookinfoNS, resp.Parsed["namespace"])

	services, ok := resp.Parsed["services"].([]interface{})
	require.True(t, ok, "app detail should have 'services' array")
	assert.Contains(t, services, "productpage")

	workloads, ok := resp.Parsed["workloads"].([]interface{})
	require.True(t, ok, "app detail should have 'workloads' array")
	require.NotEmpty(t, workloads)
}

// --- Service detail ---

func TestBookinfo_ServiceDetail_Productpage(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "service",
		"namespaces":   bookinfoNS,
		"resourceName": "productpage",
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	svc, ok := resp.Parsed["service"].(map[string]interface{})
	require.True(t, ok, "service detail should have 'service' object")
	assert.Equal(t, "productpage", svc["name"])
	assert.Equal(t, bookinfoNS, svc["namespace"])

	istioConfig, ok := resp.Parsed["istio_config"].(map[string]interface{})
	require.True(t, ok, "service detail should have 'istio_config'")

	validations, ok := istioConfig["validations"].([]interface{})
	require.True(t, ok, "istio_config should have 'validations' array")

	valNames := make(map[string]bool)
	for _, v := range validations {
		if name, ok := v.(string); ok {
			valNames[name] = true
		}
	}

	expectedValidations := []string{"productpage-v1", "details-v1", "reviews-v1", "reviews-v2", "reviews-v3", "ratings-v1"}
	for _, name := range expectedValidations {
		assert.True(t, valNames[name],
			"service detail validations should contain %q", name)
	}
}

// --- Workload detail ---

func TestBookinfo_WorkloadDetail_DetailsV1(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "workload",
		"namespaces":   bookinfoNS,
		"resourceName": "details-v1",
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	wl, ok := resp.Parsed["workload"].(map[string]interface{})
	require.True(t, ok, "workload detail should have 'workload' object")
	assert.Equal(t, "details-v1", wl["name"])
	assert.Equal(t, bookinfoNS, wl["namespace"])
	assert.Equal(t, "Deployment", wl["kind"])

	assocServices, ok := resp.Parsed["associated_services"].([]interface{})
	require.True(t, ok, "workload detail should have 'associated_services'")
	assert.Contains(t, assocServices, "details")

	istio, ok := resp.Parsed["istio"].(map[string]interface{})
	require.True(t, ok, "workload detail should have 'istio'")
	assert.Equal(t, "Sidecar", istio["mode"])
}

// --- App list contains expected bookinfo apps ---

func TestBookinfo_AppListContainsExpectedApps(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "app",
		"namespaces":   bookinfoNS,
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	apps, ok := resp.Parsed["applications"].([]interface{})
	require.True(t, ok)

	names := make(map[string]bool)
	for _, item := range apps {
		app, ok := item.(map[string]interface{})
		require.True(t, ok)
		name, _ := app["name"].(string)
		names[name] = true
	}

	for _, expected := range bookinfoApps {
		assert.True(t, names[expected], "app list should contain %q", expected)
	}
}

// --- Service list contains expected bookinfo services ---

func TestBookinfo_ServiceListContainsExpectedServices(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "service",
		"namespaces":   bookinfoNS,
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	// Service list is keyed by cluster name
	var services []interface{}
	for _, v := range resp.Parsed {
		if arr, ok := v.([]interface{}); ok {
			services = arr
			break
		}
	}
	require.NotNil(t, services)

	names := make(map[string]bool)
	for _, item := range services {
		svc, ok := item.(map[string]interface{})
		require.True(t, ok)
		name, _ := svc["name"].(string)
		names[name] = true
	}

	for _, expected := range bookinfoServices {
		assert.True(t, names[expected], "service list should contain %q", expected)
	}
}

// --- Workload list contains expected bookinfo workloads ---

func TestBookinfo_WorkloadListContainsExpectedWorkloads(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "workload",
		"namespaces":   bookinfoNS,
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	var workloads []interface{}
	for _, v := range resp.Parsed {
		if arr, ok := v.([]interface{}); ok {
			workloads = arr
			break
		}
	}
	require.NotNil(t, workloads)

	names := make(map[string]bool)
	for _, item := range workloads {
		wl, ok := item.(map[string]interface{})
		require.True(t, ok)
		name, _ := wl["name"].(string)
		names[name] = true
	}

	for _, expected := range bookinfoWorkloads {
		assert.True(t, names[expected], "workload list should contain %q", expected)
	}
}

// --- Traffic graph contains bookinfo nodes ---

func TestBookinfo_TrafficGraphContainsExpectedNodes(t *testing.T) {
	resp, err := CallMCPTool("get_mesh_traffic_graph", map[string]interface{}{
		"namespaces": bookinfoNS,
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	nodes, ok := resp.Parsed["nodes"].([]interface{})
	require.True(t, ok, "graph should have 'nodes' array")

	names := make(map[string]bool)
	for _, item := range nodes {
		node, ok := item.(map[string]interface{})
		require.True(t, ok)
		name, _ := node["name"].(string)
		names[name] = true
	}

	expectedNodes := []string{"productpage", "details", "reviews", "ratings"}
	for _, expected := range expectedNodes {
		assert.True(t, names[expected], "traffic graph should contain node %q", expected)
	}

	traffic, ok := resp.Parsed["traffic"].([]interface{})
	require.True(t, ok, "graph should have 'traffic' array")
	assert.NotEmpty(t, traffic, "bookinfo should have traffic edges")
}

// --- Mesh status shows bookinfo namespace healthy ---

func TestBookinfo_MeshStatusShowsBookinfoHealthy(t *testing.T) {
	resp, err := CallMCPToolEmptyBody("get_mesh_status")
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	components, ok := resp.Parsed["components"].(map[string]interface{})
	require.True(t, ok)
	dataPlane, ok := components["data_plane"].(map[string]interface{})
	require.True(t, ok)
	monitored, ok := dataPlane["monitored_namespaces"].([]interface{})
	require.True(t, ok)

	found := false
	for _, item := range monitored {
		ns, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if ns["name"] == bookinfoNS {
			found = true
			health, _ := ns["health"].(string)
			assert.Equal(t, "HEALTHY", health,
				"bookinfo namespace should be HEALTHY in mesh status")
			break
		}
	}
	assert.True(t, found, "bookinfo should be in monitored_namespaces")
}

// --- Namespace detail has correct istio context ---

func TestBookinfo_NamespaceDetailIstioContext(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "namespace",
		"resourceName": bookinfoNS,
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	assert.Equal(t, bookinfoNS, resp.Parsed["namespace"])

	istioCtx, ok := resp.Parsed["istioContext"].(map[string]interface{})
	require.True(t, ok, "namespace detail should have 'istioContext'")
	assert.Equal(t, "enabled", istioCtx["injection"])
}

// --- Reviews app has multiple versions ---

func TestBookinfo_ReviewsAppHasMultipleVersions(t *testing.T) {
	resp, err := CallMCPTool("list_or_get_resources", map[string]interface{}{
		"resourceType": "app",
		"namespaces":   bookinfoNS,
		"resourceName": "reviews",
	})
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	assert.Equal(t, "reviews", resp.Parsed["app"])

	workloads, ok := resp.Parsed["workloads"].([]interface{})
	require.True(t, ok)
	assert.GreaterOrEqual(t, len(workloads), 3,
		"reviews app should have at least 3 workloads (v1, v2, v3)")
}
