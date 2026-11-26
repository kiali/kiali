package business

import (
	"context"
	"slices"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	appsv1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/cache/cachetest"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// TestSkipUnavailableCluster covers the degraded-cluster decision the per-cluster list
// and status handlers rely on: a degraded remote cluster is skipped, the home cluster
// and a cluster with no cache configured at all fail, an available cluster proceeds.
func TestSkipUnavailableCluster(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("testNamespace"))
	remote := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("testNamespace"))

	// The check denies everything, so any ConfirmRevoked call degrades that cluster.
	clients := map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s, "remote-cluster": remote}
	clusterCache, access, err := cachetest.NewFakeKialiCache(context.Background(), conf, clients,
		func(context.Context, string, string, string) (cache.DeniedAccess, error) {
			return cache.DeniedAccess{Cluster: true}, nil
		})
	require.NoError(t, err)
	layer := NewLayerBuilder(t, conf).
		WithClients(map[string]kubernetes.UserClientInterface{config.DefaultClusterID: k8s, "remote-cluster": remote}).
		WithCache(clusterCache).
		Build()

	// Available clusters proceed.
	skip, err := layer.SkipUnavailableCluster(context.Background(), config.DefaultClusterID)
	require.NoError(t, err)
	require.False(t, skip, "an available cluster is not skipped")
	skip, err = layer.SkipUnavailableCluster(context.Background(), "remote-cluster")
	require.NoError(t, err)
	require.False(t, skip, "an available remote cluster is not skipped")

	// A degraded remote cluster is skipped, not failed: it recovers when access is
	// restored, and the pages that span clusters render its empty result.
	require.True(t, access.ConfirmRevoked(context.Background(), "remote-cluster", "apps", "deployments"))
	skip, err = layer.SkipUnavailableCluster(context.Background(), "remote-cluster")
	require.NoError(t, err)
	require.True(t, skip, "a degraded remote cluster is skipped")

	// A cluster Kiali has no cache configured for at all is a configuration error
	// (e.g. a mistyped cluster name): it will not recover on its own, so it fails
	// the request instead of silently resolving to an empty result.
	skip, err = layer.SkipUnavailableCluster(context.Background(), "not-registered")
	require.Error(t, err)
	require.ErrorIs(t, err, cache.ErrClusterNotCached)
	require.False(t, skip, "an uncached cluster fails the request")

	// The home cluster is not skippable: its cache being unavailable fails the request.
	require.True(t, access.ConfirmRevoked(context.Background(), config.DefaultClusterID, "apps", "deployments"))
	skip, err = layer.SkipUnavailableCluster(context.Background(), config.DefaultClusterID)
	require.Error(t, err)
	require.False(t, skip, "the home cluster is never skipped")
}

// A partially-revoked namespace is excluded from workload fetches: its informers cannot
// refresh while the rest of the cluster stays readable, so serving them would show
// workloads that may no longer exist.
func TestFetchWorkloadsExcludesRevokedNamespaces(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.ExternalServices.Istio.IstioAPIEnabled = false

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("istio-system"),
		&appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "ratings-v2", Namespace: "bookinfo", Labels: map[string]string{"app": "ratings"}}},
		&appsv1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "istiod", Namespace: "istio-system", Labels: map[string]string{"app": "istiod"}}},
	)

	// bookinfo is denied while istio-system stays readable: a partial revocation.
	clients := map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s}
	clusterCache, access, err := cachetest.NewFakeKialiCache(context.Background(), conf, clients,
		func(context.Context, string, string, string) (cache.DeniedAccess, error) {
			return cache.DeniedAccess{Namespaces: []string{"bookinfo"}}, nil
		})
	require.NoError(t, err)
	layer := NewLayerBuilder(t, conf).WithClient(k8s).WithCache(clusterCache).Build()
	require.False(t, access.ConfirmRevoked(context.Background(), config.DefaultClusterID, "apps", "deployments"))
	require.Equal(t, []string{"bookinfo"}, clusterCache.RevokedNamespaces(config.DefaultClusterID))

	// A fetch spanning both namespaces serves only the readable one.
	ws, err := layer.Workload.fetchWorkloadsInNamespaces(context.Background(), config.DefaultClusterID, []string{"bookinfo", "istio-system"}, "", nil)
	require.NoError(t, err)
	require.Len(t, ws, 1)
	require.Equal(t, "istiod", ws[0].Name, "the revoked namespace's stale workloads are not served")

	// A fetch of only the revoked namespace serves nothing, without error.
	ws, err = layer.Workload.fetchWorkloadsInNamespaces(context.Background(), config.DefaultClusterID, []string{"bookinfo"}, "", nil)
	require.NoError(t, err)
	require.Empty(t, ws)
}

// A partially-revoked namespace is excluded from the istio-config and services paths too:
// without these guards the frozen pre-revocation informer snapshot would be served as
// healthy data. A readable namespace passes through unchanged. Partial revocations only
// exist without cluster-wide access (the cluster-scoped review of cluster-wide access
// cannot deny a single namespace), so the test runs in that mode.
func TestRevokedNamespaceExcludedFromIstioConfigAndServices(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo", "istio-system"}
	conf.ExternalServices.Istio.IstioAPIEnabled = false

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("istio-system"),
		&networking_v1.VirtualService{ObjectMeta: metav1.ObjectMeta{Name: "bookinfo-vs", Namespace: "bookinfo"}},
		&networking_v1.VirtualService{ObjectMeta: metav1.ObjectMeta{Name: "istio-vs", Namespace: "istio-system"}},
		&core_v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "ratings", Namespace: "bookinfo", Labels: map[string]string{"app": "ratings"}}},
		&core_v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "istiod", Namespace: "istio-system", Labels: map[string]string{"app": "istiod"}}},
	)
	// The user-RBAC list filter (#10516) consults SSARs; the fake denies them
	// unless a test opts in, which would empty the filtered list.
	k8s.AllowAllSelfSubjectAccessReviews()

	// bookinfo is denied while istio-system stays readable: a partial revocation.
	clients := map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s}
	clusterCache, access, err := cachetest.NewFakeKialiCache(context.Background(), conf, clients,
		func(context.Context, string, string, string) (cache.DeniedAccess, error) {
			return cache.DeniedAccess{Namespaces: []string{"bookinfo"}}, nil
		})
	require.NoError(t, err)
	layer := NewLayerBuilder(t, conf).WithClient(k8s).WithCache(clusterCache).Build()
	require.False(t, access.ConfirmRevoked(context.Background(), config.DefaultClusterID, "apps", "deployments"))
	require.Equal(t, []string{"bookinfo"}, clusterCache.RevokedNamespaces(config.DefaultClusterID))

	criteria := IstioConfigCriteria{IncludeVirtualServices: true}

	// The revoked namespace serves the empty istio config list, not the frozen snapshot.
	cfgs, err := layer.IstioConfig.GetIstioConfigListForNamespace(context.Background(), config.DefaultClusterID, "bookinfo", criteria)
	require.NoError(t, err)
	require.Empty(t, cfgs.VirtualServices, "the revoked namespace's frozen config is not served")

	// A readable namespace passes through unchanged.
	cfgs, err = layer.IstioConfig.GetIstioConfigListForNamespace(context.Background(), config.DefaultClusterID, "istio-system", criteria)
	require.NoError(t, err)
	require.Len(t, cfgs.VirtualServices, 1, "the readable namespace's config is served")
	require.Equal(t, "istio-vs", cfgs.VirtualServices[0].Name)

	// The cluster-wide istio config list filters the revoked namespace out.
	cfgs, err = layer.IstioConfig.GetIstioConfigList(context.Background(), config.DefaultClusterID, criteria)
	require.NoError(t, err)
	require.Len(t, cfgs.VirtualServices, 1, "the cluster-wide list excludes the revoked namespace")
	require.Equal(t, "istio-vs", cfgs.VirtualServices[0].Name)

	// The revoked namespace serves the empty service list, not the frozen snapshot.
	svcCriteria := ServiceCriteria{Cluster: config.DefaultClusterID, Namespace: "bookinfo", IncludeHealth: false, IncludeOnlyDefinitions: true}
	svcs, err := layer.Svc.getServiceListForCluster(context.Background(), svcCriteria, config.DefaultClusterID)
	require.NoError(t, err)
	require.Empty(t, svcs.Services, "the revoked namespace's frozen services are not served")

	// A readable namespace passes through unchanged.
	svcCriteria.Namespace = "istio-system"
	svcs, err = layer.Svc.getServiceListForCluster(context.Background(), svcCriteria, config.DefaultClusterID)
	require.NoError(t, err)
	require.Len(t, svcs.Services, 1, "the readable namespace's services are served")
	require.Equal(t, "istiod", svcs.Services[0].Name)
}

// recordingNamespaceReader records the namespace of every List call it serves.
type recordingNamespaceReader struct {
	ctrlclient.Reader
	mu         sync.Mutex
	namespaces []string
}

func (r *recordingNamespaceReader) List(ctx context.Context, list ctrlclient.ObjectList, opts ...ctrlclient.ListOption) error {
	for _, opt := range opts {
		if ns, ok := opt.(ctrlclient.InNamespace); ok {
			r.mu.Lock()
			r.namespaces = append(r.namespaces, string(ns))
			r.mu.Unlock()
		}
	}
	return r.Reader.List(ctx, list, opts...)
}

func (r *recordingNamespaceReader) listedNamespaces() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.namespaces)
}

// In non-cluster-wide-access mode the cluster-wide istio-config and services fetches must
// list one accessible namespace at a time: a list across all namespaces waits for every
// scoped namespace's informer to sync, and an informer for a namespace Kiali is forbidden
// from never syncs - the whole list would stall for the read timeout and then fail. This
// pins the structure (no NamespaceAll list reaches the cache) and that revoked namespaces
// are not listed at all.
func TestClusterWideFetchesListPerNamespace(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo", "istio-system"}
	conf.ExternalServices.Istio.IstioAPIEnabled = false

	k8s := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("istio-system"),
		&networking_v1.VirtualService{ObjectMeta: metav1.ObjectMeta{Name: "bookinfo-vs", Namespace: "bookinfo"}},
		&networking_v1.VirtualService{ObjectMeta: metav1.ObjectMeta{Name: "istio-vs", Namespace: "istio-system"}},
		&core_v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "ratings", Namespace: "bookinfo", Labels: map[string]string{"app": "ratings"}}},
		&core_v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "istiod", Namespace: "istio-system", Labels: map[string]string{"app": "istiod"}}},
	)
	recording := &recordingNamespaceReader{Reader: k8s}

	// bookinfo is denied while istio-system stays readable: a partial revocation. The
	// cache is built directly (not via cachetest) so the recording reader can serve it.
	access := cache.NewClusterAccess(func(context.Context, string, string, string) (cache.DeniedAccess, error) {
		return cache.DeniedAccess{Namespaces: []string{"bookinfo"}}, nil
	})
	clients := map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s}
	clusterCache, err := cache.NewKialiCache(context.Background(), clients,
		map[string]ctrlclient.Reader{config.DefaultClusterID: recording}, *conf, cache.WithClusterAccess(access))
	require.NoError(t, err)
	layer := NewLayerBuilder(t, conf).WithClient(k8s).WithCache(clusterCache).Build()
	require.False(t, access.ConfirmRevoked(context.Background(), config.DefaultClusterID, "apps", "deployments"))

	_, err = layer.IstioConfig.GetIstioConfigList(context.Background(), config.DefaultClusterID, IstioConfigCriteria{IncludeVirtualServices: true})
	require.NoError(t, err)
	_, err = layer.Svc.getServiceListForCluster(context.Background(), ServiceCriteria{Cluster: config.DefaultClusterID, IncludeHealth: false}, config.DefaultClusterID)
	require.NoError(t, err)

	listed := recording.listedNamespaces()
	require.NotEmpty(t, listed, "the fetches listed per namespace")
	for _, namespace := range listed {
		require.NotEmpty(t, namespace, "no list spans all namespaces")
		require.NotEqual(t, "bookinfo", namespace, "the revoked namespace is never listed")
	}
	require.Contains(t, listed, "istio-system", "the readable namespace is listed")

	// The multi-namespace workload fetch and the ztunnel detection list per namespace too.
	// The low-level workload fetch does not filter revoked namespaces itself - that is
	// fetchWorkloadsInNamespaces's job - so it lists bookinfo, but still never NamespaceAll.
	_, err = layer.Workload.fetchWorkloadsFromCluster(context.Background(), config.DefaultClusterID, []string{"bookinfo", "istio-system"}, "", nil)
	require.NoError(t, err)
	clusterCache.IsAmbientEnabled(config.DefaultClusterID)

	for _, namespace := range recording.listedNamespaces()[len(listed):] {
		require.NotEmpty(t, namespace, "no list spans all namespaces")
	}

	// The on-demand single-object validation (the details page and the post-edit
	// re-validation) fetches its config across the cluster too: it must go through the
	// same per-namespace scope, never a NamespaceAll list, and must not list the
	// revoked namespace.
	listed = recording.listedNamespaces()
	_, _, err = layer.Validations.ValidateIstioObject(context.Background(), config.DefaultClusterID, "istio-system", kubernetes.VirtualServices, "istio-vs")
	require.NoError(t, err)
	validationListed := recording.listedNamespaces()[len(listed):]
	require.NotEmpty(t, validationListed, "the validation fetched its inputs (it did not bail out early)")
	for _, namespace := range validationListed {
		require.NotEmpty(t, namespace, "no list spans all namespaces")
		require.NotEqual(t, "bookinfo", namespace, "the revoked namespace is never listed")
	}
}
