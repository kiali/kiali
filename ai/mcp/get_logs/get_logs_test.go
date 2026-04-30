package get_logs

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/util"
)

func init() {
	// get_logs uses util.Clock.Now() in ResolvePodFromWorkloadOrPod; avoid nil pointer in tests
	util.Clock = util.RealClock{}
	// Ensure log view feature is enabled for tests (default; explicit for clarity)
	conf := config.NewConfig()
	config.Set(conf)
}

// getLogsToolDef is a minimal struct for parsing get_logs.yaml without importing mcp (avoids import cycle).
type getLogsToolDef struct {
	Name        string                 `yaml:"name"`
	InputSchema map[string]interface{} `yaml:"input_schema"`
}

// TestSchemaVerification_GetLogsYAML ensures the get_logs tool schema matches the Kiali API signature.
// Required: namespace, name. Optional: workload, container, tail, severity, previous, clusterName, format.
// We read and parse the YAML directly to avoid importing mcp (which would create an import cycle).
func TestSchemaVerification_GetLogsYAML(t *testing.T) {
	path := filepath.Join("..", "tools", "get_logs.yaml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		path = filepath.Join("..", "..", "mcp", "tools", "get_logs.yaml")
	}
	contents, err := os.ReadFile(path)
	require.NoError(t, err)

	var list []getLogsToolDef
	err = yaml.Unmarshal(contents, &list)
	require.NoError(t, err)
	require.Len(t, list, 1)
	tool := list[0]
	require.Equal(t, "get_logs", tool.Name)

	schema, ok := tool.InputSchema["properties"].(map[string]interface{})
	require.True(t, ok, "input_schema.properties must be a map")

	required, ok := tool.InputSchema["required"].([]interface{})
	require.True(t, ok, "input_schema.required must be a slice")
	require.Len(t, required, 2)
	require.Contains(t, required, "namespace")
	require.Contains(t, required, "name")

	// API parameters (align with API_MCP_TOOLS_EXAMPLES.md and parseArgs)
	expectedProps := []string{"namespace", "name", "workload", "container", "tail", "severity", "previous", "clusterName", "format"}
	for _, key := range expectedProps {
		_, has := schema[key]
		assert.True(t, has, "schema must include property %q", key)
	}

	// format enum
	formatProp, ok := schema["format"].(map[string]interface{})
	require.True(t, ok)
	enum, ok := formatProp["enum"].([]interface{})
	require.True(t, ok)
	require.Len(t, enum, 2)
	require.Contains(t, enum, "codeblock")
	require.Contains(t, enum, "plain")
}

// TestExecute_MissingNamespace_ReturnsBadRequest validates schema: namespace is required.
func TestExecute_MissingNamespace_ReturnsBadRequest(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_logs", nil)
	args := map[string]interface{}{
		"name":        "my-pod",
		"clusterName": "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, Conf: conf}, args)
	require.Equal(t, http.StatusBadRequest, code)
	msg, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, msg, "namespace")
}

// TestExecute_MissingName_ReturnsBadRequest validates schema: name is required.
func TestExecute_MissingName_ReturnsBadRequest(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_logs", nil)
	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"clusterName": "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, Conf: conf}, args)
	require.Equal(t, http.StatusBadRequest, code)
	msg, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, msg, "name")
}

// TestExecute_ClusterNameRequired_ReturnsBadRequest when config has no cluster name.
func TestExecute_ClusterNameRequired_ReturnsBadRequest(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = ""
	config.Set(conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_logs", nil)
	args := map[string]interface{}{
		"namespace": "bookinfo",
		"name":      "my-pod",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, Conf: conf}, args)
	require.Equal(t, http.StatusBadRequest, code)
	msg, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, msg, "clusterName")
}

// TestExecute_InvalidTail_ReturnsBadRequest prevents panics: tail must be integer.
func TestExecute_InvalidTail_ReturnsBadRequest(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_logs", nil)
	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"name":        "my-pod",
		"clusterName": "Kubernetes",
		"tail":        "not-a-number",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, Conf: conf}, args)
	require.Equal(t, http.StatusBadRequest, code)
	msg, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, msg, "tail")
}

// TestExecute_EmptyArgs_NoPanic ensures nil or empty args do not cause panic; return 400.
func TestExecute_EmptyArgs_NoPanic(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_logs", nil)

	// Empty map
	args := map[string]interface{}{}
	res, code := Execute(&mcputil.KialiInterface{Request: req, Conf: conf}, args)
	require.Equal(t, http.StatusBadRequest, code)
	msg, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, msg, "missing argument")

	// Nil map would be passed as nil from handler; Execute uses args["key"] which is safe.
	args2 := map[string]interface{}(nil)
	res2, code2 := Execute(&mcputil.KialiInterface{Request: req, Conf: conf}, args2)
	require.Equal(t, http.StatusBadRequest, code2)
	msg, ok = res2.(string)
	require.True(t, ok)
	assert.Contains(t, msg, "missing argument")
}

// buildGetLogsBusinessLayer builds a business layer with a Prometheus mock so that
// GetWorkload's dashboard discovery (GetCustomDashboardRefs) does not panic on nil prom.
// k8s can be *kubetest.FakeK8sClient or a wrapper (e.g. fakeK8sWithEmptyLogs) implementing UserClientInterface.
func buildGetLogsBusinessLayer(t *testing.T, conf *config.Config, k8s kubernetes.UserClientInterface) *business.Layer {
	t.Helper()
	prom := new(prometheustest.PromClientMock)
	prom.MockMetricsForLabels(context.Background(), []string{})
	return business.NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build()
}

// fakeK8sWithEmptyLogs wraps FakeK8sClient and overrides StreamPodLogs to return empty content,
// so get_logs returns 200 with "has not logged any message yet" instead of 500 from the default fake.
type fakeK8sWithEmptyLogs struct {
	*kubetest.FakeK8sClient
}

func (c *fakeK8sWithEmptyLogs) StreamPodLogs(namespace, name string, opts *core_v1.PodLogOptions) (io.ReadCloser, error) {
	return io.NopCloser(strings.NewReader("")), nil
}

// sampleLogLines is the format expected by business layer parseLogLine: "TIMESTAMP MESSAGE" per line (RFC3339Nano).
const sampleLogLines = "2024-01-01T12:00:00.000000000Z INFO Starting application\n2024-01-01T12:00:01.000000000Z INFO Request received\n"

// fakeK8sWithSampleLogs wraps FakeK8sClient and overrides StreamPodLogs to return sample log lines,
// so get_logs returns 200 with actual log content.
type fakeK8sWithSampleLogs struct {
	*kubetest.FakeK8sClient
}

func (c *fakeK8sWithSampleLogs) StreamPodLogs(namespace, name string, opts *core_v1.PodLogOptions) (io.ReadCloser, error) {
	return io.NopCloser(strings.NewReader(sampleLogLines)), nil
}

// TestExecute_PodNotFound_ReturnsNotFound when pod does not exist (and workload resolution does not find it).
func TestExecute_PodNotFound_ReturnsNotFound(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
	)
	businessLayer := buildGetLogsBusinessLayer(t, conf, k8s)
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_logs", nil)
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: k8s.GetToken()}}
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))

	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"name":        "nonexistent-pod-xyz",
		"clusterName": "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf}, args)
	require.Equal(t, http.StatusNotFound, code)
	msg, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, msg, "nonexistent-pod-xyz")
	assert.Contains(t, msg, "bookinfo")
}

// fakePod returns a minimal core_v1.Pod with one app container for tests.
func fakePod(namespace, name, containerName string) *core_v1.Pod {
	return &core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels:    map[string]string{"app": "reviews", "version": "v1"},
		},
		Spec: core_v1.PodSpec{
			Containers: []core_v1.Container{
				{Name: containerName, Image: "example/reviews:latest"},
			},
		},
		Status: core_v1.PodStatus{Phase: core_v1.PodRunning},
	}
}

// TestExecute_ContainerNotFound_ReturnsBadRequest when requested container does not exist in pod.
func TestExecute_ContainerNotFound_ReturnsBadRequest(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("bookinfo", "reviews-v1-abc", "reviews")
	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		pod,
	)
	businessLayer := buildGetLogsBusinessLayer(t, conf, k8s)
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_logs", nil)
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: k8s.GetToken()}}
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))

	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"name":        "reviews-v1-abc",
		"container":   "nonexistent-container",
		"clusterName": "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf}, args)
	require.Equal(t, http.StatusBadRequest, code)
	msg, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, msg, "container")
	assert.Contains(t, msg, "nonexistent-container")
}

// TestExecute_ValidTailAliases ensures tail_lines / tailLines are accepted (parseTailArg back-compat) and returns 200.
func TestExecute_ValidTailAliases(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("bookinfo", "any-pod", "reviews")
	base := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		pod,
	)
	k8s := &fakeK8sWithEmptyLogs{FakeK8sClient: base}
	businessLayer := buildGetLogsBusinessLayer(t, conf, k8s)
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_logs", nil)
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: k8s.GetToken()}}
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))

	for _, key := range []string{"tail", "tail_lines", "tailLines"} {
		args := map[string]interface{}{
			"namespace":   "bookinfo",
			"name":        "any-pod",
			"clusterName": "Kubernetes",
			key:           10,
		}
		res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf}, args)
		require.Equal(t, http.StatusOK, code, "get_logs with tail alias %q must return 200", key)
		msg, ok := res.(string)
		require.True(t, ok)
		assert.Contains(t, msg, "any-pod")
	}
}

// TestExecute_TailCappedAt200 ensures tail over 200 is capped (no unbounded fetch) and returns 200 with logs.
func TestExecute_TailCappedAt200(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	pod := fakePod("bookinfo", "my-pod", "reviews")
	base := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		pod,
	)
	k8s := &fakeK8sWithSampleLogs{FakeK8sClient: base}
	businessLayer := buildGetLogsBusinessLayer(t, conf, k8s)
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_logs", nil)
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: k8s.GetToken()}}
	req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))

	args := map[string]interface{}{
		"namespace":   "bookinfo",
		"name":        "my-pod",
		"clusterName": "Kubernetes",
		"tail":        9999,
	}
	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf}, args)
	require.Equal(t, http.StatusOK, code, "tail 9999 should be capped and return 200")
	msg, ok := res.(string)
	require.True(t, ok, "response must be a string (log output)")
	assert.Contains(t, msg, "Starting application", "response must contain log content")
	assert.Contains(t, msg, "Request received", "response must contain log content")
	assert.Contains(t, msg, "~~~", "response must wrap logs in codeblock")
}
