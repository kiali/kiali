package handlers_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func TestNamespaceInfo(t *testing.T) {
	conf := config.NewConfig()
	_, _, k8s := setupMocked(t)

	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.Clients, cache, conf)

	handler := handlers.WithFakeAuthInfo(conf, handlers.NamespaceInfo(conf, cache, cf, discovery))

	mr := mux.NewRouter()
	mr.HandleFunc("/api/namespaces/{namespace}/info", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	req, err := http.NewRequest("GET", ts.URL+"/api/namespaces/ns/info", nil)
	if err != nil {
		t.Fatal(err)
	}

	httpclient := &http.Client{}
	resp, err := httpclient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
}

func setupMocked(t *testing.T) (*prometheus.Client, *prometheustest.PromAPIMock, *kubetest.FakeK8sClient) {
	t.Helper()

	k := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("tutorial"),
		kubetest.FakeNamespace("ns"),
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo"}},
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "tutorial"}},
		&osproject_v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "ns"}},
	)
	k.OpenShift = true

	api := new(prometheustest.PromAPIMock)
	client, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
		return nil, nil, nil
	}
	client.Inject(api)

	return client, api, k
}
