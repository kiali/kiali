package cache

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

// newCacheTestClient builds a real K8SClient against an httptest server, for the
// startup-tolerance regression tests below.
func newCacheTestClient(t *testing.T, name, host string) kubernetes.ClientInterface {
	t.Helper()
	client, err := kubernetes.NewClient(kubernetes.ClusterInfo{
		ClientConfig: &rest.Config{Host: host},
		Name:         name,
	}, config.NewConfig())
	if err != nil {
		t.Fatalf("NewClient(%s) failed: %v", name, err)
	}
	return client
}

// TestNewKialiCacheToleratesUnreachableRemote pins the #10542 startup tolerance at the cache
// layer: a remote whose credentials are rejected (401 on the webhook SSAR) must not fail
// NewKialiCache - the check is warned off and the cluster simply cannot list webhooks.
func TestNewKialiCacheToleratesUnreachableRemote(t *testing.T) {
	unauthorized := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(&metav1.Status{
			Status: metav1.StatusFailure,
			Reason: metav1.StatusReasonUnauthorized,
			Code:   http.StatusUnauthorized,
		})
	}))
	t.Cleanup(unauthorized.Close)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "home"

	homeClient := newCacheTestClient(t, "home", "http://127.0.0.1:1")
	badRemote := newCacheTestClient(t, "bad-remote", unauthorized.URL)

	readers := map[string]ctrlclient.Reader{"home": fake.NewClientBuilder().Build()}
	kialiCache, err := NewKialiCache(context.Background(), map[string]kubernetes.ClientInterface{
		"home":       homeClient,
		"bad-remote": badRemote,
	}, readers, *conf)
	if err != nil {
		t.Fatalf("NewKialiCache should tolerate a remote with rejected credentials: %v", err)
	}
	if kialiCache.CanListWebhooks("bad-remote") {
		t.Error("a remote that rejects the webhook SSAR must not be able to list webhooks")
	}
}

// TestSkippedClustersOption covers the WithSkippedClusters option and the interface methods.
func TestSkippedClustersOption(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "home"

	homeClient := newCacheTestClient(t, "home", "http://127.0.0.1:1")
	readers := map[string]ctrlclient.Reader{"home": fake.NewClientBuilder().Build()}
	kialiCache, err := NewKialiCache(context.Background(),
		map[string]kubernetes.ClientInterface{"home": homeClient},
		readers, *conf,
		WithSkippedClusters([]string{"east", "west"}))
	if err != nil {
		t.Fatalf("NewKialiCache failed: %v", err)
	}

	if got := kialiCache.SkippedClusters(); len(got) != 2 || got[0] != "east" || got[1] != "west" {
		t.Errorf("SkippedClusters() = %v, want [east west]", got)
	}
	if !kialiCache.IsClusterSkipped("east") || !kialiCache.IsClusterSkipped("west") {
		t.Error("IsClusterSkipped must report the skipped clusters")
	}
	if kialiCache.IsClusterSkipped("home") {
		t.Error("home is never skipped")
	}

	// Reads through a skipped cluster keep the ErrClusterNotCached semantics.
	if _, err := kialiCache.GetKubeCache("east"); err == nil {
		t.Error("GetKubeCache for a skipped cluster should error")
	}
}
