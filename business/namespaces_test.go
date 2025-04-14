package business

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"testing"

	v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	kubeclienttesting "k8s.io/client-go/testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
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
	c := config.NewConfig()
	labels := map[string]string{
		c.IstioLabels.AmbientNamespaceLabel: c.IstioLabels.AmbientNamespaceLabelValue,
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
	c := config.NewConfig()
	labels := map[string]string{
		c.IstioLabels.AmbientNamespaceLabel: c.IstioLabels.AmbientNamespaceLabelValue,
	}
	// config needs to be set by other services since those rely on the global.
	objects := []runtime.Object{
		&v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo", Labels: labels}},
		&v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "alpha"}},
		&v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "beta"}},
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
	cache.SetNamespaces(
		k8s.GetToken(),
		// gamma only exists in the cache.
		[]models.Namespace{{Name: "bookinfo", Cluster: "east"}, {Name: "alpha", Cluster: "east"}, {Name: "beta", Cluster: "east"}, {Name: "gamma", Cluster: "west"}},
	)

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
	cache.SetNamespaces(
		east.GetToken(),
		[]models.Namespace{{Name: "bookinfo", Cluster: "east"}, {Name: "alpha", Cluster: "east"}, {Name: "beta", Cluster: "east"}},
	)
	cache.SetNamespaces(
		west.GetToken(),
		[]models.Namespace{{Name: "gamma", Cluster: "west"}},
	)

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

type forbiddenFake struct{ kubernetes.UserClientInterface }

func (f *forbiddenFake) GetNamespace(namespace string) (*core_v1.Namespace, error) {
	return nil, fmt.Errorf("forbidden")
}

// Tests that GetNamespaces won't return a namespace with the same name from another cluster
// if the user doesn't have access to that cluster but the namespace is cached.
func TestGetNamespacesForbiddenCached(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"

	k8s := setupNamespaceServiceWithNs()

	// Two clusters: one the user has access to, one they don't.
	clients := map[string]kubernetes.UserClientInterface{
		"east": &forbiddenFake{k8s},
		"west": k8s,
	}
	cache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(clients), *conf)
	cache.SetNamespaces(
		k8s.GetToken(),
		// Bookinfo is cached for the west cluster that the user has access to
		// but NOT for the east cluster that the user doesn't have access to.
		[]models.Namespace{{Name: "bookinfo", Cluster: "west"}},
	)

	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(clients), cache, conf)
	nsservice := NewNamespaceService(cache, conf, discovery, kubernetes.ConvertFromUserClients(clients), clients)
	// Try to get the bookinfo namespace from the home cluster.
	_, err := nsservice.GetClusterNamespace(context.TODO(), "bookinfo", "east")
	require.Error(err)
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
		&v1.Project{ObjectMeta: meta_v1.ObjectMeta{Name: "alpha"}},
	)
	openshift.OpenShift = true
	vanilla := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("beta"),
	)
	vanilla.ProjectFake.PrependReactor("get", "projects", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.NewForbidden(v1.Resource("projects"), "beta", fmt.Errorf("forbidden"))
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
