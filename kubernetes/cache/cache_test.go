package cache

import (
	"testing"

	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestNoHomeClusterReturnsError(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	clients := map[string]kubernetes.ClientInterface{"nothomecluster": kubetest.NewFakeK8sClient()}
	_, err := NewKialiCache(clients, *conf)
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
	saClients := map[string]kubernetes.ClientInterface{
		conf.KubernetesConfig.ClusterName: client,
		"cluster2":                        client2,
	}

	kialiCache, err := NewKialiCache(saClients, *conf)
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

func TestValidationsSetByConstructor(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()

	clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient()}
	cache, err := NewKialiCache(clients, *conf)
	require.NoError(err)

	require.NotNil(cache.Validations())
}
