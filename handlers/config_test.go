package handlers_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/require"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

type fakePromClient struct {
	prometheustest.PromClientMock
}

func (fpc *fakePromClient) GetConfiguration(ctx context.Context) (prom_v1.ConfigResult, error) {
	return prom_v1.ConfigResult{}, nil
}

func (fpc *fakePromClient) GetRuntimeinfo(ctx context.Context) (prom_v1.RuntimeinfoResult, error) {
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

func TestConfigHandlerResolvesIdentityDomainFromMeshTrustDomain(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "mycluster"

	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{
				{
					Cluster: &models.KubeCluster{Name: "mycluster"},
					MeshConfig: &models.MeshConfig{
						MeshConfig: &istiov1alpha1.MeshConfig{
							TrustDomain: "example.org",
						},
					},
				},
			},
		},
	}

	prom := &fakePromClient{PromClientMock: prometheustest.PromClientMock{}}

	handler := handlers.WithFakeAuthInfo(conf, handlers.Config(conf, kialiCache, discovery, cf, prom))
	mr := mux.NewRouter()
	mr.Handle("/api/config", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "/api/config")
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })

	actual, err := io.ReadAll(resp.Body)
	require.NoError(err)
	require.Equal(200, resp.StatusCode, string(actual))

	var confResp handlers.PublicConfig
	require.NoError(json.Unmarshal(actual, &confResp))
	require.Equal("svc.example.org", confResp.IstioIdentityDomain)
}

func TestConfigHandlerExplicitConfigOverridesMeshTrustDomain(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "mycluster"
	conf.ExternalServices.Istio.IstioIdentityDomain = "svc.explicit.local"

	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{
				{
					Cluster: &models.KubeCluster{Name: "mycluster"},
					MeshConfig: &models.MeshConfig{
						MeshConfig: &istiov1alpha1.MeshConfig{
							TrustDomain: "example.org",
						},
					},
				},
			},
		},
	}

	prom := &fakePromClient{PromClientMock: prometheustest.PromClientMock{}}

	handler := handlers.WithFakeAuthInfo(conf, handlers.Config(conf, kialiCache, discovery, cf, prom))
	mr := mux.NewRouter()
	mr.Handle("/api/config", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "/api/config")
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })

	actual, err := io.ReadAll(resp.Body)
	require.NoError(err)
	require.Equal(200, resp.StatusCode, string(actual))

	var confResp handlers.PublicConfig
	require.NoError(json.Unmarshal(actual, &confResp))
	require.Equal("svc.explicit.local", confResp.IstioIdentityDomain)
}

func TestConfigHandlerMeshErrorFallsBackToDefault(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "mycluster"

	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshErr: fmt.Errorf("transient mesh discovery error"),
	}

	prom := &fakePromClient{PromClientMock: prometheustest.PromClientMock{}}

	handler := handlers.WithFakeAuthInfo(conf, handlers.Config(conf, kialiCache, discovery, cf, prom))
	mr := mux.NewRouter()
	mr.Handle("/api/config", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "/api/config")
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })

	actual, err := io.ReadAll(resp.Body)
	require.NoError(err)
	require.Equal(200, resp.StatusCode, string(actual))

	var confResp handlers.PublicConfig
	require.NoError(json.Unmarshal(actual, &confResp))
	require.Equal("svc.cluster.local", confResp.IstioIdentityDomain)
}
