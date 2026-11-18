package cmd

// Like remote_clusters.go, untagged so these run under `make test`.

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	authv1 "k8s.io/api/authorization/v1"
	"k8s.io/apimachinery/pkg/runtime"
	kubefake "k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/rest"
	k8stesting "k8s.io/client-go/testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// fakeClientWithAccessAndErrors answers SSARs per namespace: namespaces in denied get
// allowed=false, namespaces in erroring get an error (the sweep could not tell, modeling a
// budget-truncated sweep), everything else is allowed.
func fakeClientWithAccessAndErrors(denied map[string]bool, erroring map[string]bool) *kubetest.FakeK8sClient {
	client := kubetest.NewFakeK8sClient()
	client.KubeClientset.(*kubefake.Clientset).PrependReactor("create", "selfsubjectaccessreviews",
		func(action k8stesting.Action) (bool, runtime.Object, error) {
			review := action.(k8stesting.CreateAction).GetObject().(*authv1.SelfSubjectAccessReview)
			attrs := review.Spec.ResourceAttributes
			if erroring[attrs.Namespace] {
				return true, review, fmt.Errorf("could not tell for namespace [%s]", attrs.Namespace)
			}
			review.Status.Allowed = !denied[attrs.Namespace]
			return true, review, nil
		})
	return client
}

func sweepTestConfig(namespaces ...string) *config.Config {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "home"
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = namespaces
	return conf
}

// TestAccessCheckAllUnknownIsError pins the conservative fallback: a sweep where nothing
// could be told returns an error (the cache is kept, the check retried).
func TestAccessCheckAllUnknownIsError(t *testing.T) {
	conf := sweepTestConfig("ns1", "ns2")
	client := fakeClientWithAccessAndErrors(map[string]bool{}, map[string]bool{"ns1": true, "ns2": true})
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": client})

	_, err := newAccessCheck(conf, factory)(context.Background(), "west", "apps", "deployments")
	require.Error(t, err)
}

// TestAccessCheckFullRevocationRequiresFullScope pins the denominator: the cluster is only
// fully revoked when every namespace in the scope is denied - a sweep with any error is the
// conservative unknown verdict instead, never a full revocation off an incomplete result.
func TestAccessCheckFullRevocationRequiresFullScope(t *testing.T) {
	conf := sweepTestConfig("ns1", "ns2", "ns3")
	// ns1 and ns2 denied, ns3's check errors: not a full revocation, an unknown verdict.
	erroring := map[string]bool{"ns3": true}
	client := fakeClientWithAccessAndErrors(map[string]bool{"ns1": true, "ns2": true}, erroring)
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": client})

	check := newAccessCheck(conf, factory)
	denied, err := check(t.Context(), "west", "apps", "deployments")
	require.Error(t, err, "a sweep with an errored namespace reports the conservative unknown verdict")
	require.False(t, denied.Cluster, "an incomplete sweep must not report the cluster fully revoked")
	require.Equal(t, []string{"ns1", "ns2"}, denied.Namespaces)
	delete(erroring, "ns3")
	erroring["ns1"] = true // the second window can only finish if progress was retained
	denied, err = check(t.Context(), "west", "apps", "deployments")
	require.NoError(t, err)
	require.Equal(t, []string{"ns1", "ns2"}, denied.Namespaces)

}

// TestAccessCheckSweepNotThrottledByReadPathRateLimit pins the #10544 regression: the
// sweep's SelfSubjectAccessReviews go through the client's rate-limit-free authorization
// clientset. With the read-path limiter at QPS 1, a 50-namespace sweep (100 SSARs) could
// never finish inside the access check's 5s timeout, so revocation would go undetected.
func TestAccessCheckSweepNotThrottledByReadPathRateLimit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"kind":"SelfSubjectAccessReview","apiVersion":"authorization.k8s.io/v1","status":{"allowed":true}}`))
	}))
	t.Cleanup(server.Close)

	// The main clientset is throttled to ~1 request/s: any sweep that went through it
	// would need ~100s for 100 SSARs and always lose the race with the check timeout.
	cfg := &rest.Config{Host: server.URL, QPS: 1, Burst: 1}
	client, err := kubernetes.NewClient(kubernetes.ClusterInfo{ClientConfig: cfg, Name: "west"}, config.NewConfig())
	require.NoError(t, err)

	namespaces := make([]string, 50)
	for i := range namespaces {
		namespaces[i] = fmt.Sprintf("ns-%02d", i)
	}
	conf := sweepTestConfig(namespaces...)
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": client})
	factory.SAClients = map[string]kubernetes.ClientInterface{"west": client}

	// The access check's own budget (cache.accessCheckTimeout).
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	start := time.Now()
	denied, err := newAccessCheck(conf, factory)(ctx, "west", "apps", "deployments")
	require.NoError(t, err, "the sweep must finish inside the check timeout")
	require.False(t, denied.Cluster)
	require.Empty(t, denied.Namespaces)
	require.Less(t, time.Since(start).Milliseconds(), int64(4000), "the sweep must not queue behind the read-path rate limiter")

	// Foreground permissions on the same client still obey its QPS and burst.
	immediate, stop := context.WithTimeout(t.Context(), 200*time.Millisecond)
	defer stop()
	_, err = client.GetSelfSubjectAccessReview(immediate, "ns-01", "apps", "deployments", []string{"get", "update"})
	require.ErrorContains(t, err, "rate limiter")
}

// windowedReviewer models a remote which can answer two namespace reviews per
// window. Every new window has the same budget.
type windowedReviewer struct {
	*kubetest.FakeK8sClient
	remaining atomic.Int32
}

func (r *windowedReviewer) GetAccessSweepReview(ctx context.Context, namespace, group, resource string, verbs []string) ([]*authv1.SelfSubjectAccessReview, error) {
	if r.remaining.Add(-1) < 0 {
		return nil, context.DeadlineExceeded
	}
	return []*authv1.SelfSubjectAccessReview{{Status: authv1.SubjectAccessReviewStatus{Allowed: false}}}, nil
}

func TestAccessSweepFinishesAcrossBoundedWindows(t *testing.T) {
	conf := sweepTestConfig("a", "b", "c", "d", "e", "f")
	client := &windowedReviewer{FakeK8sClient: kubetest.NewFakeK8sClient()}
	factory := kubetest.NewFakeClientFactory(conf, map[string]kubernetes.UserClientInterface{"west": client})
	check := newAccessCheck(conf, factory)
	for window := 1; window <= 3; window++ {
		client.remaining.Store(2)
		denied, err := check(t.Context(), "west", "apps", "deployments")
		if window < 3 {
			require.ErrorIs(t, err, context.DeadlineExceeded)
			require.False(t, denied.Cluster)
			require.True(t, denied.Incomplete)
			require.Len(t, denied.Namespaces, 2*window)
		} else {
			require.NoError(t, err)
			require.True(t, denied.Cluster)
		}
	}
}
