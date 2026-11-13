package business

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	clientsetfake "k8s.io/client-go/kubernetes/fake"
	kubeclienttesting "k8s.io/client-go/testing"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

// Namespace service setup
func setupNamespaceService(t *testing.T, k8s kubernetes.UserClientInterface, conf *config.Config) NamespaceService {
	cache := cache.NewTestingCache(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(k8sclients), cache, conf)
	return NewNamespaceService(cache, conf, discovery, kubernetes.ConvertFromUserClients(k8sclients), k8sclients)
}

// Namespace service setup
func setupNamespaceServiceWithNs() *kubetest.FakeK8sClient {
	// config needs to be set by other services since those rely on the global.
	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("alpha"),
		kubetest.FakeNamespace("beta"),
	}
	for _, obj := range fakeNamespaces() {
		o := obj
		objects = append(objects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = false
	return k8s
}

// Namespace service setup
func setupAmbientNamespaceServiceWithNs() kubernetes.UserClientInterface {
	labels := map[string]string{
		config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
	}
	// config needs to be set by other services since those rely on the global.
	objects := []runtime.Object{
		kubetest.FakeNamespaceWithLabels("bookinfo", labels),
		kubetest.FakeNamespace("alpha"),
		kubetest.FakeNamespace("beta"),
	}
	for _, obj := range fakeNamespaces() {
		o := obj
		objects = append(objects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = false
	return k8s
}

// Project service setup
func setupAmbientProjectWithNs() kubernetes.UserClientInterface {
	labels := map[string]string{
		config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
	}
	// config needs to be set by other services since those rely on the global.
	objects := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo", Labels: labels}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "alpha"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "beta"}},
	}
	for _, obj := range fakeNamespaces() {
		o := obj
		objects = append(objects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = true
	return k8s
}

// Get namespaces
func TestGetNamespaces(t *testing.T) {
	conf := config.NewConfig()

	k8s := setupNamespaceServiceWithNs()

	nsservice := setupNamespaceService(t, k8s, conf)

	ns, _ := nsservice.GetNamespaces(context.TODO())

	assert.NotNil(t, ns)
	assert.Equal(t, len(ns), 5)
	assert.Equal(t, ns[0].Name, "alpha")
}

// forbidGetNamespace returns a reactor that rejects Get for the named namespace with a Forbidden error.
func forbidGetNamespace(name string) func(kubeclienttesting.Action) (bool, runtime.Object, error) {
	return func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
		if ga, ok := action.(kubeclienttesting.GetAction); ok && ga.GetName() == name {
			return true, nil, errors.NewForbidden(core_v1.Resource("namespaces"), name, fmt.Errorf("forbidden"))
		}
		return false, nil, nil
	}
}

// forbidListNamespaces returns a reactor that rejects List for namespaces with a Forbidden error.
func forbidListNamespaces() func(kubeclienttesting.Action) (bool, runtime.Object, error) {
	return func(_ kubeclienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.NewForbidden(core_v1.Resource("namespaces"), "", fmt.Errorf("forbidden"))
	}
}

// nsNames extracts the sorted list of namespace names from a namespace slice.
func nsNames(nss []models.Namespace) []string {
	names := make([]string, len(nss))
	for i, n := range nss {
		names[i] = n.Name
	}
	return names
}

// With require_namespace_get and cluster-wide access, namespaces returned from list are kept only when the user may get each Namespace object.
func TestGetNamespacesRequireNamespaceGetFiltersToGetPermission(t *testing.T) {
	conf := config.NewConfig()
	conf.KialiFeatureFlags.Authz.RequireNamespaceGet = true

	saClient := setupNamespaceServiceWithNs()
	saClient.Token = "sa-token"

	userClient := setupNamespaceServiceWithNs()
	userClient.Token = "user-token"
	cs := userClient.KubeClientset.(*clientsetfake.Clientset)
	cs.PrependReactor("get", "namespaces", forbidGetNamespace("beta"))

	saClients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: saClient}
	userClients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: userClient}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	ns, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"alpha", "bookinfo", "test", "test2"}, nsNames(ns))
}

// When require_namespace_get is false, a successful namespace list is not filtered by per-namespace get (legacy behavior).
func TestGetNamespacesRequireNamespaceGetDisabledTrustsList(t *testing.T) {
	conf := config.NewConfig()
	require.False(t, conf.KialiFeatureFlags.Authz.RequireNamespaceGet)

	saClient := setupNamespaceServiceWithNs()
	saClient.Token = "sa-token"

	userClient := setupNamespaceServiceWithNs()
	userClient.Token = "user-token"
	cs := userClient.KubeClientset.(*clientsetfake.Clientset)
	cs.PrependReactor("get", "namespaces", forbidGetNamespace("beta"))

	saClients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: saClient}
	userClients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: userClient}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	ns, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"alpha", "beta", "bookinfo", "test", "test2"}, nsNames(ns))
}

// When require_namespace_get is false and user List succeeds, namespaces the user can
// see but the Kiali SA cannot must be excluded (intersection with SA list).
func TestGetNamespacesNonStrictIntersectsWithSAList(t *testing.T) {
	conf := config.NewConfig()
	require.False(t, conf.KialiFeatureFlags.Authz.RequireNamespaceGet)

	// SA can see bookinfo and alpha only.
	saClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("alpha"),
	)
	saClient.Token = "sa-token"

	// User can see bookinfo, alpha, and extra (SA does not have extra).
	userClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("alpha"),
		kubetest.FakeNamespace("extra"),
	)
	userClient.Token = "user-token"

	saClients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: saClient}
	userClients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: userClient}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	ns, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"alpha", "bookinfo"}, nsNames(ns))
}

// When require_namespace_get is false and user List returns Forbidden, the code falls
// through to filterToNamespacesUserCanGet which keeps only namespaces the
// user can individually Get.
func TestGetNamespacesNonStrictForbiddenListFallsBackToGet(t *testing.T) {
	conf := config.NewConfig()
	require.False(t, conf.KialiFeatureFlags.Authz.RequireNamespaceGet)

	// SA client can list all three namespaces.
	saClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("alpha"),
		kubetest.FakeNamespace("beta"),
	)
	saClient.Token = "sa-token"

	// User client: list is forbidden, individual get succeeds except for beta.
	userClient := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("alpha"),
		kubetest.FakeNamespace("beta"),
	)
	userClient.Token = "user-token"
	userCS := userClient.KubeClientset.(*clientsetfake.Clientset)
	userCS.PrependReactor("list", "namespaces", forbidListNamespaces())
	userCS.PrependReactor("get", "namespaces", forbidGetNamespace("beta"))

	saClients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: saClient}
	userClients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: userClient}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	ns, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"alpha", "bookinfo"}, nsNames(ns))
}

// A non-forbidden Get error (e.g. InternalError) in filterToNamespacesUserCanGet
// must propagate up and fail the entire GetNamespaces call.
func TestGetNamespacesGetInternalErrorPropagates(t *testing.T) {
	conf := config.NewConfig()
	conf.KialiFeatureFlags.Authz.RequireNamespaceGet = true

	saClient := setupNamespaceServiceWithNs()
	saClient.Token = "sa-token"

	userClient := setupNamespaceServiceWithNs()
	userClient.Token = "user-token"
	cs := userClient.KubeClientset.(*clientsetfake.Clientset)
	cs.PrependReactor("get", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
		if ga, ok := action.(kubeclienttesting.GetAction); ok && ga.GetName() == "beta" {
			return true, nil, errors.NewInternalError(fmt.Errorf("apiserver down"))
		}
		return false, nil, nil
	})

	saClients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: saClient}
	userClients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: userClient}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	_, err := nsservice.GetNamespaces(context.TODO())
	require.Error(t, err)
	assert.True(t, errors.IsInternalError(err))
}

// A home-cluster LIST error must fail GetNamespaces, while a remote-cluster
// LIST error is skipped (picker semantics) and the home cluster's namespaces
// are still returned.
func TestGetNamespacesListErrorHomeFailsRemoteSkipped(t *testing.T) {
	cases := map[string]struct {
		failingCluster string
		expectedErr    bool
		expectedNS     []string
	}{
		"home cluster list error fails the request": {
			failingCluster: "east",
			expectedErr:    true,
		},
		"remote cluster list error is skipped": {
			failingCluster: "west",
			expectedErr:    false,
			expectedNS:     []string{"bookinfo"},
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "east"

			// In cluster-wide-access mode the accessible set is the intersection
			// of the SA list and the user list, so the SA must also see bookinfo.
			saClients := map[string]kubernetes.ClientInterface{
				"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
				"west": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
			}

			// Distinct cache keys keep the SA-identity shortcut in
			// getNamespacesUsingKialiSA from serving the SA's unfiltered list.
			userEast := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
			userEast.CacheKey = "east-user"
			userWest := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
			userWest.CacheKey = "west-user"
			userClients := map[string]kubernetes.UserClientInterface{
				"east": userEast,
				"west": userWest,
			}

			// The failing cluster's LIST returns an internal error, the kind
			// that must not be swallowed into an empty result.
			failingCS := userClients[tc.failingCluster].(*kubetest.FakeK8sClient).KubeClientset.(*clientsetfake.Clientset)
			failingCS.PrependReactor("list", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
				return true, nil, errors.NewInternalError(fmt.Errorf("apiserver down"))
			})

			kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
			discovery := istio.NewDiscovery(saClients, kialiCache, conf)
			nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

			namespaces, err := nsservice.GetNamespaces(context.TODO())
			if tc.expectedErr {
				require.Error(err)
				require.True(errors.IsInternalError(err))
				return
			}
			require.NoError(err)
			require.ElementsMatch(tc.expectedNS, nsNames(namespaces))
		})
	}
}

// GetClusterNamespacesForCluster propagates a remote cluster's set-computation
// error, unlike GetNamespaces (picker semantics), which skips it: callers use
// this lookup when the answer is load-bearing (e.g. session validation must be
// able to distinguish "cannot determine" from "zero access").
func TestGetClusterNamespacesForClusterPropagatesRemoteErrors(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	// In cluster-wide-access mode the accessible set is the intersection of the
	// SA list and the user list, so the SA must also see bookinfo — and the SA
	// side stays healthy: only the user's LIST on the remote cluster fails.
	saClients := map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
		"west": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	}

	// Distinct cache keys keep the SA-identity shortcut in
	// getNamespacesUsingKialiSA from serving the SA's unfiltered list.
	userEast := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	userEast.CacheKey = "east-user"
	userWest := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	userWest.CacheKey = "west-user"
	userClients := map[string]kubernetes.UserClientInterface{
		"east": userEast,
		"west": userWest,
	}

	westCS := userWest.KubeClientset.(*clientsetfake.Clientset)
	westCS.PrependReactor("list", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.NewInternalError(fmt.Errorf("apiserver down"))
	})

	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	// The aggregate skips the failing remote cluster (picker semantics)...
	namespaces, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(err)
	require.ElementsMatch([]string{"bookinfo"}, nsNames(namespaces))

	// ...while the per-cluster lookup propagates its error, for the cluster it
	// was asked about, home or remote.
	_, err = nsservice.GetClusterNamespacesForCluster(context.TODO(), "west")
	require.Error(err)
	require.True(errors.IsInternalError(err))
}

// Get namespace
func TestGetNamespace(t *testing.T) {
	conf := config.NewConfig()

	k8s := setupNamespaceServiceWithNs()

	nsservice := setupNamespaceService(t, k8s, conf)

	ns, _ := nsservice.GetClusterNamespace(context.TODO(), "bookinfo", config.Get().KubernetesConfig.ClusterName)

	assert.NotNil(t, ns)
	assert.Equal(t, ns.Name, "bookinfo")
}

// Get namespace error
func TestGetNamespaceWithError(t *testing.T) {
	conf := config.NewConfig()

	k8s := setupNamespaceServiceWithNs()

	nsservice := setupNamespaceService(t, k8s, conf)

	ns2, err := nsservice.GetClusterNamespace(context.TODO(), "fakeNS", config.Get().KubernetesConfig.ClusterName)

	assert.NotNil(t, err)
	assert.Nil(t, ns2)
}

// Get Ambient namespace
func TestAmbientNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	k8s := setupAmbientNamespaceServiceWithNs()

	nsservice := setupNamespaceService(t, k8s, conf)

	ns, _ := nsservice.GetClusterNamespace(context.TODO(), "bookinfo", config.Get().KubernetesConfig.ClusterName)

	assert.NotNil(t, ns)
	assert.Equal(t, ns.Name, "bookinfo")
	assert.True(t, ns.IsAmbient)

	ns2, _ := nsservice.GetClusterNamespace(context.TODO(), "alpha", config.Get().KubernetesConfig.ClusterName)

	assert.NotNil(t, ns2)
	assert.Equal(t, ns2.Name, "alpha")
	assert.False(t, ns2.IsAmbient)
}

// Get Ambient namespace
func TestAmbientProject(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	k8s := setupAmbientProjectWithNs()

	nsservice := setupNamespaceService(t, k8s, conf)

	ns, _ := nsservice.GetClusterNamespace(context.TODO(), "bookinfo", config.Get().KubernetesConfig.ClusterName)

	assert.NotNil(t, ns)
	assert.Equal(t, ns.Name, "bookinfo")
	assert.True(t, ns.IsAmbient)

	ns2, _ := nsservice.GetClusterNamespace(context.TODO(), "alpha", config.Get().KubernetesConfig.ClusterName)

	assert.NotNil(t, ns2)
	assert.Equal(t, ns2.Name, "alpha")
	assert.False(t, ns2.IsAmbient)
}

// Update namespaces
func TestUpdateNamespaces(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	k8s := setupNamespaceServiceWithNs()

	nsservice := setupNamespaceService(t, k8s, conf)

	ns, err := nsservice.UpdateNamespace(context.TODO(), "bookinfo", `{"metadata": {"labels": {"new": "label"}}}`, conf.KubernetesConfig.ClusterName)

	assert.Nil(t, err)
	assert.NotNil(t, ns)
	assert.Equal(t, ns.Name, "bookinfo")
}

func TestMultiClusterGetNamespace(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	clients := map[string]kubernetes.UserClientInterface{
		"east": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
		),
		"west": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
		),
	}
	cache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(clients), *conf)

	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(clients), cache, conf)
	nsservice := NewNamespaceService(cache, conf, discovery, kubernetes.ConvertFromUserClients(clients), clients)

	ns, err := nsservice.GetClusterNamespace(context.TODO(), "bookinfo", conf.KubernetesConfig.ClusterName)
	require.NoError(err)

	assert.Equal(t, conf.KubernetesConfig.ClusterName, ns.Cluster)
}

func TestMultiClusterGetNamespaces(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	clients := map[string]kubernetes.UserClientInterface{
		"east": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
		),
		"west": kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace("bookinfo"),
		),
	}
	cache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(clients), *conf)

	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(clients), cache, conf)
	nsservice := NewNamespaceService(cache, conf, discovery, kubernetes.ConvertFromUserClients(clients), clients)
	namespaces, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(err)

	require.Len(namespaces, 2)
	var clusterNames []string
	for _, ns := range namespaces {
		clusterNames = append(clusterNames, ns.Cluster)
	}

	assert.Contains(clusterNames, "east")
	assert.Contains(clusterNames, "west")
}

func TestGetNamespacesCached(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 600000

	k8s := setupNamespaceServiceWithNs()

	clients := map[string]kubernetes.UserClientInterface{
		"east": k8s,
		"west": kubetest.NewFakeK8sClient(),
	}
	cache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(clients), *conf)
	// gamma only exists in the cache.
	cache.SetClusterNamespaces(k8s.GetToken(), "east", []models.Namespace{{Name: "bookinfo", Cluster: "east"}, {Name: "alpha", Cluster: "east"}, {Name: "beta", Cluster: "east"}})
	cache.SetClusterNamespaces(k8s.GetToken(), "west", []models.Namespace{{Name: "gamma", Cluster: "west"}})

	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(clients), cache, conf)
	nsservice := NewNamespaceService(cache, conf, discovery, kubernetes.ConvertFromUserClients(clients), clients)
	namespaces, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(err)

	// There's actually 6 namespaces with 'test' and 'test1' but only 4 are cached.
	require.Len(namespaces, 4)

	namespace, err := nsservice.GetClusterNamespace(context.TODO(), "gamma", "west")
	require.NoError(err)

	assert.Equal("west", namespace.Cluster)
}

func TestGetNamespacesDifferentTokens(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 600000

	east := setupNamespaceServiceWithNs()
	east.Token = "east-token"
	west := kubetest.NewFakeK8sClient()
	west.Token = "west-token"

	clients := map[string]kubernetes.UserClientInterface{
		"east": east,
		"west": west,
	}
	cache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(clients), *conf)
	cache.SetClusterNamespaces(east.GetToken(), "east", []models.Namespace{{Name: "bookinfo", Cluster: "east"}, {Name: "alpha", Cluster: "east"}, {Name: "beta", Cluster: "east"}})
	cache.SetClusterNamespaces(west.GetToken(), "west", []models.Namespace{{Name: "gamma", Cluster: "west"}})

	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(clients), cache, conf)
	nsservice := NewNamespaceService(cache, conf, discovery, kubernetes.ConvertFromUserClients(clients), clients)
	namespaces, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(err)

	// There's actually 6 namespaces with 'test' and 'test1' but only 4 are cached.
	require.Len(namespaces, 4)

	namespace, err := nsservice.GetClusterNamespace(context.TODO(), "gamma", "west")
	require.NoError(err)

	assert.Equal("west", namespace.Cluster)

	namespace, err = nsservice.GetClusterNamespace(context.TODO(), "bookinfo", "east")
	require.NoError(err)

	assert.Equal("east", namespace.Cluster)
}

func TestGetKialiSAClusterList(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	// User only has access to "east"
	userClients := map[string]kubernetes.UserClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	}

	// Kiali SA has access to both "east" and "west"
	saEast := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	saWest := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	saClients := map[string]kubernetes.ClientInterface{
		"east": saEast,
		"west": saWest,
	}

	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	// GetClusterList should return only user clusters
	userClusters := nsservice.GetClusterList()
	require.Len(userClusters, 1)
	require.Contains(userClusters, "east")

	// GetKialiSAClusterList should return all SA clusters
	saClusters := nsservice.GetKialiSAClusterList()
	require.Len(saClusters, 2)
	require.Contains(saClusters, "east")
	require.Contains(saClusters, "west")
}

func TestGetKialiSAClusterNamespaces(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	// User only has access to bookinfo
	userEast := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	userEast.Token = "user-token"
	userClients := map[string]kubernetes.UserClientInterface{
		"east": userEast,
	}

	// Kiali SA has access to bookinfo, alpha, and beta
	saEast := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("alpha"),
		kubetest.FakeNamespace("beta"),
	)
	saEast.Token = "sa-token"
	saClients := map[string]kubernetes.ClientInterface{
		"east": saEast,
	}

	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	// User namespaces should only include bookinfo
	userNs, err := nsservice.GetClusterNamespaces(context.TODO(), "east")
	require.NoError(err)
	require.Len(userNs, 1)
	require.Equal("bookinfo", userNs[0].Name)

	// SA namespaces should include all three
	saNs, err := nsservice.GetKialiSAClusterNamespaces(context.TODO(), "east")
	require.NoError(err)
	require.Len(saNs, 3)

	saNames := make([]string, 0, len(saNs))
	for _, ns := range saNs {
		saNames = append(saNames, ns.Name)
	}
	require.Contains(saNames, "bookinfo")
	require.Contains(saNames, "alpha")
	require.Contains(saNames, "beta")
}

func TestGetKialiSAClusterNamespacesCached(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 600000

	userEast := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	userEast.Token = "user-token"
	userClients := map[string]kubernetes.UserClientInterface{
		"east": userEast,
	}

	saEast := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	saEast.Token = "sa-token"
	saClients := map[string]kubernetes.ClientInterface{
		"east": saEast,
	}

	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)

	// Pre-populate cache with SA namespaces (including "gamma" which isn't in the actual client).
	// The SA set is cached under its own prefixed key (see GetKialiSAClusterNamespaces).
	kialiCache.SetClusterNamespaces(
		"kiali-sa:"+saEast.GetToken(),
		"east",
		[]models.Namespace{
			{Name: "bookinfo", Cluster: "east"},
			{Name: "gamma", Cluster: "east"},
		},
	)

	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	// Should return the cached SA namespaces, including "gamma"
	saNs, err := nsservice.GetKialiSAClusterNamespaces(context.TODO(), "east")
	require.NoError(err)
	require.Len(saNs, 2)

	saNames := make([]string, 0, len(saNs))
	for _, ns := range saNs {
		saNames = append(saNames, ns.Name)
	}
	require.Contains(saNames, "bookinfo")
	require.Contains(saNames, "gamma")
}

func TestGetKialiSAClusterNamespacesUnknownCluster(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	userClients := map[string]kubernetes.UserClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	}
	saClients := map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	}

	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	_, err := nsservice.GetKialiSAClusterNamespaces(context.TODO(), "unknown")
	require.Error(err)
}

// Tests that GetClusterNamespace won't return a namespace with the same name
// from another cluster if the namespace is not in the user's accessible set
// for that cluster, even when the namespace is cached (visible) for another
// cluster the user can access and exists on the denied cluster (the SA can
// see it there).
func TestGetNamespacesForbiddenCached(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	// The SA can see bookinfo on both clusters.
	saClients := map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
		"west": kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo")),
	}

	// The user can only see bookinfo on west: their east LIST is empty. The
	// distinct cache key prevents the SA-identity shortcut in
	// getNamespacesUsingKialiSA from serving the SA's unfiltered list.
	userEast := kubetest.NewFakeK8sClient()
	userEast.CacheKey = "restricted-user"
	userWest := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))
	userWest.CacheKey = "west-user"
	userClients := map[string]kubernetes.UserClientInterface{
		"east": userEast,
		"west": userWest,
	}

	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	// The namespace is in the user's accessible set on west...
	_, err := nsservice.GetClusterNamespace(context.TODO(), "bookinfo", "west")
	require.NoError(err)
	// ...but must not be returned for east, where the user's accessible set
	// is empty even though the namespace exists there (the SA sees it).
	_, err = nsservice.GetClusterNamespace(context.TODO(), "bookinfo", "east")
	require.Error(err)
	require.True(IsAccessibleError(err))
}

// Tests that you can list namespaces when you have one openshift and one vanilla cluster.
// See https://github.com/kiali/kiali/issues/7665.
func TestMixedClustersNoError(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "openshift"
	config.Set(conf)

	openshift := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("alpha"),
	)
	openshift.OpenShift = true
	vanilla := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("beta"),
	)
	vanilla.ProjectFake.PrependReactor("get", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.NewForbidden(core_v1.Resource("namespaces"), "beta", fmt.Errorf("forbidden"))
	})

	clients := map[string]kubernetes.UserClientInterface{
		"openshift": openshift,
		"vanilla":   vanilla,
	}
	cache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(clients), *conf)

	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(clients), cache, conf)
	nsservice := NewNamespaceService(cache, conf, discovery, kubernetes.ConvertFromUserClients(clients), clients)
	namespaces, err := nsservice.GetNamespaces(context.TODO())
	// There's no error for multi-cluster setups. This isn't great but it's how it works.
	require.NoError(err)
	require.Len(namespaces, 2)
	slices.SortFunc(namespaces, func(a models.Namespace, b models.Namespace) int {
		return cmp.Compare(a.Name, b.Name)
	})
	require.Equal("alpha", namespaces[0].Name)
	require.Equal("openshift", namespaces[0].Cluster)
	require.Equal("beta", namespaces[1].Name)
	require.Equal("vanilla", namespaces[1].Cluster)
}

func TestGetNamespacesSameTokenDifferentImpersonation(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 600000

	// Both user clients share the same Token (SA token) but have different CacheKeys
	// (simulating different impersonated users).
	userA := kubetest.NewFakeK8sClient()
	userA.Token = "shared-sa-token"
	userA.CacheKey = "user-a@example.com"

	userB := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "ns-b-only"}},
	)
	userB.Token = "shared-sa-token"
	userB.CacheKey = "user-b@example.com"

	saClient := kubetest.NewFakeK8sClient()
	saClient.Token = "shared-sa-token"

	saClients := map[string]kubernetes.ClientInterface{"east": saClient}

	// Populate cache as user A with a narrow list.
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	kialiCache.SetClusterNamespaces(
		userA.GetCacheKey(),
		"east",
		[]models.Namespace{{Name: "ns-a-only", Cluster: "east"}},
	)

	// Now query as user B — should NOT get user A's cached entry.
	userBClients := map[string]kubernetes.UserClientInterface{"east": userB}
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userBClients)

	namespaces, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(err)

	// User B should get their own namespaces (ns-b-only from the fake client),
	// NOT user A's cached "ns-a-only".
	for _, ns := range namespaces {
		require.NotEqual("ns-a-only", ns.Name, "user B should not see user A's cached namespace")
	}
}

func TestGetNamespacesImpersonationDoesNotSkipRBACIntersection(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	conf.Deployment.ClusterWideAccess = true

	// SA client can see all namespaces.
	saClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "allowed"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "forbidden"}},
	)
	saClient.Token = "shared-sa-token"

	// User client (impersonated) can only see "allowed" via its own LIST.
	// Same SA token but different CacheKey (impersonated username).
	userClient := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "allowed"}},
	)
	userClient.Token = "shared-sa-token"
	userClient.CacheKey = "restricted-user@example.com"

	saClients := map[string]kubernetes.ClientInterface{"east": saClient}
	userClients := map[string]kubernetes.UserClientInterface{"east": userClient}

	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	namespaces, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(err)

	// The user should only see "allowed" — the RBAC intersection must run
	// because GetCacheKey() != GetToken() of the SA.
	names := make([]string, 0, len(namespaces))
	for _, ns := range namespaces {
		names = append(names, ns.Name)
	}
	require.Contains(names, "allowed")
	require.NotContains(names, "forbidden", "impersonated user should not see namespaces beyond their RBAC")
}

// listCallCounter returns a reactor that counts namespace list calls and
// falls through to the underlying fake clientset.
func listCallCounter(count *int) func(kubeclienttesting.Action) (bool, runtime.Object, error) {
	return func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
		if action.GetVerb() == "list" && action.GetResource().Resource == "namespaces" {
			*count++
		}
		return false, nil, nil
	}
}

// getCallCounter returns a reactor that counts namespace get calls and falls
// through to the underlying fake clientset.
func getCallCounter(count *int) func(kubeclienttesting.Action) (bool, runtime.Object, error) {
	return func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
		if action.GetVerb() == "get" && action.GetResource().Resource == "namespaces" {
			*count++
		}
		return false, nil, nil
	}
}

// newAccessibleSetClients builds separate SA and user fake clients. The SA
// client sees all the given namespaces; the user client's LIST is restricted
// to allowedNamespaces (its per-namespace GET still works, so the restriction
// is purely LIST-based). The distinct tokens prevent the SA-identity shortcut
// in getNamespacesUsingKialiSA from serving the SA's unfiltered list.
func newAccessibleSetClients(allNamespaces, allowedNamespaces []string) (sa *kubetest.FakeK8sClient, user *kubetest.NamespaceRestrictedClient) {
	saObjects := make([]runtime.Object, 0, len(allNamespaces))
	for _, name := range allNamespaces {
		saObjects = append(saObjects, kubetest.FakeNamespace(name))
	}
	sa = kubetest.NewFakeK8sClient(saObjects...)
	sa.Token = "sa-token"

	// The user client sees the same objects but its LIST is restricted to the
	// allowed namespaces (no GET denials: the restriction is purely
	// LIST-based). The distinct cache key prevents the SA-identity shortcut
	// in getNamespacesUsingKialiSA from serving the SA's unfiltered list.
	userFake := kubetest.NewFakeK8sClient(saObjects...)
	user = kubetest.NewNamespaceRestrictedClient(userFake, "user-token", allowedNamespaces)
	return sa, user
}

// countingNamespaceService builds a NamespaceService over separate SA and
// user clients (see newAccessibleSetClients), with reactors counting the
// namespace list and get calls made against each clientset. The counters are
// shared pointers so a baseline measured on one service can be compared
// against a separately built one.
type countingNamespaceService struct {
	sa                           *kubetest.FakeK8sClient
	saLists, userLists, userGets *int
	svc                          *NamespaceService
}

func newCountingNamespaceService(t *testing.T, allNamespaces, allowedNamespaces []string) *countingNamespaceService {
	t.Helper()
	sa, user := newAccessibleSetClients(allNamespaces, allowedNamespaces)

	c := &countingNamespaceService{
		sa:        sa,
		saLists:   new(int),
		userLists: new(int),
		userGets:  new(int),
	}
	if cs, ok := sa.KubeClientset.(*clientsetfake.Clientset); ok {
		cs.PrependReactor("*", "namespaces", listCallCounter(c.saLists))
	}
	if cs, ok := user.FakeClient().KubeClientset.(*clientsetfake.Clientset); ok {
		cs.PrependReactor("*", "namespaces", listCallCounter(c.userLists))
		cs.PrependReactor("*", "namespaces", getCallCounter(c.userGets))
	}

	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	ns := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)
	c.svc = &ns
	return c
}

// TestGetClusterNamespaceCacheWarmthInvariant pins the core #10443 fix: the
// primitive's answer must not depend on per-token cache warmth. Cold, warm
// (after the set is computed) and expired (after RefreshTokenNamespaces)
// lookups must give identical answers in both require_namespace_get modes.
func TestGetClusterNamespaceCacheWarmthInvariant(t *testing.T) {
	for _, strict := range []bool{false, true} {
		t.Run(fmt.Sprintf("strict=%t", strict), func(t *testing.T) {
			conf := config.NewConfig()
			conf.KialiFeatureFlags.Authz.RequireNamespaceGet = strict

			// The user can LIST bookinfo and alpha only.
			sa, user := newAccessibleSetClients(
				[]string{"bookinfo", "alpha", "beta"},
				[]string{"bookinfo", "alpha"},
			)
			if cs, ok := user.FakeClient().KubeClientset.(*clientsetfake.Clientset); ok {
				if strict {
					// In strict mode the accessible set comes from per-namespace
					// GETs; deny beta to make it inaccessible there too.
					cs.PrependReactor("get", "namespaces", forbidGetNamespace("beta"))
				} else {
					// The #7125 profile in default mode: LIST includes alpha
					// but the per-namespace GET on it is denied. LIST implies
					// access, so alpha must still resolve — the old primitive
					// failed this on a cold cache (bare GET fallback).
					cs.PrependReactor("get", "namespaces", forbidGetNamespace("alpha"))
				}
			}

			saClients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: sa}
			userClients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: user}
			kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
			discovery := istio.NewDiscovery(saClients, kialiCache, conf)
			nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)
			cluster := conf.KubernetesConfig.ClusterName

			assertLookup := func() {
				ns, err := nsservice.GetClusterNamespace(context.TODO(), "bookinfo", cluster)
				require.NoError(t, err)
				assert.Equal(t, "bookinfo", ns.Name)

				ns, err = nsservice.GetClusterNamespace(context.TODO(), "alpha", cluster)
				require.NoError(t, err)
				assert.Equal(t, "alpha", ns.Name)

				_, err = nsservice.GetClusterNamespace(context.TODO(), "beta", cluster)
				require.Error(t, err)
				assert.True(t, IsAccessibleError(err), "expected an accessible error, got: %v", err)
			}

			assertLookup()                             // cold
			assertLookup()                             // warm
			kialiCache.RefreshTokenNamespaces(cluster) // expire
			assertLookup()                             // recomputed: same answers
		})
	}
}

// TestGetClusterNamespaceUnknownCluster pins N7: a cluster with no user
// client is an access denial (403), not an internal error (500).
func TestGetClusterNamespaceUnknownCluster(t *testing.T) {
	conf := config.NewConfig()
	sa, _ := newAccessibleSetClients([]string{"bookinfo"}, []string{"bookinfo"})

	saClients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: sa}
	userClients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("bookinfo"))}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	_, err := nsservice.GetClusterNamespace(context.TODO(), "bookinfo", "no-such-cluster")
	require.Error(t, err)
	assert.True(t, IsAccessibleError(err))
}

// TestGetClusterNamespaceWarmEntryAuthoritative pins N2: once the cluster
// entry is warm, lookups for denied or nonexistent namespaces must not
// recompute the set (one cache lookup only). Otherwise any authenticated
// user could trigger strict-mode load against the API server at will.
func TestGetClusterNamespaceWarmEntryAuthoritative(t *testing.T) {
	c := newCountingNamespaceService(t, []string{"bookinfo"}, []string{"bookinfo"})
	cluster := config.NewConfig().KubernetesConfig.ClusterName

	// Cold lookup: computes and caches the set.
	_, err := c.svc.GetClusterNamespace(context.TODO(), "bookinfo", cluster)
	require.NoError(t, err)
	require.Greater(t, *c.saLists, 0)

	// Warm entry: 50 lookups for random nonexistent namespaces must not
	// trigger a single additional API call.
	saListsBefore, userListsBefore, userGetsBefore := *c.saLists, *c.userLists, *c.userGets
	for i := 0; i < 50; i++ {
		_, err := c.svc.GetClusterNamespace(context.TODO(), fmt.Sprintf("nonexistent-%d", i), cluster)
		require.Error(t, err)
		assert.True(t, IsAccessibleError(err))
	}
	assert.Equal(t, saListsBefore, *c.saLists, "SA list calls must not increase on warm-entry denials")
	assert.Equal(t, userListsBefore, *c.userLists, "user list calls must not increase on warm-entry denials")
	assert.Equal(t, userGetsBefore, *c.userGets, "user get calls must not increase on warm-entry denials")
}

// TestGetClusterNamespaceWarmLookupStaysIndexed pins the performance shape of
// the warm path: resolving a namespace against a warm accessible set must be
// an indexed O(1) read, not a materialization of the whole set. The check is
// called repeatedly (per request, per cluster fan-out), so a per-lookup set
// copy scales garbage production with the set size. Allocation counts are
// deterministic, so the size-independence pin is exact up to a small slack;
// the absolute per-op count is not asserted because it includes fixed
// allocations every span-bearing call pays, which are independent of the set
// size.
func TestGetClusterNamespaceWarmLookupStaysIndexed(t *testing.T) {
	if raceDetectorEnabled {
		t.Skip("allocation counts are not deterministic under the race detector")
	}

	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName
	sa, user := newAccessibleSetClients([]string{"bookinfo"}, []string{"bookinfo"})

	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	// The lookup under test reads the cache, not the cluster, so the warm set
	// is populated directly at two sizes and the per-op allocation compared.
	measure := func(setSize int) float64 {
		warm := make([]models.Namespace, 0, setSize)
		for i := 0; i < setSize; i++ {
			warm = append(warm, models.Namespace{Name: fmt.Sprintf("ns-%03d", i), Cluster: cluster})
		}
		kialiCache.SetClusterNamespaces(user.GetCacheKey(), cluster, warm)

		ns, err := nsservice.GetClusterNamespace(context.TODO(), "ns-050", cluster)
		require.NoError(t, err)
		assert.Equal(t, "ns-050", ns.Name)

		// AllocsPerRun counts allocations per call: deterministic, unlike the
		// byte totals testing.Benchmark reports, and cheap — a fixed number
		// of iterations instead of auto-scaled benchmark rounds.
		return testing.AllocsPerRun(20, func() {
			_, _ = nsservice.GetClusterNamespace(context.TODO(), "ns-050", cluster)
		})
	}

	small := measure(100)
	large := measure(500)

	// The indexed read allocates a constant number of objects (the matched
	// namespace copy); a materialized set would scale with the set size.
	assert.LessOrEqual(t, large-small, 2.0,
		"warm GetClusterNamespace allocation grows with the set size: %.0f allocs/op at 100 namespaces vs %.0f at 500; the accessible set is being materialized per lookup", small, large)
}

// TestGetClusterNamespaceConcurrentColdCacheCoalesces pins the singleflight
// behavior: concurrent lookups on a cold cache compute the set once.
// coldLookupCost measures how many namespace list calls a single cold
// accessible-set computation makes on the SA and user clientsets (the SA
// list plus whatever the discovery machinery lists). Call-count assertions
// compare against this baseline rather than hardcoding the per-computation
// cost.
func coldLookupCost(t *testing.T, allNamespaces, allowedNamespaces []string, lookup string) (saCost, userCost int) {
	t.Helper()
	c := newCountingNamespaceService(t, allNamespaces, allowedNamespaces)

	// The lookup's outcome is irrelevant here (for the zero-namespace
	// variant it is a denial); only the API call cost is measured.
	_, _ = c.svc.GetClusterNamespace(context.TODO(), lookup, config.NewConfig().KubernetesConfig.ClusterName)
	return *c.saLists, *c.userLists
}

func TestGetClusterNamespaceConcurrentColdCacheCoalesces(t *testing.T) {
	// The cost of a single cold computation, measured on an identical setup.
	singleSaCost, singleUserCost := coldLookupCost(t, []string{"bookinfo"}, []string{"bookinfo"}, "bookinfo")

	c := newCountingNamespaceService(t, []string{"bookinfo"}, []string{"bookinfo"})
	cluster := config.NewConfig().KubernetesConfig.ClusterName

	// Block the SA namespace list so the leader cannot finish its
	// computation: the followers then pile into the in-flight singleflight
	// call instead of racing the leader to completion and hitting the warm
	// cache. Without coalescing every follower would enter this reactor
	// itself, and the list count below would exceed one computation.
	listEntered := make(chan struct{})
	var enterOnce sync.Once
	release := make(chan struct{})
	if cs, ok := c.sa.KubeClientset.(*clientsetfake.Clientset); ok {
		cs.PrependReactor("list", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
			enterOnce.Do(func() { close(listEntered) })
			<-release
			return false, nil, nil
		})
	}

	const concurrency = 20
	var wg sync.WaitGroup
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ns, err := c.svc.GetClusterNamespace(context.TODO(), "bookinfo", cluster)
			if assert.NoError(t, err) {
				assert.Equal(t, "bookinfo", ns.Name)
			}
		}()
	}

	// Wait until the leader is blocked inside the reactor, then give the
	// followers time to reach the in-flight call before releasing it. The
	// release timing cannot cause a false failure: a follower arriving after
	// the release finds the warm entry and still costs no extra list.
	<-listEntered
	time.Sleep(100 * time.Millisecond)
	close(release)
	wg.Wait()

	assert.Equal(t, singleSaCost, *c.saLists, "concurrent cold lookups must cost exactly one set computation (SA)")
	assert.Equal(t, singleUserCost, *c.userLists, "concurrent cold lookups must cost exactly one set computation (user)")
}

// TestGetClusterNamespaceZeroAccessibleUserCachesEmptyEntry pins the
// empty-result caching: a user with zero accessible namespaces in the
// cluster does not recompute the (empty) set on subsequent requests.
func TestGetClusterNamespaceZeroAccessibleUserCachesEmptyEntry(t *testing.T) {
	// The cost of a single cold computation, measured on an identical setup.
	singleSaCost, singleUserCost := coldLookupCost(t, []string{"bookinfo", "alpha"}, nil, "bookinfo")

	c := newCountingNamespaceService(t, []string{"bookinfo", "alpha"}, nil)
	cluster := config.NewConfig().KubernetesConfig.ClusterName

	for i := 0; i < 3; i++ {
		_, err := c.svc.GetClusterNamespace(context.TODO(), "bookinfo", cluster)
		require.Error(t, err)
		assert.True(t, IsAccessibleError(err))
	}

	assert.Equal(t, singleSaCost, *c.saLists, "the empty accessible set must be computed (and cached) exactly once")
	assert.Equal(t, singleUserCost, *c.userLists)
}

// TestGetNamespacesStrictModeSkipsDeletedNamespace pins N6: in strict mode a
// namespace deleted between the SA LIST and the user's GET (NotFound) is
// skipped rather than failing the whole set computation with a 500.
func TestGetNamespacesStrictModeSkipsDeletedNamespace(t *testing.T) {
	conf := config.NewConfig()
	conf.KialiFeatureFlags.Authz.RequireNamespaceGet = true

	sa, user := newAccessibleSetClients([]string{"bookinfo", "alpha"}, []string{"bookinfo", "alpha"})
	if cs, ok := user.FakeClient().KubeClientset.(*clientsetfake.Clientset); ok {
		cs.PrependReactor("get", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
			if ga, ok := action.(kubeclienttesting.GetAction); ok && ga.GetName() == "alpha" {
				return true, nil, errors.NewNotFound(core_v1.Resource("namespaces"), "alpha")
			}
			return false, nil, nil
		})
	}

	saClients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: sa}
	userClients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	namespaces, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(t, err)
	assert.Equal(t, []string{"bookinfo"}, nsNames(namespaces))
}

// TestGetClusterNamespaceClusterWideAccessDisabled covers the
// cluster-wide-access=false path: the accessible set comes from the
// configured accessible namespaces fetched with per-namespace GETs.
func TestGetClusterNamespaceClusterWideAccessDisabled(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = false
	conf.Deployment.AccessibleNamespaces = []string{"bookinfo"}

	k8s := setupNamespaceServiceWithNs()
	nsservice := setupNamespaceService(t, k8s, conf)
	cluster := conf.KubernetesConfig.ClusterName

	ns, err := nsservice.GetClusterNamespace(context.TODO(), "bookinfo", cluster)
	require.NoError(t, err)
	assert.Equal(t, "bookinfo", ns.Name)

	// alpha exists on the cluster but is not an accessible namespace.
	_, err = nsservice.GetClusterNamespace(context.TODO(), "alpha", cluster)
	require.Error(t, err)
	assert.True(t, IsAccessibleError(err))
}

// TestAnonymousModeSACacheKeyIsolated pins the fix for the anonymous-mode
// cache collision: in anonymous (or RBAC-disabled) mode the user client IS
// the SA client and shares its cache key, so the SA's own namespace set —
// which is undecorated (no control-plane, revision or ambient markers) —
// must be cached under a distinct key. Otherwise, when the SA set is
// computed first (e.g. by CheckNamespaceAccessAllClusters), the user's
// accessible set would serve the undecorated list for the cache TTL and the
// picker/overview/mesh pages would lose istio-system's control-plane
// markers.
func TestAnonymousModeSACacheKeyIsolated(t *testing.T) {
	for _, saFirst := range []bool{false, true} {
		t.Run(fmt.Sprintf("sa-first=%t", saFirst), func(t *testing.T) {
			assert := assert.New(t)
			require := require.New(t)

			conf := config.NewConfig()
			cluster := conf.KubernetesConfig.ClusterName

			// Anonymous mode: the same client is both the user and the SA.
			k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system"), kubetest.FakeNamespace("bookinfo"))
			clients := map[string]kubernetes.UserClientInterface{cluster: k8s}
			saClients := kubernetes.ConvertFromUserClients(clients)

			discovery := &istiotest.FakeDiscovery{GetControlPlaneNamespacesReturn: []string{"istio-system"}}
			kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
			nsservice := NewNamespaceService(kialiCache, conf, discovery, saClients, clients)

			if saFirst {
				// e.g. CheckNamespaceAccessAllClusters computes the SA set
				// before the user set.
				saNs, err := nsservice.GetKialiSAClusterNamespaces(context.TODO(), cluster)
				require.NoError(err)
				require.NotEmpty(saNs)
			}

			userNs, err := nsservice.GetClusterNamespaces(context.TODO(), cluster)
			require.NoError(err)

			var istioSystem *models.Namespace
			for i := range userNs {
				if userNs[i].Name == "istio-system" {
					istioSystem = &userNs[i]
				}
			}
			require.NotNil(istioSystem, "istio-system must be in the user's accessible set")
			assert.True(istioSystem.IsControlPlane,
				"the user's accessible set must keep its control-plane decoration even when the SA set was computed first")
		})
	}
}
