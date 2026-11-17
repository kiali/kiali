package handlers

// Internal (same-package) tests for the /api/config capability-discovery deadline: they
// shorten the unexported capabilityDiscoveryTimeout, which the external test package
// cannot reach.

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/mux"
	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

// internalFakePromClient mirrors the external tests' fakePromClient: the shared mock
// does not implement the configuration/runtimeinfo endpoints the handler probes.
type internalFakePromClient struct {
	prometheustest.PromClientMock
}

func (fpc *internalFakePromClient) GetConfiguration(ctx context.Context) (prom_v1.ConfigResult, error) {
	return prom_v1.ConfigResult{}, nil
}

func (fpc *internalFakePromClient) GetRuntimeinfo(ctx context.Context) (prom_v1.RuntimeinfoResult, error) {
	return prom_v1.RuntimeinfoResult{}, nil
}

// shortDiscoveryDeadline shortens the config handler's capability-discovery deadline for
// the duration of a test so the stalled-remote cases run fast.
func shortDiscoveryDeadline(t *testing.T) time.Duration {
	t.Helper()
	original := capabilityDiscoveryTimeout
	capabilityDiscoveryTimeout = 400 * time.Millisecond
	t.Cleanup(func() { capabilityDiscoveryTimeout = original })
	return capabilityDiscoveryTimeout
}

// newStalledClusterClient builds a real Kubernetes client whose API server accepts
// requests but never answers them. The returned channel closes when the server first
// observes a client giving up (its request context cancelled), proving the request was
// abandoned rather than left hanging.
func newStalledClusterClient(t *testing.T, name string, conf *config.Config) kubernetes.UserClientInterface {
	t.Helper()
	var giveUp sync.Once
	abandoned := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The cache's startup webhook permission check is a POST; answer it (denied) so
		// it completes. It is not the code under test, and an aborted POST does not
		// close the server connection promptly (unlike an aborted GET), which would
		// hang the test server's Close however the request ends.
		if r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"kind":"SelfSubjectAccessReview","apiVersion":"authorization.k8s.io/v1","status":{"allowed":false}}`))
			return
		}
		// Every other request - the discovery probes - is accepted but never answered.
		<-r.Context().Done()
		giveUp.Do(func() { close(abandoned) })
	}))
	t.Cleanup(server.Close)

	client, err := kubernetes.NewClient(kubernetes.ClusterInfo{
		ClientConfig: &rest.Config{Host: server.URL},
		Name:         name,
	}, conf)
	require.NoError(t, err)
	t.Cleanup(func() {
		select {
		case <-abandoned:
		case <-time.After(10 * time.Second):
			t.Errorf("the stalled cluster [%s] never observed a cancelled request", name)
		}
	})
	return client
}

// healthyRemoteClient builds the fake remote that alone supplies a capability flag and a
// Gateway API class, plus a ztunnel daemonset for the ambient flag.
func healthyRemoteClient() *kubetest.FakeK8sClient {
	remote := kubetest.NewFakeK8sClient(
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
	remote.GatewayAPIEnabled = true
	remote.IstioGatewayInstalled = true
	remote.IstioAPIInstalled = true
	return remote
}

// runConfigRequest serves one GET /api/config through the real handler and returns the
// response and how long it took.
func runConfigRequest(t *testing.T, conf *config.Config, kialiCache cache.KialiCache, cf kubernetes.ClientFactory) (*http.Response, time.Duration) {
	t.Helper()
	handler := WithFakeAuthInfo(conf, Config(conf, kialiCache, &istiotest.FakeDiscovery{}, cf, &internalFakePromClient{prometheustest.PromClientMock{}}))
	mr := mux.NewRouter()
	mr.Handle("/api/config", handler)
	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)

	start := time.Now()
	resp, err := http.Get(ts.URL + "/api/config")
	elapsed := time.Since(start)
	require.NoError(t, err)
	t.Cleanup(func() { resp.Body.Close() })
	return resp, elapsed
}

// TestConfigHandlerStalledRemoteBounded pins the #10545 deadline: a remote whose API
// accepts requests but never answers must not hold GET /api/config. The response must
// still be 200 with the healthy clusters' flags and classes, and the stalled remote must
// observe its requests cancelled. The stalled remote is wired as both a user client (the
// capability flags) and a service-account client (the Gateway API class probe), so a fix
// limited to the user-client loop fails this test.
func TestConfigHandlerStalledRemoteBounded(t *testing.T) {
	deadline := shortDiscoveryDeadline(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "home"
	conf.ExternalServices.Istio.GatewayAPIClasses = []config.GatewayAPIClass{{Name: "istio", ClassName: "istio"}}

	home := kubetest.NewFakeK8sClient()
	remote := healthyRemoteClient()
	stalled := newStalledClusterClient(t, "stalled-remote", conf)

	cf := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{
		"home":           home,
		"healthy-remote": remote,
		"stalled-remote": stalled,
	})
	// The cache resolves Gateway API classes through the service-account clients; wire
	// the stalled remote there too so the class-collection pass is exercised against it.
	saClients := map[string]kubernetes.ClientInterface{
		"home":           home,
		"healthy-remote": remote,
		"stalled-remote": stalled,
	}
	cf.SAClients = saClients
	// The real stalled client cannot serve as a cache reader (its informer reader is not
	// wired outside the factory), so the stalled remote reads through an empty fake: the
	// ambient check must find nothing there, immediately.
	kialiCache, err := cache.NewKialiCache(t.Context(), saClients, map[string]ctrlclient.Reader{
		"home":           home,
		"healthy-remote": remote,
		"stalled-remote": kubetest.NewFakeK8sClient(),
	}, *conf)
	require.NoError(t, err)

	resp, elapsed := runConfigRequest(t, conf, kialiCache, cf)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, string(body))

	var confResp PublicConfig
	require.NoError(t, json.Unmarshal(body, &confResp))
	require.True(t, confResp.GatewayAPIEnabled, "the healthy remote's Gateway API flag must survive the stalled remote")
	require.True(t, confResp.IstioGatewayInstalled)
	require.True(t, confResp.IstioAPIInstalled)
	require.True(t, confResp.AmbientEnabled, "the healthy remote's ztunnel must be discovered")
	var hasIstioClass bool
	for _, gwClass := range confResp.GatewayAPIClasses {
		if gwClass.ClassName == "istio" {
			hasIstioClass = true
		}
	}
	require.True(t, hasIstioClass, "the configured Gateway API class must be returned despite the stalled remote")

	// The whole request must be bounded by the shared discovery deadline (plus slack for
	// the unrelated parts of the handler), not by one stalled probe per cluster per flag.
	require.Less(t, elapsed, 5*deadline, "one stalled remote must not hold the config request")

}

// TestConfigHandlerTwoStalledRemotesShareBudget shows the deadline is one shared budget:
// two stalled remotes cost the same one-deadline delay, not two.
func TestConfigHandlerTwoStalledRemotesShareBudget(t *testing.T) {
	deadline := shortDiscoveryDeadline(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "home"
	conf.ExternalServices.Istio.GatewayAPIClasses = []config.GatewayAPIClass{{Name: "istio", ClassName: "istio"}}

	home := kubetest.NewFakeK8sClient()
	stalledOne := newStalledClusterClient(t, "stalled-one", conf)
	stalledTwo := newStalledClusterClient(t, "stalled-two", conf)

	cf := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{
		"home":        home,
		"stalled-one": stalledOne,
		"stalled-two": stalledTwo,
	})
	saClients := map[string]kubernetes.ClientInterface{
		"home":        home,
		"stalled-one": stalledOne,
		"stalled-two": stalledTwo,
	}
	cf.SAClients = saClients
	kialiCache, err := cache.NewKialiCache(t.Context(), saClients, map[string]ctrlclient.Reader{
		"home":        home,
		"stalled-one": kubetest.NewFakeK8sClient(),
		"stalled-two": kubetest.NewFakeK8sClient(),
	}, *conf)
	require.NoError(t, err)

	resp, elapsed := runConfigRequest(t, conf, kialiCache, cf)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode, string(body))
	require.Less(t, elapsed, 5*deadline, "two stalled remotes must share one discovery budget")
}
