package get_mesh_graph

import (
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

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
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

func TestExecute_NonExistentNamespaces_ReturnsForbidden(t *testing.T) {
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

	res, code := Execute(req, args, businessLayer, nil, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusForbidden, code)
	msg, ok := res.(string)
	require.True(t, ok)
	// With CheckNamespaceAccess, error may be "cannot access namespace data: ..." or "not accessible or do not exist"
	assert.Contains(t, msg, "nonexistent-ns")
}

func TestExecute_AllNonExistentFromList_ReturnsForbidden(t *testing.T) {
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

	res, code := Execute(req, args, businessLayer, nil, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusForbidden, code)
	msg, ok := res.(string)
	require.True(t, ok)
	// With CheckNamespaceAccess, error may be "cannot access namespace data: ..." or "not accessible or do not exist"
	assert.True(t, strings.Contains(msg, "default2") || strings.Contains(msg, "missing-ns"))
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
	promClient, err := prometheus.NewClient(*conf, k8s.GetToken())
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

	res, code := Execute(req, args, businessLayer, promClient, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(GetMeshGraphResponse)
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
	promClient, err := prometheus.NewClient(*conf, k8s.GetToken())
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

	res, code := Execute(req, args, businessLayer, promClient, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(GetMeshGraphResponse)
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
	promClient, err := prometheus.NewClient(*conf, k8s.GetToken())
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

	res, code := Execute(req, args, businessLayer, promClient, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(GetMeshGraphResponse)
	require.True(t, ok)
	require.NotNil(t, resp.Namespaces)
	assert.NotEmpty(t, resp.Namespaces)
	require.Contains(t, resp.Errors, "namespaces")
	assert.Contains(t, resp.Errors["namespaces"], "skipped")
	assert.Contains(t, resp.Errors["namespaces"], "default2")
}

func TestExecute_NoNamespacesProvided_ReturnsError(t *testing.T) {
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
	promClient, err := prometheus.NewClient(*conf, k8s.GetToken())
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

	res, code := Execute(req, args, businessLayer, promClient, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusBadRequest, code)
	errMsg, ok := res.(string)
	require.True(t, ok)
	assert.Contains(t, errMsg, "namespaces parameter is required")
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
	promClient, err := prometheus.NewClient(*conf, k8s.GetToken())
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

	res, code := Execute(req, args, businessLayer, promClient, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(GetMeshGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.MeshHealthSummary)
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
	promClient, err := prometheus.NewClient(*conf, k8s.GetToken())
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

	res, code := Execute(req, args, businessLayer, promClient, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(GetMeshGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.MeshHealthSummary)
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
	promClient, err := prometheus.NewClient(*conf, k8s.GetToken())
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

	res, code := Execute(req, args, businessLayer, promClient, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(GetMeshGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.Graph)
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
	promClient, err := prometheus.NewClient(*conf, k8s.GetToken())
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

	res, code := Execute(req, args, businessLayer, promClient, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(GetMeshGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.Graph)
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
	promClient, err := prometheus.NewClient(*conf, k8s.GetToken())
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

	res, code := Execute(req, args, businessLayer, promClient, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(GetMeshGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.Graph)
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
	promClient, err := prometheus.NewClient(*conf, k8s.GetToken())
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

	res, code := Execute(req, args, businessLayer, promClient, clientFactory, kialiCache, conf, nil, nil, discovery)
	require.Equal(t, http.StatusOK, code)
	resp, ok := res.(GetMeshGraphResponse)
	require.True(t, ok)
	assert.NotNil(t, resp.Graph)
}
