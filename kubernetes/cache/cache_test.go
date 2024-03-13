package cache_test

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestNoHomeClusterReturnsError(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	client := kubetest.NewFakeK8sClient()
	clientFactory := kubetest.NewK8SClientFactoryMock(client)
	clientFactory.SetClients(map[string]kubernetes.ClientInterface{"nothomecluster": client})

	cache, err := cache.NewKialiCache(clientFactory, *conf)
	defer func() {
		if cache != nil {
			cache.Stop()
		}
	}()
	require.Error(err, "no home cluster should return an error")
}

func TestKubeCacheCreatedPerClient(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "test"}}
	deploymentCluster1 := &apps_v1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "deployment1", Namespace: "test"}}
	deploymentCluster2 := &apps_v1.Deployment{ObjectMeta: metav1.ObjectMeta{Name: "deployment2", Namespace: "test"}}
	client := kubetest.NewFakeK8sClient(ns, deploymentCluster1)
	client2 := kubetest.NewFakeK8sClient(ns, deploymentCluster2)
	clientFactory := kubetest.NewK8SClientFactoryMock(nil)
	clientFactory.SetClients(map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: client,
		"cluster2":                        client2,
	})

	kialiCache := cache.NewTestingCacheWithFactory(t, clientFactory, *conf)

	caches := kialiCache.GetKubeCaches()
	require.Equal(2, len(caches))

	_, err := caches[conf.KubernetesConfig.ClusterName].GetDeployment("test", "deployment1")
	require.NoError(err)

	_, err = caches["cluster2"].GetDeployment("test", "deployment2")
	require.NoError(err)

	_, err = kialiCache.GetKubeCache(conf.KubernetesConfig.ClusterName)
	require.NoError(err)

	_, err = kialiCache.GetKubeCache("cluster2")
	require.NoError(err)

	_, err = kialiCache.GetKubeCache("cluster3")
	require.Error(err)
}

func ztunnelDaemonSet() *apps_v1.DaemonSet {
	return &apps_v1.DaemonSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "ztunnel",
			Namespace: "istio-system",
		},
		Spec: apps_v1.DaemonSetSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{"app": "ztunnel"},
			},
		},
	}
}

func TestIsAmbientEnabled(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	client := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "istio-system"}},
		ztunnelDaemonSet(),
	)
	cache := cache.NewTestingCache(t, client, *conf)

	require.True(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
	// Call multiple times to ensure results are consistent.
	require.True(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
}

func TestIsAmbientEnabledOutsideIstioSystem(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	ztunnel := ztunnelDaemonSet()
	ztunnel.Namespace = "alternate-istio-namespace"
	client := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "alternate-istio-namespace"}},
		ztunnel,
	)
	cache := cache.NewTestingCache(t, client, *conf)

	require.True(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
	// Call multiple times to ensure results are consistent.
	require.True(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
}

func TestIsAmbientDisabled(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	client := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "istio-system"}},
	)
	cache := cache.NewTestingCache(t, client, *conf)

	require.False(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
	// Call multiple times to ensure results are consistent.
	require.False(cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName))
}

func TestIsAmbientMultiCluster(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	east := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "istio-system"}},
		ztunnelDaemonSet(),
	)
	west := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "istio-system"}},
	)
	clientFactory := kubetest.NewK8SClientFactoryMock(nil)
	clientFactory.SetClients(map[string]kubernetes.ClientInterface{
		"east": east,
		"west": west,
	})
	cache := cache.NewTestingCacheWithFactory(t, clientFactory, *conf)

	require.True(cache.IsAmbientEnabled("east"))
	require.False(cache.IsAmbientEnabled("west"))
}

// This test only tests anything when the '-race' flag is passed to 'go test'.
func TestIsAmbientIsThreadSafe(t *testing.T) {
	conf := config.NewConfig()
	client := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "istio-system"}},
		ztunnelDaemonSet(),
	)
	cache := cache.NewTestingCache(t, client, *conf)

	wg := sync.WaitGroup{}
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName)
		}()
	}
	wg.Wait()
}

func TestSetNamespace(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 10000
	conf.KubernetesConfig.ClusterName = "east"
	kubernetes.SetConfig(t, *conf)
	client := kubetest.NewFakeK8sClient()
	cache := cache.NewTestingCache(t, client, *conf)
	cache.SetNamespaces("east", "token", []models.Namespace{{Name: "test", Cluster: "east"}})
	cache.SetNamespace("east", "token", models.Namespace{Name: "test", Cluster: "east", Labels: map[string]string{"app": "test"}})
	ns, found := cache.GetNamespace("east", "token", "test")
	require.True(found)
	require.Equal(map[string]string{"app": "test"}, ns.Labels)
}

func TestSetNamespaceIsThreadSafe(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 10000
	conf.KubernetesConfig.ClusterName = "east"
	kubernetes.SetConfig(t, *conf)
	client := kubetest.NewFakeK8sClient()
	cache := cache.NewTestingCache(t, client, *conf)
	wg := sync.WaitGroup{}
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cache.SetNamespace("east", "token", models.Namespace{Name: "test", Cluster: "east", Labels: map[string]string{"app": "test"}})
		}()
	}
	wg.Wait()
}

func TestGetNamespaces(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 10000
	conf.KubernetesConfig.ClusterName = "east"
	kubernetes.SetConfig(t, *conf)

	client := kubetest.NewFakeK8sClient()
	cache := cache.NewTestingCache(t, client, *conf)
	cache.SetNamespaces("east", "token", []models.Namespace{{Name: "test", Cluster: "east"}})

	namespaces, found := cache.GetNamespaces("east", "token")
	require.True(found)
	require.Equal(1, len(namespaces))
	require.Equal("test", namespaces[0].Name)

	_, found = cache.GetNamespaces("west", "token")
	require.False(found)

	_, found = cache.GetNamespaces("east", "token2")
	require.False(found)
}

func TestRefreshTokenNamespaces(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	conf.KubernetesConfig.CacheTokenNamespaceDuration = 10000
	conf.KubernetesConfig.ClusterName = "east"
	kubernetes.SetConfig(t, *conf)

	client := kubetest.NewFakeK8sClient()
	cache := cache.NewTestingCache(t, client, *conf)
	cache.SetNamespaces("east", "token", []models.Namespace{{Name: "test", Cluster: "east"}})
	cache.RefreshTokenNamespaces()

	_, found := cache.GetNamespaces("east", "token")
	require.False(found)
}
