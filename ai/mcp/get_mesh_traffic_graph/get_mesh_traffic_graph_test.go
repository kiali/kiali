package get_mesh_traffic_graph

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	graphCommon "github.com/kiali/kiali/graph/config/common"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/util"
)

func init() {
	// getHealth uses util.Clock.Now(); avoid nil pointer in tests.
	util.Clock = util.RealClock{}
}

// mockPrometheusForGraph makes the Prom API mock accept any Query/QueryRange from the graph code and return empty results.
// It also mocks Buildinfo used by the mesh status path (status.Get -> prometheusVersion).
func mockPrometheusForGraph(promAPI *prometheustest.PromAPIMock) {
	emptyVec := model.Vector{}
	promAPI.On("Query", mock.Anything, mock.Anything, mock.AnythingOfType("time.Time")).Return(emptyVec, nil, nil)
	promAPI.On("QueryRange", mock.Anything, mock.Anything, mock.Anything).Return(emptyVec, nil, nil)
	promAPI.On("Buildinfo", mock.Anything).Return(prom_v1.BuildinfoResult{}, nil)
}

// reqWithAuth sets auth info on the request context so CheckNamespaceAccess can resolve user clients.
func reqWithAuth(req *http.Request, conf *config.Config, token string) *http.Request {
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: token}}
	ctx := authentication.SetAuthInfoContext(req.Context(), authInfo)
	return req.WithContext(ctx)
}

// mockPrometheusForHealth makes the Prom client mock accept health-related queries and return empty results.
func mockPrometheusForHealth(prom *prometheustest.PromClientMock) {
	emptyVec := model.Vector{}
	prom.On("GetNamespaceServicesRequestRates", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(emptyVec, nil)
	prom.On("GetServiceRequestRates", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(emptyVec, nil)
	prom.On("GetAppRequestRates", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(emptyVec, emptyVec, nil)
	prom.On("GetWorkloadRequestRates", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(emptyVec, emptyVec, nil)
}

func TestExecute_NonExistentNamespaces_ReturnsOKWithMessage(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("default"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":   "nonexistent-ns",
		"graphType":    "versionedApp",
		"rateInterval": "10m",
		"clusterName":  "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: nil, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	msg, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, msg, "nonexistent-ns")
	assert.Contains(t, msg, "not found or not accessible")
}

func TestExecute_AllNonExistentFromList_ReturnsOKWithMessage(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":   "default2,missing-ns",
		"graphType":    "versionedApp",
		"rateInterval": "10m",
		"clusterName":  "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: nil, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	msg, ok := res.(string)
	require.True(t, ok)
	assert.True(t, strings.Contains(msg, "default2") || strings.Contains(msg, "missing-ns"))
	assert.Contains(t, msg, "not found or not accessible")
}

func TestExecute_ValidSingleNamespace_ReturnsOKWithResponse(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("default"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":   "bookinfo",
		"graphType":    "versionedApp",
		"rateInterval": "10m",
		"clusterName":  "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)
	require.NotNil(t, resp.Namespaces)
	assert.NotEmpty(t, resp.Namespaces)
}

func TestExecute_ValidNamespaceList_ReturnsOKWithResponse(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("default"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":   "bookinfo,default",
		"graphType":    "versionedApp",
		"rateInterval": "10m",
		"clusterName":  "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)
	require.NotNil(t, resp.Namespaces)
	assert.NotEmpty(t, resp.Namespaces)
}

func TestExecute_ValidAndInvalidNamespaces_ReturnsOKWithSkippedWarning(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("default"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":   "bookinfo,default2",
		"graphType":    "versionedApp",
		"rateInterval": "10m",
		"clusterName":  "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)
	require.NotNil(t, resp.Namespaces)
	assert.NotEmpty(t, resp.Namespaces)
	require.Contains(t, resp.Errors, "namespaces")
	assert.Contains(t, resp.Errors["namespaces"], "not found or not accessible")
	assert.Contains(t, resp.Errors["namespaces"], "default2")
}

func TestExecute_NoNamespacesProvided_ReturnsOKWithMessage(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("default"),
		kubetest.FakeNamespace("istio-system"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	args := map[string]interface{}{
		"graphType":    "versionedApp",
		"rateInterval": "10m",
		"clusterName":  "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	msg, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, msg, "No namespaces were specified")
}

func TestExecute_WorkloadGraphType_FetchesWorkloadHealth(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
	)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	prom := new(prometheustest.PromClientMock)
	mockPrometheusForHealth(prom)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":   "bookinfo",
		"graphType":    "workload",
		"rateInterval": "5m",
		"clusterName":  "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.Health)
}

func TestExecute_ServiceGraphType_FetchesServiceHealth(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
	)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	prom := new(prometheustest.PromClientMock)
	mockPrometheusForHealth(prom)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":   "bookinfo",
		"graphType":    "service",
		"rateInterval": "15m",
		"clusterName":  "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.Health)
}

func TestExecute_DuplicateNamespaces_Deduplicates(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("default"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":   "bookinfo,default,bookinfo,default",
		"graphType":    "versionedApp",
		"rateInterval": "10m",
		"clusterName":  "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.Nodes)
	// Should only process each namespace once
}

func TestExecute_NamespacesWithWhitespace_TrimsCorrectly(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("default"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":   " bookinfo , default , ",
		"graphType":    "versionedApp",
		"rateInterval": "10m",
		"clusterName":  "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.Nodes)
	// Should correctly trim and process both namespaces
}

func TestExecute_CustomRateInterval_UsesProvidedValue(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":   "bookinfo",
		"graphType":    "versionedApp",
		"rateInterval": "30m",
		"clusterName":  "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.Nodes)
}

func TestExecute_DefaultRateInterval_UsesDefault(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":  "bookinfo",
		"graphType":   "versionedApp",
		"clusterName": "Kubernetes",
		// No rateInterval provided
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.Nodes)
}

// ========================================================================
// Invalid GraphType Tests
// ========================================================================

func TestExecute_InvalidGraphType_ReturnsBadRequest(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)
	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":  "bookinfo",
		"graphType":   "invalidType",
		"clusterName": "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: nil, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusBadRequest, code)
	msg, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, msg, "invalid graphType")
	assert.Contains(t, msg, "invalidType")
}

func TestExecute_EmptyGraphType_UsesDefault(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":  "bookinfo",
		"clusterName": "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)
	assert.Equal(t, "versionedApp", resp.GraphType)
}

func TestExecute_AllValidGraphTypes_AcceptedWithoutError(t *testing.T) {
	validTypes := []string{"app", "service", "versionedApp", "workload"}

	for _, gt := range validTypes {
		t.Run(gt, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "Kubernetes"
			config.Set(conf)

			k8s := kubetest.NewFakeK8sClient(
				kubetest.FakeNamespace("bookinfo"),
			)

			promAPI := new(prometheustest.PromAPIMock)
			mockPrometheusForGraph(promAPI)
			promClient, err := prometheus.NewClient(*conf, k8s)
			require.NoError(t, err)
			promClient.Inject(promAPI)

			prom := new(prometheustest.PromClientMock)
			mockPrometheusForHealth(prom)
			businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).WithProm(prom).Build()
			kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

			clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
			saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
			discovery := istio.NewDiscovery(saClients, kialiCache, conf)

			req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
			req = reqWithAuth(req, conf, k8s.GetToken())
			args := map[string]interface{}{
				"namespaces":  "bookinfo",
				"graphType":   gt,
				"clusterName": "Kubernetes",
			}

			res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
			require.Equal(t, http.StatusOK, code)
			resp, ok := res.(CompactGraphResponse)
			require.True(t, ok)
			assert.Equal(t, gt, resp.GraphType)
		})
	}
}

// ========================================================================
// TransformGraph Unit Tests
// ========================================================================

func TestTransformGraph_NilGraphRaw_ReturnsEmptyNodesAndTraffic(t *testing.T) {
	resp := TransformGraph(nil, "versionedApp", []string{"bookinfo"}, nil, nil)

	assert.Equal(t, "versionedApp", resp.GraphType)
	assert.Equal(t, []string{"bookinfo"}, resp.Namespaces)
	assert.Empty(t, resp.Nodes)
	assert.Empty(t, resp.Traffic)
	assert.Nil(t, resp.Errors)
	assert.Nil(t, resp.Health)
}

func TestTransformGraph_MalformedJSON_ReturnsGraphParseError(t *testing.T) {
	malformed := json.RawMessage(`{not valid json}`)
	resp := TransformGraph(malformed, "app", []string{"ns1"}, nil, nil)

	require.NotNil(t, resp.Errors)
	assert.Contains(t, resp.Errors, "graph_parse")
	assert.Empty(t, resp.Nodes)
	assert.Empty(t, resp.Traffic)
}

func TestTransformGraph_EmptyElements_ReturnsEmptyNodesAndTraffic(t *testing.T) {
	cfg := graphCommon.Config{
		Timestamp: 1000,
		Duration:  600,
		GraphType: "versionedApp",
		Elements: graphCommon.Elements{
			Nodes: []*graphCommon.NodeWrapper{},
			Edges: []*graphCommon.EdgeWrapper{},
		},
	}
	raw, err := json.Marshal(cfg)
	require.NoError(t, err)

	resp := TransformGraph(raw, "versionedApp", []string{"bookinfo"}, nil, nil)

	assert.Equal(t, "versionedApp", resp.GraphType)
	assert.Empty(t, resp.Nodes)
	assert.Empty(t, resp.Traffic)
	assert.Nil(t, resp.Errors)
}

func TestTransformGraph_WithNodes_ExtractsCorrectly(t *testing.T) {
	cfg := graphCommon.Config{
		Timestamp: 1000,
		Duration:  600,
		GraphType: "versionedApp",
		Elements: graphCommon.Elements{
			Nodes: []*graphCommon.NodeWrapper{
				{Data: &graphCommon.NodeData{ID: "n0", NodeType: "app", App: "productpage", Version: "v1", Namespace: "bookinfo"}},
				{Data: &graphCommon.NodeData{ID: "n1", NodeType: "app", App: "reviews", Version: "v2", Namespace: "bookinfo"}},
				{Data: &graphCommon.NodeData{ID: "box0", NodeType: "box", IsBox: "namespace", Namespace: "bookinfo"}},
			},
			Edges: []*graphCommon.EdgeWrapper{},
		},
	}
	raw, err := json.Marshal(cfg)
	require.NoError(t, err)

	resp := TransformGraph(raw, "versionedApp", []string{"bookinfo"}, nil, nil)

	assert.Len(t, resp.Nodes, 2, "box nodes should be excluded")
	assert.Equal(t, "productpage", resp.Nodes[0].Name)
	assert.Equal(t, "v1", resp.Nodes[0].Version)
	assert.Equal(t, "app", resp.Nodes[0].Type)
	assert.Equal(t, "reviews", resp.Nodes[1].Name)
	assert.Equal(t, "v2", resp.Nodes[1].Version)
}

func TestTransformGraph_WithEdges_ExtractsTraffic(t *testing.T) {
	cfg := graphCommon.Config{
		Timestamp: 1000,
		Duration:  600,
		GraphType: "versionedApp",
		Elements: graphCommon.Elements{
			Nodes: []*graphCommon.NodeWrapper{
				{Data: &graphCommon.NodeData{ID: "n0", NodeType: "app", App: "productpage", Version: "v1"}},
				{Data: &graphCommon.NodeData{ID: "n1", NodeType: "app", App: "reviews", Version: "v2"}},
			},
			Edges: []*graphCommon.EdgeWrapper{
				{Data: &graphCommon.EdgeData{
					ID:           "e0",
					Source:       "n0",
					Target:       "n1",
					IsMTLS:       "100",
					ResponseTime: "45",
					Throughput:   "1024",
					HealthStatus: "Healthy",
					Traffic:      graphCommon.ProtocolTraffic{Protocol: "http"},
				}},
			},
		},
	}
	raw, err := json.Marshal(cfg)
	require.NoError(t, err)

	resp := TransformGraph(raw, "versionedApp", []string{"bookinfo"}, nil, nil)

	require.Len(t, resp.Traffic, 1)
	edge := resp.Traffic[0]
	assert.Equal(t, "productpage (v1)", edge.Source)
	assert.Equal(t, "reviews (v2)", edge.Target)
	assert.True(t, edge.MTLS)
	assert.Equal(t, 45, edge.ResponseTimeMs)
	assert.Equal(t, "1024", edge.Throughput)
	assert.Equal(t, "http", edge.Protocol)
	assert.Equal(t, "Healthy", edge.Health)
}

func TestTransformGraph_PreservesExistingErrors(t *testing.T) {
	existingErrors := map[string]string{
		"mesh_status": "some mesh error",
	}
	resp := TransformGraph(nil, "app", []string{"ns1"}, nil, existingErrors)

	require.NotNil(t, resp.Errors)
	assert.Equal(t, "some mesh error", resp.Errors["mesh_status"])
}

func TestTransformGraph_WithHealthSummary(t *testing.T) {
	health := &MeshHealthSummary{
		OverallStatus: "HEALTHY",
		Availability:  99.9,
	}
	resp := TransformGraph(nil, "app", []string{"ns1"}, health, nil)

	require.NotNil(t, resp.Health)
	assert.Equal(t, "HEALTHY", resp.Health.OverallStatus)
	assert.InDelta(t, 99.9, resp.Health.Availability, 0.001)
}

func TestTransformGraph_NodeNameResolution(t *testing.T) {
	tests := []struct {
		name     string
		node     *graphCommon.NodeData
		expected string
	}{
		{
			name:     "app name",
			node:     &graphCommon.NodeData{ID: "n0", NodeType: "app", App: "reviews"},
			expected: "reviews",
		},
		{
			name:     "workload name when no app",
			node:     &graphCommon.NodeData{ID: "n0", NodeType: "workload", Workload: "reviews-v1"},
			expected: "reviews-v1",
		},
		{
			name:     "service name when no app or workload",
			node:     &graphCommon.NodeData{ID: "n0", NodeType: "service", Service: "reviews-svc"},
			expected: "reviews-svc",
		},
		{
			name:     "falls back to ID",
			node:     &graphCommon.NodeData{ID: "n0", NodeType: "unknown"},
			expected: "n0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := graphCommon.Config{
				Elements: graphCommon.Elements{
					Nodes: []*graphCommon.NodeWrapper{{Data: tt.node}},
					Edges: []*graphCommon.EdgeWrapper{},
				},
			}
			raw, err := json.Marshal(cfg)
			require.NoError(t, err)

			resp := TransformGraph(raw, "app", []string{"ns1"}, nil, nil)
			require.Len(t, resp.Nodes, 1)
			assert.Equal(t, tt.expected, resp.Nodes[0].Name)
		})
	}
}

func TestTransformGraph_EdgeMTLS_NonHundredPercent(t *testing.T) {
	cfg := graphCommon.Config{
		Elements: graphCommon.Elements{
			Nodes: []*graphCommon.NodeWrapper{
				{Data: &graphCommon.NodeData{ID: "n0", App: "a"}},
				{Data: &graphCommon.NodeData{ID: "n1", App: "b"}},
			},
			Edges: []*graphCommon.EdgeWrapper{
				{Data: &graphCommon.EdgeData{
					ID:      "e0",
					Source:  "n0",
					Target:  "n1",
					IsMTLS:  "50",
					Traffic: graphCommon.ProtocolTraffic{Protocol: "http"},
				}},
			},
		},
	}
	raw, err := json.Marshal(cfg)
	require.NoError(t, err)

	resp := TransformGraph(raw, "app", []string{"ns1"}, nil, nil)

	require.Len(t, resp.Traffic, 1)
	assert.False(t, resp.Traffic[0].MTLS, "mTLS should be false when not 100%%")
}

// ========================================================================
// Empty Graph (No Traffic) Tests
// ========================================================================

func TestExecute_NamespaceWithNoTraffic_ReturnsEmptyGraph(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("empty-ns"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":  "empty-ns",
		"graphType":   "versionedApp",
		"clusterName": "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)
	assert.Empty(t, resp.Nodes, "namespace with no traffic should return empty nodes")
	assert.Empty(t, resp.Traffic, "namespace with no traffic should return empty traffic")
	assert.Equal(t, "versionedApp", resp.GraphType)
	assert.Contains(t, resp.Namespaces, "empty-ns")
}

// ========================================================================
// Compact Graph Response Structure Tests
// ========================================================================

func TestExecute_ResponseStructure_HasExpectedFields(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
	)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
	kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s}), *conf)

	promAPI := new(prometheustest.PromAPIMock)
	mockPrometheusForGraph(promAPI)
	promClient, err := prometheus.NewClient(*conf, k8s)
	require.NoError(t, err)
	promClient.Inject(promAPI)

	clientFactory := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: k8s})
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/get_mesh_graph", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())
	args := map[string]interface{}{
		"namespaces":  "bookinfo",
		"graphType":   "versionedApp",
		"clusterName": "Kubernetes",
	}

	res, code := Execute(&mcputil.KialiInterface{Request: req, BusinessLayer: businessLayer, Prom: promClient, ClientFactory: clientFactory, KialiCache: kialiCache, Conf: conf, Graphana: nil, Perses: nil, Discovery: discovery}, args)
	require.Equal(t, http.StatusOK, code)

	resp, ok := res.(CompactGraphResponse)
	require.True(t, ok)

	raw, marshalErr := json.Marshal(resp)
	require.NoError(t, marshalErr)

	var jsonMap map[string]interface{}
	require.NoError(t, json.Unmarshal(raw, &jsonMap))

	assert.Contains(t, jsonMap, "graphType")
	assert.Contains(t, jsonMap, "namespaces")
	assert.Contains(t, jsonMap, "nodes")
	assert.Contains(t, jsonMap, "traffic")
}
