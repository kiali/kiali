package handlers_test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

type fakePromClient struct {
	prometheustest.PromClientMock
}

func (fpc *fakePromClient) GetConfiguration() (prom_v1.ConfigResult, error) {
	return prom_v1.ConfigResult{}, nil
}

func (fpc *fakePromClient) GetRuntimeinfo() (prom_v1.RuntimeinfoResult, error) {
	return prom_v1.RuntimeinfoResult{}, nil
}

func TestConfigHandler(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := &istiotest.FakeDiscovery{}

	prom := &fakePromClient{PromClientMock: prometheustest.PromClientMock{}}

	handler := handlers.WithFakeAuthInfo(conf, handlers.Config(conf, cache, discovery, cf, prom))
	mr := mux.NewRouter()
	mr.Handle("/api/config", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	url := ts.URL + "/api/config"

	resp, err := http.Get(url)
	require.NoError(err)

	actual, err := io.ReadAll(resp.Body)
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })

	require.NotEmpty(actual)
	require.Equal(200, resp.StatusCode, string(actual))

	var confResp handlers.PublicConfig
	require.NoError(json.Unmarshal(actual, &confResp))
}
