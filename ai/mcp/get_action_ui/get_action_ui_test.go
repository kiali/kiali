package get_action_ui

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
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

func TestActionRoutesMatchFrontend(t *testing.T) {
	routePatterns := loadFrontendRoutes(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient()
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	req := httptest.NewRequest("GET", "http://kiali/api/ai/mcp/get_action_ui", nil)

	testCases := []map[string]interface{}{
		{"resourceType": "overview"},
		{"resourceType": "graph", "graph": "mesh"},
		{"resourceType": "graph", "namespaces": "bookinfo"},
		{"resourceType": "workload", "namespaces": "bookinfo"},
		{"resourceType": "workload", "namespaces": "bookinfo", "resourceName": "details-v1", "tab": "logs"},
		{"resourceType": "istio", "namespaces": "istio-system"},
		{"resourceType": "service", "namespaces": "bookinfo", "resourceName": "productpage", "tab": "in_metrics"},
		{"resourceType": "app", "namespaces": "bookinfo", "resourceName": "ratings"},
	}

	for _, args := range testCases {
		res, status := Execute(req, args, businessLayer, conf)
		require.Equal(t, http.StatusOK, status)
		resp := res.(GetActionUIResponse)
		require.NotEmpty(t, resp.Actions)
		for _, action := range resp.Actions {
			assert.Truef(t, actionRouteMatches(action.Payload, routePatterns), "payload %q not found in frontend routes", action.Payload)
		}
	}
}

func loadFrontendRoutes(t *testing.T) []string {
	t.Helper()

	repoRoot := findRepoRoot(t)
	pathsFile := filepath.Join(repoRoot, "frontend", "src", "config", "Paths.ts")
	pathsContent, err := os.ReadFile(pathsFile)
	require.NoError(t, err)

	pathValues := map[string]string{}
	pathMatcher := regexp.MustCompile(`(?m)^\s*([A-Z_]+)\s*=\s*'([^']+)'`)
	for _, match := range pathMatcher.FindAllStringSubmatch(string(pathsContent), -1) {
		pathValues[match[1]] = match[2]
	}
	require.NotEmpty(t, pathValues)

	routesFile := filepath.Join(repoRoot, "frontend", "src", "routes.tsx")
	routesContent, err := os.ReadFile(routesFile)
	require.NoError(t, err)

	paths := []string{}
	matchPathLiteral := func(pattern string) {
		matcher := regexp.MustCompile(pattern)
		for _, match := range matcher.FindAllStringSubmatch(string(routesContent), -1) {
			path := strings.TrimSpace(match[1])
			path = replacePathsTemplate(t, path, pathValues)
			if path != "*" && path != "" {
				paths = append(paths, path)
			}
		}
	}
	matchPathLiteral("path:\\s*`([^`]*)`")
	matchPathLiteral("path:\\s*'([^']*)'")
	require.NotEmpty(t, paths)
	return paths
}

func findRepoRoot(t *testing.T) string {
	t.Helper()

	workingDir, err := os.Getwd()
	require.NoError(t, err)

	dir := workingDir
	for {
		candidate := filepath.Join(dir, "frontend", "src", "routes.tsx")
		if _, err := os.Stat(candidate); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	require.Fail(t, "unable to locate repo root with frontend/src/routes.tsx")
	return ""
}

func replacePathsTemplate(t *testing.T, path string, values map[string]string) string {
	t.Helper()

	templateMatcher := regexp.MustCompile(`\$\{Paths\.([A-Z_]+)\}`)
	return templateMatcher.ReplaceAllStringFunc(path, func(match string) string {
		submatches := templateMatcher.FindStringSubmatch(match)
		if len(submatches) != 2 {
			return match
		}
		value, ok := values[submatches[1]]
		require.Truef(t, ok, "missing Paths.%s in frontend config", submatches[1])
		return value
	})
}

func actionRouteMatches(payload string, routes []string) bool {
	path := payload
	if queryIndex := strings.Index(path, "?"); queryIndex != -1 {
		path = path[:queryIndex]
	}
	for _, route := range routes {
		if matchRoute(path, route) {
			return true
		}
	}
	return false
}

func matchRoute(path string, route string) bool {
	if route == path {
		return true
	}
	pathSegments := splitRoute(path)
	routeSegments := splitRoute(route)
	if len(pathSegments) != len(routeSegments) {
		return false
	}
	for i, segment := range routeSegments {
		if strings.HasPrefix(segment, ":") {
			if pathSegments[i] == "" {
				return false
			}
			continue
		}
		if segment != pathSegments[i] {
			return false
		}
	}
	return true
}

func splitRoute(path string) []string {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return []string{}
	}
	return strings.Split(trimmed, "/")
}
