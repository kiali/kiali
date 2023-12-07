package cache

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

// Need to lock the client when we go to check the value of the token
// but only the tests need this functionality so we can use a fake
// that has access to the kubeCache's lock and has a getClient() method
// that returns the client after locking. Without this, the tests will
// fail with the race detector enabled.
type fakeKubeCache struct {
	*kubeCache
}

func (f *fakeKubeCache) getClient() kubernetes.ClientInterface {
	f.kubeCache.cacheLock.RLock()
	defer f.kubeCache.cacheLock.RUnlock()
	return f.kubeCache.client
}

func TestClientUpdatedWhenSAClientChanges(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	client := kubetest.NewFakeK8sClient()
	client.Token = "current-token"
	clientFactory := kubetest.NewK8SClientFactoryMock(client)
	k8sCache, err := NewKubeCache(client, *conf)
	require.NoError(err)

	kubeCache := &fakeKubeCache{kubeCache: k8sCache}
	kialiCache := &kialiCacheImpl{
		clientRefreshPollingPeriod: time.Millisecond,
		clientFactory:              clientFactory,
		KubeCache:                  kubeCache,
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	kialiCache.watchForClientChanges(ctx, client.Token)

	// Update the client. This should trigger a cache refresh.
	newClient := kubetest.NewFakeK8sClient()
	newClient.Token = "new-token"
	clientFactory.SetClients(map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: newClient})

	require.Eventually(
		func() bool { return kubeCache.getClient() != client },
		500*time.Millisecond,
		5*time.Millisecond,
		"client and cache should have been updated",
	)
}

func TestNoHomeClusterReturnsError(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	client := kubetest.NewFakeK8sClient()
	clientFactory := kubetest.NewK8SClientFactoryMock(client)
	clientFactory.SetClients(map[string]kubernetes.ClientInterface{"nothomecluster": client})

	_, err := NewKialiCache(clientFactory, *conf)
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

	kialiCache, err := NewKialiCache(clientFactory, *conf)
	require.NoError(err)
	defer kialiCache.Stop()

	caches := kialiCache.GetKubeCaches()
	require.Equal(2, len(caches))

	_, err = caches[conf.KubernetesConfig.ClusterName].GetDeployment("test", "deployment1")
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
