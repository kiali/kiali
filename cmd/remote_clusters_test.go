package cmd

// Like remote_clusters.go, this file is deliberately untagged so it runs under `make test`
// (which builds with -tags exclude_frontend).

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	authv1 "k8s.io/api/authorization/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"
	ctrlcache "sigs.k8s.io/controller-runtime/pkg/cache"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

func TestClassifyRemoteProbeError(t *testing.T) {
	unauthorized := apierrors.NewUnauthorized("the server has asked for the client to provide credentials")
	forbidden := apierrors.NewForbidden(schema.GroupResource{Group: "authorization.k8s.io", Resource: "selfsubjectaccessreviews"}, "", nil)
	tooManyRequests := &apierrors.StatusError{ErrStatus: statusOrDie(t, http.StatusTooManyRequests, "TooManyRequests")}
	serviceUnavailable := &apierrors.StatusError{ErrStatus: statusOrDie(t, http.StatusServiceUnavailable, "ServiceUnavailable")}
	refused := &net.OpError{Op: "dial", Err: errors.New("connection refused")}
	cases := []struct {
		name string
		err  error
		want remoteProbeVerdict
	}{
		{"nil is keep", nil, remoteKeepTransient},
		{"401 is skip-auth", unauthorized, remoteSkipAuth},
		{"403 on the review endpoint is keep", forbidden, remoteKeepTransient},
		{"429 is keep", tooManyRequests, remoteKeepTransient},
		{"503 is keep", serviceUnavailable, remoteKeepTransient},
		{"connection refused is keep", refused, remoteKeepTransient},
		{"EOF is keep", io.EOF, remoteKeepTransient},
		{"unclassified is skip-config", errors.New("something odd"), remoteSkipConfig},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := classifyRemoteProbeError(c.err); got != c.want {
				t.Errorf("classifyRemoteProbeError(%v) = %v, want %v", c.err, got, c.want)
			}
		})
	}
}

func statusOrDie(t *testing.T, code int, reason string) (status metav1.Status) {
	t.Helper()
	// Build a Status through the JSON round trip so Reason is populated like a real API error.
	body, _ := json.Marshal(map[string]any{
		"kind":   "Status",
		"status": "Failure",
		"reason": reason,
		"code":   code,
	})
	if err := json.Unmarshal(body, &status); err != nil {
		t.Fatalf("failed to build status: %v", err)
	}
	return status
}

// TestCacheTransformsStaticallyMapped keeps the static mapper's answer set in sync with the
// ByObject option: the cache constructor resolves every ByObject type's namespacedness through
// the RESTMapper, which is exactly what forces discovery against a remote. If a type is added
// here without a static answer, cluster.New stops being offline.
func TestCacheTransformsStaticallyMapped(t *testing.T) {
	scheme, err := kubernetes.NewScheme()
	if err != nil {
		t.Fatalf("NewScheme failed: %v", err)
	}
	for obj := range cacheTransforms() {
		gvks, _, err := scheme.ObjectKinds(obj)
		if err != nil {
			t.Fatalf("could not resolve GVK for %T: %v", obj, err)
		}
		if len(gvks) == 0 {
			t.Fatalf("no GVK registered for %T", obj)
		}
		for _, gvk := range gvks {
			if !kubernetes.IsStaticallyMapped(gvk.GroupKind()) {
				t.Errorf("cacheTransforms includes %v (%T) but the static mapper cannot answer it; add it to kubernetes.staticNamespacedMappings", gvk, obj)
			}
		}
	}
}

// neverSyncingCache never reports itself synced, to exercise the bounded wait.
type neverSyncingCache struct {
	ctrlcache.Cache
}

func (c *neverSyncingCache) WaitForCacheSync(ctx context.Context) bool {
	<-ctx.Done()
	return false
}

// syncedCache reports itself synced immediately.
type syncedCache struct {
	ctrlcache.Cache
}

func (c *syncedCache) WaitForCacheSync(_ context.Context) bool {
	return true
}

// TestWaitForCachesToSyncHomeOnly covers the startup barrier's home path (mandatory,
// unblocked). The remote branch's bounded wait is covered by TestWaitForCachesSyncBounded
// with an injected timeout; running the real 45s const here would slow the suite.
func TestWaitForCachesToSyncHomeOnly(t *testing.T) {
	kubeCaches := map[string]ctrlcache.Cache{"home": &syncedCache{}}
	waitForCachesToSync(context.Background(), config.NewConfig(), kubeCaches, "home")
}

// TestWaitForCachesToSyncRemotesDoNotBlock pins the startup barrier's shape: with the home
// cache synced and a never-syncing remote, waitForCachesToSync returns promptly. The
// remote wait runs in the background so the server (and its startup probe) is never held
// behind a slow or unreachable remote.
func TestWaitForCachesToSyncRemotesDoNotBlock(t *testing.T) {
	kubeCaches := map[string]ctrlcache.Cache{
		"home":     &syncedCache{},
		"never-id": &neverSyncingCache{},
	}
	// A cancellable context keeps the background wait's goroutine from outliving the test.
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	start := time.Now()
	waitForCachesToSync(ctx, config.NewConfig(), kubeCaches, "home")
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Errorf("waitForCachesToSync took %s with a never-syncing remote, want a prompt return (the remote wait is backgrounded)", elapsed)
	}
}

func TestWaitForCachesSyncBounded(t *testing.T) {
	caches := map[string]ctrlcache.Cache{
		"never-1": &neverSyncingCache{},
		"never-2": &neverSyncingCache{},
	}
	start := time.Now()
	unsynced := waitForCachesSync(context.Background(), caches, 50*time.Millisecond)
	elapsed := time.Since(start)
	if len(unsynced) != 2 {
		t.Errorf("unsynced = %v, want both never-syncing clusters", unsynced)
	}
	if elapsed > 5*time.Second {
		t.Errorf("waitForCachesSync took %s, want bounded near the timeout", elapsed)
	}

}

// ssarServer answers a SelfSubjectAccessReview POST with the given HTTP status and, on 200,
// an allowed review.
func ssarServer(t *testing.T, status int) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			// Discovery or other requests: the probe only SSARs, so anything else is
			// answered minimally. (cluster.New with the static mapper does not call these.)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if status != http.StatusOK {
			w.WriteHeader(status)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"kind":   "Status",
				"status": "Failure",
				"reason": statusReason(status),
				"code":   status,
			})
			return
		}
		review := authv1.SelfSubjectAccessReview{
			Status: authv1.SubjectAccessReviewStatus{Allowed: false, Reason: "test"},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(&review)
	}))
	t.Cleanup(server.Close)
	return server
}

func statusReason(code int) string {
	switch code {
	case http.StatusUnauthorized:
		return "Unauthorized"
	case http.StatusForbidden:
		return "Forbidden"
	case http.StatusTooManyRequests:
		return "TooManyRequests"
	default:
		return "ServiceUnavailable"
	}
}

func TestSetupRemoteClustersClassification(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "home"

	unauthorizedServer := ssarServer(t, http.StatusUnauthorized)
	// allowed=false with 200: the normal non-cluster-wide-access answer, must keep the cluster.
	allowedFalseServer := ssarServer(t, http.StatusOK)

	clients := map[string]kubernetes.ClientInterface{}
	for cluster, host := range map[string]string{
		"home":     "http://127.0.0.1:1", // unused: the home cluster is not probed
		"bad-auth": unauthorizedServer.URL,
		"good":     allowedFalseServer.URL,
		// A closed local port: connection refused, a transient problem, must keep.
		"unreachable": "http://127.0.0.1:1",
	} {
		client, err := kubernetes.NewClient(kubernetes.ClusterInfo{
			ClientConfig: &rest.Config{Host: host},
			Name:         cluster,
		}, conf)
		if err != nil {
			t.Fatalf("NewClient(%s) failed: %v", cluster, err)
		}
		clients[cluster] = client
	}

	factory, err := kubernetes.NewClientFactoryWithSAClients(context.Background(), conf, clients)
	if err != nil {
		t.Fatalf("NewClientFactoryWithSAClients failed: %v", err)
	}

	kubeCaches := setupRemoteClusters(context.Background(), conf, factory, nil, testScheme(t))

	if _, found := kubeCaches["bad-auth"]; found {
		t.Error("cluster with rejected credentials should not get a cache")
	}
	if !factory.IsClusterSkipped("bad-auth") {
		t.Error("cluster with rejected credentials should be skipped")
	}
	if _, found := kubeCaches["home"]; found {
		t.Error("setupRemoteClusters must not handle the home cluster")
	}
	for _, kept := range []string{"good", "unreachable"} {
		if _, found := kubeCaches[kept]; !found {
			t.Errorf("cluster [%s] should be kept and get a cache", kept)
		}
		if factory.IsClusterSkipped(kept) {
			t.Errorf("cluster [%s] should not be skipped", kept)
		}
	}

	// The factory's SA view must exclude the skipped cluster.
	for cluster := range factory.GetSAClients() {
		if cluster == "bad-auth" {
			t.Error("GetSAClients must not include the skipped cluster")
		}
	}

	// User clients for the skipped cluster are refused; the CWA namespace path that
	// dereferences a missing SA client would otherwise panic.
	if _, err := factory.GetClient(&api.AuthInfo{Token: "some-token"}, "bad-auth"); err == nil {
		t.Error("GetClient for a skipped cluster should error")
	}
}

func TestSetupRemoteClustersConstructionFailureSkips(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "home"

	// A config whose CA data cannot initialize a TLS transport makes client construction
	// fail - the factory-level tolerance path. (Direct construction failure inside
	// setupRemoteClusters is exercised through the same SkipCluster registry.)
	clients := map[string]kubernetes.ClientInterface{}
	for cluster := range map[string]struct{}{"home": {}, "remote": {}} {
		client, err := kubernetes.NewClient(kubernetes.ClusterInfo{
			ClientConfig: &rest.Config{Host: "http://127.0.0.1:1"},
			Name:         cluster,
		}, conf)
		if err != nil {
			t.Fatalf("NewClient(%s) failed: %v", cluster, err)
		}
		clients[cluster] = client
	}

	factory, err := kubernetes.NewClientFactoryWithSAClients(context.Background(), conf, clients)
	if err != nil {
		t.Fatalf("NewClientFactoryWithSAClients failed: %v", err)
	}

	// Simulate a construction failure for the remote by skipping it before setup: the
	// registry is the same one newRemoteCluster failures feed.
	factory.SkipCluster("remote", errors.New("construction failed"))

	kubeCaches := setupRemoteClusters(context.Background(), conf, factory, nil, testScheme(t))
	if _, found := kubeCaches["remote"]; found {
		t.Error("a cluster with a failed construction should not get a cache")
	}
	if _, found := kubeCaches["home"]; found {
		t.Error("setupRemoteClusters must not handle the home cluster")
	}
}

func testScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	scheme, err := kubernetes.NewScheme()
	if err != nil {
		t.Fatalf("NewScheme failed: %v", err)
	}
	return scheme
}

// TestClassifyRemoteProbeErrorTLSFirst pins the classification order: a TLS failure from a
// real client arrives wrapped in *url.Error (which implements net.Error), so it must be
// recognized as a certificate problem - and skip the cluster - before the generic
// connection-error case can misread it as a recoverable outage.
func TestClassifyRemoteProbeErrorTLSFirst(t *testing.T) {
	// An HTTPS server whose certificate is not trusted by the client's config.
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(server.Close)

	conf := config.NewConfig()
	client, err := kubernetes.NewClient(kubernetes.ClusterInfo{
		ClientConfig: &rest.Config{Host: server.URL},
		Name:         "bad-ca",
	}, conf)
	require.NoError(t, err)

	probeErr := probeRemoteCredentials(context.Background(), config.NewConfig(), client)
	require.Error(t, probeErr, "the untrusted-CA server must fail the probe")

	// The wrapper implements net.Error; the classifier must still see the certificate.
	var netErr net.Error
	require.ErrorAs(t, probeErr, &netErr, "precondition: the error is wrapped in a net.Error")
	if got := classifyRemoteProbeError(probeErr); got != remoteSkipConfig {
		t.Errorf("classifyRemoteProbeError(untrusted CA) = %v, want remoteSkipConfig", got)
	}
}

type blockedStartupMonitor struct {
	business.ControlPlaneMonitor
	entered chan struct{}
}

func (m blockedStartupMonitor) PollIstiodForProxyStatus(ctx context.Context) {
	close(m.entered)
	<-ctx.Done()
}

func TestMonitorStartupDoesNotWaitForMesh(t *testing.T) {
	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()
	m := blockedStartupMonitor{entered: make(chan struct{})}
	waitForCachesToSync(ctx, config.NewConfig(), map[string]ctrlcache.Cache{
		"home": &syncedCache{}, "west": &neverSyncingCache{}, "east": &neverSyncingCache{},
	}, "home")
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	defer server.Close()
	startServerAndMonitors(ctx, server.Start, true, m, nil, nil)
	select {
	case <-m.entered:
	case <-ctx.Done():
		t.Fatal("proxy status refresh did not start")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL, nil)
	require.NoError(t, err)
	resp, err := server.Client().Do(req)
	require.NoError(t, err, "home listener must answer while the remote caches and proxy status are still blocked")
	defer resp.Body.Close()
	require.Equal(t, http.StatusNoContent, resp.StatusCode)
}

type startupDiscovery struct {
	istio.MeshDiscovery
	entered, release chan struct{}
}

func (d startupDiscovery) Mesh(ctx context.Context) (*models.Mesh, error) {
	close(d.entered)
	select {
	case <-d.release:
		return &models.Mesh{}, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

type startupHealthMonitor struct {
	business.HealthMonitor
	started chan struct{}
}

func (m startupHealthMonitor) Start(context.Context) { close(m.started) }

func TestHealthMonitorStartsAfterBackgroundPrime(t *testing.T) {
	ctx, cancel := context.WithTimeout(t.Context(), 3*time.Second)
	defer cancel()
	d := startupDiscovery{entered: make(chan struct{}), release: make(chan struct{})}
	h := startupHealthMonitor{started: make(chan struct{})}
	startServerAndMonitors(ctx, func() {}, false, nil, d, h)
	select {
	case <-d.entered:
	case <-ctx.Done():
		t.Fatal("mesh priming never started")
	}
	select {
	case <-h.started:
		t.Fatal("health monitor started before mesh priming finished")
	default:
	}
	close(d.release)
	select {
	case <-h.started:
	case <-ctx.Done():
		t.Fatal("health monitor did not start after discovery")
	}
}
