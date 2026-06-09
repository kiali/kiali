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
	apps_v1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
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

// fakeDisabledPromClient extends fakePromClient with a DisabledReason,
// simulating a LazyClient that hasn't yet connected to Prometheus.
type fakeDisabledPromClient struct {
	fakePromClient
	reason string
}

func (f *fakeDisabledPromClient) DisabledReason() string {
	return f.reason
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

	require.True(confResp.Prometheus.Enabled, "Prometheus should be enabled by default")
}

func TestConfigHandlerPrometheusDisabled(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Prometheus.Enabled = false
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

	resp, err := http.Get(ts.URL + "/api/config")
	require.NoError(err)

	actual, err := io.ReadAll(resp.Body)
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })

	require.Equal(200, resp.StatusCode, string(actual))

	var confResp handlers.PublicConfig
	require.NoError(json.Unmarshal(actual, &confResp))

	require.False(confResp.Prometheus.Enabled, "Prometheus should be disabled")
	require.Empty(confResp.Prometheus.DisabledReason, "DisabledReason should be empty when user explicitly disabled Prometheus")
}

func TestConfigHandlerPrometheusEnabledButUnreachable(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.ExternalServices.Prometheus.Enabled = true
	expectedReason := "Prometheus unreachable at [http://prometheus:9090/-/healthy] (status [0])"

	k8s := kubetest.NewFakeK8sClient()
	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := &istiotest.FakeDiscovery{}

	// Use a client that implements DisabledReasonProvider to simulate the LazyClient
	// reporting a disabled reason to the config handler.
	prom := &fakeDisabledPromClient{
		fakePromClient: fakePromClient{PromClientMock: prometheustest.PromClientMock{}},
		reason:         expectedReason,
	}

	handler := handlers.WithFakeAuthInfo(conf, handlers.Config(conf, cache, discovery, cf, prom))
	mr := mux.NewRouter()
	mr.Handle("/api/config", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	resp, err := http.Get(ts.URL + "/api/config")
	require.NoError(err)

	actual, err := io.ReadAll(resp.Body)
	require.NoError(err)
	t.Cleanup(func() { resp.Body.Close() })

	require.Equal(200, resp.StatusCode, string(actual))

	var confResp handlers.PublicConfig
	require.NoError(json.Unmarshal(actual, &confResp))

	require.True(confResp.Prometheus.Enabled, "Prometheus should still be enabled (user's intent)")
	require.NotEmpty(confResp.Prometheus.DisabledReason, "DisabledReason should be set when Prometheus is unreachable")
	require.Equal(expectedReason, confResp.Prometheus.DisabledReason)
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

func TestConfigHandlerAmbientEnabledChecksAllClusters(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "mgmt-cluster"
	conf.Clustering.IgnoreHomeCluster = true

	// Home cluster: bare management cluster (no ztunnel, no Gateway API,
	// no Istio CRDs).
	homeClient := kubetest.NewFakeK8sClient()
	homeClient.GatewayAPIEnabled = false
	homeClient.IstioGatewayInstalled = false
	homeClient.IstioAPIInstalled = false
	// Remote cluster: has a ztunnel DaemonSet (ambient enabled), Gateway API,
	// and Istio CRDs.
	remoteClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		&apps_v1.DaemonSet{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "ztunnel",
				Namespace: "istio-system",
				Labels:    map[string]string{"app.kubernetes.io/name": "ztunnel"},
			},
			Spec: apps_v1.DaemonSetSpec{
				Selector: &metav1.LabelSelector{
					MatchLabels: map[string]string{"app": "ztunnel"},
				},
			},
		},
	)
	remoteClient.GatewayAPIEnabled = true
	remoteClient.IstioGatewayInstalled = true
	remoteClient.IstioAPIInstalled = true

	clients := map[string]kubernetes.UserClientInterface{
		"mgmt-cluster": homeClient,
		"member-1":     remoteClient,
	}
	cf := kubetest.NewFakeClientFactory(conf, clients)
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := &istiotest.FakeDiscovery{}

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
	require.True(confResp.AmbientEnabled, "ambientEnabled should be true when a remote cluster has ztunnel")
	require.True(confResp.GatewayAPIEnabled, "gatewayAPIEnabled should be true when a remote cluster has Gateway API CRDs")
	require.True(confResp.IstioGatewayInstalled, "istioGatewayInstalled should be true when a remote cluster has Istio Gateway CRD")
	require.True(confResp.IstioAPIInstalled, "istioAPIInstalled should be true when a remote cluster has Istio API CRDs")

	var hasWaypoint bool
	for _, gwClass := range confResp.GatewayAPIClasses {
		if gwClass.ClassName == "istio-waypoint" {
			hasWaypoint = true
			break
		}
	}
	require.True(hasWaypoint, "GatewayAPIClasses should include istio-waypoint when a remote cluster has ztunnel")
}
