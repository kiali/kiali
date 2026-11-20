package cache

// Assisted-by: Claude Code

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"
	ctrlcache "sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// forbiddenCache returns a started informer cache whose API server answers every request with 403,
// like a cluster where Kiali's access was revoked. Its informers never sync.
func forbiddenCache(t *testing.T) ctrlcache.Cache {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"kind":"Status","apiVersion":"v1","status":"Failure","reason":"Forbidden","code":403}`))
	}))
	t.Cleanup(srv.Close)

	scheme := runtime.NewScheme()
	require.NoError(t, core_v1.AddToScheme(scheme))
	mapper := meta.NewDefaultRESTMapper(nil)
	mapper.Add(core_v1.SchemeGroupVersion.WithKind("Pod"), meta.RESTScopeNamespace)

	c, err := ctrlcache.New(&rest.Config{Host: srv.URL}, ctrlcache.Options{Scheme: scheme, Mapper: mapper})
	require.NoError(t, err)
	go func() { _ = c.Start(t.Context()) }()
	// Reads before Start return ErrCacheNotStarted at once. No informers exist yet, so this returns once started.
	require.True(t, c.WaitForCacheSync(t.Context()))
	return c
}

// listWithin runs the List in a goroutine so a regression fails the test instead of hanging it.
func listWithin(ctx context.Context, t *testing.T, reader client.Reader, wait time.Duration) (time.Duration, error) {
	t.Helper()
	start := time.Now()
	done := make(chan error, 1)
	go func() { done <- reader.List(ctx, &core_v1.PodList{}) }()
	select {
	case err := <-done:
		return time.Since(start), err
	case <-time.After(wait):
		t.Fatalf("List did not return within %s", wait)
		return 0, nil
	}
}

func TestUnsyncableInformerBlocksUntilContextIsDone(t *testing.T) {
	c := forbiddenCache(t)
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()

	elapsed, err := listWithin(ctx, t, c, 10*time.Second)
	require.Error(t, err)
	require.GreaterOrEqual(t, elapsed, 300*time.Millisecond, "the read should block until the context is done")
}

func TestTimeoutReaderReturnsWhenInformerCannotSync(t *testing.T) {
	reader := timeoutReader{inner: forbiddenCache(t), timeout: 200 * time.Millisecond}

	_, err := listWithin(context.Background(), t, reader, 10*time.Second)
	require.Error(t, err)
}

type deadlineReader struct {
	client.Reader
	deadline time.Time
	ok       bool
}

func (r *deadlineReader) Get(ctx context.Context, _ client.ObjectKey, _ client.Object, _ ...client.GetOption) error {
	r.deadline, r.ok = ctx.Deadline()
	return nil
}

func (r *deadlineReader) List(ctx context.Context, _ client.ObjectList, _ ...client.ListOption) error {
	r.deadline, r.ok = ctx.Deadline()
	return nil
}

func TestTimeoutReaderSetsDeadline(t *testing.T) {
	inner := &deadlineReader{}
	reader := timeoutReader{inner: inner, timeout: time.Minute}

	before := time.Now()
	require.NoError(t, reader.List(context.Background(), &core_v1.PodList{}))
	require.True(t, inner.ok)
	require.WithinDuration(t, before.Add(time.Minute), inner.deadline, 5*time.Second)

	require.NoError(t, reader.Get(context.Background(), client.ObjectKey{Name: "p"}, &core_v1.Pod{}))
	require.True(t, inner.ok)
	require.WithinDuration(t, before.Add(time.Minute), inner.deadline, 5*time.Second)
}

func TestTimeoutReaderKeepsEarlierCallerDeadline(t *testing.T) {
	inner := &deadlineReader{}
	reader := timeoutReader{inner: inner, timeout: time.Minute}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	callerDeadline, _ := ctx.Deadline()

	require.NoError(t, reader.List(ctx, &core_v1.PodList{}))
	require.Equal(t, callerDeadline, inner.deadline)
}

func TestKubeCacheReadsAreBoundedByConfig(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	require.Equal(t, 30*time.Second, conf.KialiInternal.CacheReadTimeout)

	k8s := kubetest.NewFakeK8sClient()
	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}
	readers := map[string]client.Reader{conf.KubernetesConfig.ClusterName: k8s}

	kialiCache, err := NewKialiCache(t.Context(), clients, readers, *conf)
	require.NoError(t, err)
	reader, err := kialiCache.GetKubeCache(conf.KubernetesConfig.ClusterName)
	require.NoError(t, err)
	require.Equal(t, timeoutReader{cluster: conf.KubernetesConfig.ClusterName, inner: k8s, timeout: 30 * time.Second}, reader)

	conf.KialiInternal.CacheReadTimeout = 0
	kialiCache, err = NewKialiCache(t.Context(), clients, readers, *conf)
	require.NoError(t, err)
	reader, err = kialiCache.GetKubeCache(conf.KubernetesConfig.ClusterName)
	require.NoError(t, err)
	require.Same(t, k8s, reader)
}
