package handlers

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/mux"
	osproject_v1 "github.com/openshift/api/project/v1"
	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func TestAppMetricsDefault(t *testing.T) {
	ts, api, k8s := setupAppMetricsEndpoint(t)
	cache := cache.NewTestingCache(t, k8s, *config.NewConfig())
	business.WithKialiCache(cache)

	url := ts.URL + "/api/namespaces/ns/apps/my_app/metrics"
	now := time.Now()
	delta := 15 * time.Second
	var gaugeSentinel uint32

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, prom_v1.Range{}, args[2])
		r := args[2].(prom_v1.Range)
		assert.Contains(t, query, "_canonical_service=\"my_app\"")
		assert.Contains(t, query, "_namespace=\"ns\"")
		assert.Contains(t, query, "[1m]")
		assert.NotContains(t, query, "histogram_quantile")
		atomic.AddUint32(&gaugeSentinel, 1)
		assert.Equal(t, 15*time.Second, r.Step)
		assert.WithinDuration(t, now, r.End, delta)
		assert.WithinDuration(t, now.Add(-30*time.Minute), r.Start, delta)
	})

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}

	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	assert.NotZero(t, gaugeSentinel)
}

func TestAppMetricsWithParams(t *testing.T) {
	ts, api, k8s := setupAppMetricsEndpoint(t)

	cache := cache.NewTestingCache(t, k8s, *config.NewConfig())
	business.WithKialiCache(cache)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/apps/my-app/metrics", nil)
	if err != nil {
		t.Fatal(err)
	}
	q := req.URL.Query()
	q.Add("rateInterval", "5h")
	q.Add("rateFunc", "rate")
	q.Add("step", "2")
	q.Add("queryTime", "1523364075")
	q.Add("duration", "1000")
	q.Add("byLabels[]", "response_code")
	q.Add("quantiles[]", "0.5")
	q.Add("quantiles[]", "0.95")
	q.Add("filters[]", "request_count")
	q.Add("filters[]", "request_size")
	req.URL.RawQuery = q.Encode()

	queryTime := time.Unix(1523364075, 0)
	delta := 2 * time.Second
	var histogramSentinel, gaugeSentinel uint32

	api.SpyArgumentsAndReturnEmpty(func(args mock.Arguments) {
		query := args[1].(string)
		assert.IsType(t, prom_v1.Range{}, args[2])
		r := args[2].(prom_v1.Range)
		assert.Contains(t, query, "rate(")
		assert.Contains(t, query, "[5h]")
		if strings.Contains(query, "histogram_quantile") {
			// Histogram specific queries
			assert.Contains(t, query, " by (le,response_code)")
			assert.Contains(t, query, "istio_request_bytes")
			atomic.AddUint32(&histogramSentinel, 1)
		} else {
			assert.Contains(t, query, " by (response_code)")
			atomic.AddUint32(&gaugeSentinel, 1)
		}
		assert.Equal(t, 2*time.Second, r.Step)
		assert.WithinDuration(t, queryTime, r.End, delta)
		assert.WithinDuration(t, queryTime.Add(-1000*time.Second), r.Start, delta)
	})

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	// Assert branch coverage
	assert.NotZero(t, histogramSentinel)
	assert.NotZero(t, gaugeSentinel)
}

type cacheNoPrivileges struct {
	cache.KialiCache
}

func (c *cacheNoPrivileges) GetNamespace(token string, namespace string, cluster string) (models.Namespace, bool) {
	return models.Namespace{}, false
}

type clientNoPrivileges struct {
	kubernetes.ClientInterface
}

func (c *clientNoPrivileges) GetNamespace(namespace string) (*core_v1.Namespace, error) {
	if namespace == "my_namespace" {
		return nil, errors.New("No privileges")
	}
	return c.ClientInterface.GetNamespace(namespace)
}

func TestAppMetricsInaccessibleNamespace(t *testing.T) {
	ts, _, k8s := setupAppMetricsEndpoint(t)
	cache := &cacheNoPrivileges{cache.NewTestingCache(t, k8s, *config.NewConfig())}
	business.WithKialiCache(cache)

	url := ts.URL + "/api/namespaces/my_namespace/apps/my_app/metrics"

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}

func setupAppMetricsEndpoint(t *testing.T) (*httptest.Server, *prometheustest.PromAPIMock, kubernetes.ClientInterface) {
	old := config.Get()
	t.Cleanup(func() {
		config.Set(old)
	})
	config.Set(config.NewConfig())
	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(xapi)
	k8s := &clientNoPrivileges{kubetest.NewFakeK8sClient(kubetest.FakeNamespace("ns"))}
	mr := mux.NewRouter()

	authInfo := map[string]*api.AuthInfo{config.Get().KubernetesConfig.ClusterName: {Token: "test"}}

	mr.HandleFunc("/api/namespaces/{namespace}/apps/{app}/metrics", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := authentication.SetAuthInfoContext(r.Context(), authInfo)
			getAppMetrics(w, r.WithContext(context), func() (*prometheus.Client, error) {
				return prom, nil
			})
		}))

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	business.SetupBusinessLayer(t, k8s, *config.Get())
	business.WithProm(prom)

	return ts, xapi, k8s
}

func setupAppListEndpoint(t *testing.T, k8s kubernetes.ClientInterface, conf config.Config) *httptest.Server {
	business.SetupBusinessLayer(t, k8s, conf)
	promMock := new(prometheustest.PromAPIMock)
	promMock.SpyArgumentsAndReturnEmpty(func(mock.Arguments) {})
	prom, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
	}
	prom.Inject(promMock)
	business.WithProm(prom)

	mr := mux.NewRouter()
	mr.HandleFunc("/api/clusters/apps", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := authentication.SetAuthInfoContext(r.Context(), map[string]*api.AuthInfo{config.Get().KubernetesConfig.ClusterName: {Token: "test"}})
			ClustersApps(w, r.WithContext(context))
		}))

	mr.HandleFunc("/api/namespaces/{namespace}/apps/{app}", http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			context := authentication.SetAuthInfoContext(r.Context(), map[string]*api.AuthInfo{config.Get().KubernetesConfig.ClusterName: {Token: "test"}})
			AppDetails(w, r.WithContext(context))
		}))

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts
}

func newProject() *osproject_v1.Project {
	return &osproject_v1.Project{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "ns",
		},
	}
}

func TestAppsEndpoint(t *testing.T) {
	assert := assert.New(t)

	cfg := config.NewConfig()
	cfg.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(cfg)

	mockClock()
	proj := newProject()
	proj.Name = "Namespace"
	kubeObjects := []runtime.Object{proj}
	for _, obj := range business.FakeDeployments(*cfg) {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts := setupAppListEndpoint(t, k8s, *cfg)

	url := ts.URL + "/api/clusters/apps"

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(actual)
	assert.Equal(200, resp.StatusCode, string(actual))
}

func TestAppDetailsEndpoint(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	// Disabling CustomDashboards on testing
	// otherwise this adds 10s to the test due to an http timeout.
	conf := config.NewConfig()
	conf.IstioLabels.AppLabelName = "app"
	conf.IstioLabels.VersionLabelName = "version"
	conf.ExternalServices.CustomDashboards.Enabled = false
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	kubernetes.SetConfig(t, *conf)

	mockClock()
	proj := newProject()
	proj.Name = "Namespace"
	kubeObjects := []runtime.Object{proj}
	for _, obj := range business.FakeDeployments(*conf) {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	for _, obj := range business.FakeServices() {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts := setupAppListEndpoint(t, k8s, *conf)

	url := ts.URL + "/api/namespaces/Namespace/apps/httpbin"

	resp, err := http.Get(url)
	require.NoError(err)

	actual, _ := io.ReadAll(resp.Body)

	require.NotEmpty(actual)
	assert.Equal(200, resp.StatusCode, string(actual))
}
