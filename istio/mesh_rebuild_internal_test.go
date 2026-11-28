package istio

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	kubefake "k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/certtest"
)

// meshClusterClient builds a single-cluster fixture whose cluster name is carried by
// the istiod deployment's CLUSTER_ID env var, so the mesh resolution associates the
// control plane with the given cluster.
func meshClusterClient(cluster string) *kubetest.FakeK8sClient {
	return kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("istio-system"),
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "istiod",
				Namespace: "istio-system",
				Labels: map[string]string{
					"app":                     "istiod",
					config.IstioRevisionLabel: "default",
				},
			},
			Spec: appsv1.DeploymentSpec{
				Template: corev1.PodTemplateSpec{
					Spec: corev1.PodSpec{
						Containers: []corev1.Container{
							{
								Name: "discovery",
								Env: []corev1.EnvVar{
									{Name: "CLUSTER_ID", Value: cluster},
								},
							},
						},
					},
				},
			},
		},
		&corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "istio",
				Namespace: "istio-system",
				Labels:    map[string]string{config.IstioRevisionLabel: "default"},
			},
			Data: map[string]string{"mesh": "rootNamespace: istio-system\n"},
		},
		certtest.FakeIstioCertificateConfigMap("istio-system"),
	)
}

// blockNamespaceLists parks every deployments list on the given client until the
// returned release channel is closed, signaling each entry through entered.
func blockNamespaceLists(k8s *kubetest.FakeK8sClient, entered, release chan struct{}) {
	k8s.KubeClientset.(*kubefake.Clientset).PrependReactor("list", "namespaces",
		func(action k8stesting.Action) (bool, runtime.Object, error) {
			select {
			case <-entered:
			default:
				close(entered)
			}
			<-release
			// Fall through to the fake's stocked objects.
			return false, nil, nil
		})
}

// TestMeshServesRetainedMeshWhileRebuildInFlight verifies the stale-while-revalidate
// contract: once a mesh has been built, a caller that misses the mesh cache is served
// the retained mesh immediately while the rebuild refreshes the cache in the background.
// Before this, every caller queued on a mutex held for the whole rebuild, so a rebuild
// stalled on an unreachable remote held every mesh-dependent request behind it.
func TestMeshServesRetainedMeshWhileRebuildInFlight(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	// A zero mesh TTL makes the mesh cache permanently miss while SetMesh still retains
	// the mesh for LastMesh (see store.NewExpirationStore): a deterministic stand-in for
	// the moment the mesh cache entry expires.
	conf.KialiInternal.CacheExpiration.Mesh = 0
	k8s := meshClusterClient(conf.KubernetesConfig.ClusterName)
	kialiCache := cache.NewTestingCache(t, k8s, *conf)
	discovery := NewDiscovery(map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}, kialiCache, conf)

	mesh1, err := discovery.Mesh(context.Background())
	require.NoError(err)
	require.Len(mesh1.ControlPlanes, 1)

	entered := make(chan struct{})
	release := make(chan struct{})
	blockNamespaceLists(k8s, entered, release)
	t.Cleanup(func() {
		select {
		case <-release:
		default:
			close(release)
		}
	})

	start := time.Now()
	served, err := discovery.Mesh(context.Background())
	require.NoError(err)
	require.Same(mesh1, served, "the retained mesh must be served while the rebuild is in flight")
	require.Less(int64(time.Since(start)), int64(100*time.Millisecond),
		"serving the retained mesh must not wait for the in-flight rebuild")

	// The background rebuild has started and is parked on the blocked list; the retained
	// mesh is still the one the leader built before.
	<-entered
	require.Same(mesh1, kialiCache.LastMesh(), "the blocked rebuild must not have published a fresh mesh")

	close(release)
	require.Eventually(func() bool {
		return kialiCache.LastMesh() != mesh1
	}, 5*time.Second, 20*time.Millisecond, "the background rebuild must publish a fresh mesh")
}

// TestMeshColdStartWaitsForInFlightRebuild verifies the cold-start path: before the
// first mesh exists, a caller that finds a rebuild already running waits for it (bounded
// by its own context) rather than starting a second one, and both callers end up with
// the mesh that rebuild produced.
func TestMeshColdStartWaitsForInFlightRebuild(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	k8s := meshClusterClient(conf.KubernetesConfig.ClusterName)
	kialiCache := cache.NewTestingCache(t, k8s, *conf)
	discovery := NewDiscovery(map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: k8s}, kialiCache, conf)

	entered := make(chan struct{})
	release := make(chan struct{})
	blockNamespaceLists(k8s, entered, release)
	t.Cleanup(func() {
		select {
		case <-release:
		default:
			close(release)
		}
	})

	type result struct {
		mesh *models.Mesh
		err  error
	}
	results := make(chan result, 2)
	call := func() {
		mesh, err := discovery.Mesh(context.Background())
		results <- result{mesh: mesh, err: err}
	}

	// The first caller leads the initial rebuild and parks on the blocked list.
	go call()
	<-entered

	// The second caller, with no retained mesh to serve, waits for the in-flight rebuild.
	go call()
	time.Sleep(50 * time.Millisecond)

	close(release)

	first := <-results
	second := <-results
	require.NoError(first.err)
	require.NoError(second.err)
	require.NotNil(first.mesh)
	require.NotNil(second.mesh)
	require.Same(first.mesh, second.mesh, "both cold-start callers must receive the mesh the single rebuild produced")
}

// TestMeshResolvesHomeClusterFirstWhenRemoteIsSlow verifies the home-starvation fix:
// the rebuild resolves the home cluster before any remote, so a remote whose scan
// outlasts the resolve budget cannot spend the budget ahead of the mandatory cluster
// and make the home resolution fail with a spurious context-deadline error. Before
// this, the cluster iteration order came from a map, so map order decided whether a
// dead remote starved the home cluster.
func TestMeshResolvesHomeClusterFirstWhenRemoteIsSlow(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	conf.ExternalServices.Istio.IstioAPIEnabled = false

	// Shorten the resolve budget: the remote's hang below exceeds it, standing in for
	// a dead remote's request timeouts in production. The budget is configurable
	// (kiali_internal.kubernetes_client.mesh_resolve_timeout); set it on the conf.
	conf.KialiInternal.KubernetesClient.MeshResolveTimeout = 200 * time.Millisecond

	homeK8s := meshClusterClient("east")
	remoteK8s := meshClusterClient("west")

	var mu sync.Mutex
	var order []string
	homeK8s.KubeClientset.(*kubefake.Clientset).PrependReactor("list", "namespaces",
		func(action k8stesting.Action) (bool, runtime.Object, error) {
			mu.Lock()
			order = append(order, "east")
			mu.Unlock()
			return false, nil, nil
		})
	remoteK8s.KubeClientset.(*kubefake.Clientset).PrependReactor("list", "namespaces",
		func(action k8stesting.Action) (bool, runtime.Object, error) {
			mu.Lock()
			order = append(order, "west")
			mu.Unlock()
			// Outlasts the resolve budget, like a dead remote's timeouts.
			time.Sleep(300 * time.Millisecond)
			return false, nil, nil
		})

	clients := map[string]kubernetes.ClientInterface{"east": homeK8s, "west": remoteK8s}
	kialiCache := cache.NewTestingCacheWithClients(t, clients, *conf)
	discovery := NewDiscovery(clients, kialiCache, conf)

	mesh, err := discovery.Mesh(context.Background())
	require.NoError(err, "a slow remote must not fail the mesh resolution")

	var homeResolved bool
	for _, cp := range mesh.ControlPlanes {
		if cp.Cluster.Name == "east" {
			homeResolved = true
		}
	}
	require.True(homeResolved, "the home cluster's control plane must be resolved despite the slow remote")

	mu.Lock()
	defer mu.Unlock()
	require.NotEmpty(order)
	require.Equal("east", order[0], "the home cluster must be resolved before a slow remote")
}
