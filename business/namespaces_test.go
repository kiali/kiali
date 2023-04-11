package business

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

// Namespace service setup
func setupNamespaceService(k8s kubernetes.ClientInterface, conf *config.Config) NamespaceService {
	// config needs to be set by other services since those rely on the global.
	conf.KubernetesConfig.CacheEnabled = false
	config.Set(conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[kubernetes.HomeClusterName] = k8s
	return NewNamespaceService(k8sclients, k8sclients)
}

// Namespace service setup
func setupNamespaceServiceWithNs() kubernetes.ClientInterface {
	// config needs to be set by other services since those rely on the global.
	objects := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "alpha"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "beta"}},
	}
	for _, obj := range fakeNamespaces() {
		o := obj
		objects = append(objects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)
	k8s.OpenShift = false
	return k8s
}

// Get namespaces
func TestGetNamespaces(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	k8s := setupNamespaceServiceWithNs()

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)

	nsservice := setupNamespaceService(k8s, conf)

	ns, _ := nsservice.GetNamespaces(context.TODO())

	assert.NotNil(t, ns)
	assert.Equal(t, len(ns), 5)
	assert.Equal(t, ns[0].Name, "alpha")
}

// Get namespace
func TestGetNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	k8s := setupNamespaceServiceWithNs()

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)

	nsservice := setupNamespaceService(k8s, conf)

	ns, _ := nsservice.GetNamespace(context.TODO(), "bookinfo")

	assert.NotNil(t, ns)
	assert.Equal(t, ns.Name, "bookinfo")
}

// Get namespace error
func TestGetNamespaceWithError(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	k8s := setupNamespaceServiceWithNs()

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)

	nsservice := setupNamespaceService(k8s, conf)

	ns2, err := nsservice.GetNamespace(context.TODO(), "fakeNS")

	assert.NotNil(t, err)
	assert.Nil(t, ns2)
}

// Update namespaces
func TestUpdateNamespaces(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	k8s := setupNamespaceServiceWithNs()

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)

	nsservice := setupNamespaceService(k8s, conf)

	ns, err := nsservice.UpdateNamespace(context.TODO(), "bookinfo", `{"metadata": {"labels": {"new": "label"}}}`, kubernetes.HomeClusterName)

	assert.Nil(t, err)
	assert.NotNil(t, ns)
	assert.Equal(t, ns.Name, "bookinfo")
}

func TestMultiClusterGetNamespace(t *testing.T) {
	require := require.New(t)
	// assert := assert.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	k8s := setupNamespaceServiceWithNs()

	clientFactory := kubetest.NewK8SClientFactoryMock(nil)
	clients := map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(
			&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo"}},
		),
		"west": kubetest.NewFakeK8sClient(
			&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo"}},
		),
	}
	clientFactory.SetClients(clients)
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)
	cache := newTestingCache(t, clientFactory, *conf)
	kialiCache = cache

	nsservice := NewNamespaceService(clients, clients)

	_, err := nsservice.GetNamespace(context.TODO(), "bookinfo")
	require.NoError(err)
	// TODO: It is indeterminite which cluster will be returned first.
	// GetNamespace should probably always return the home cluster to
	// keep backward compatability and anything new should use
	// GetNamespaceByCluster.
	// assert.Equal(kubernetes.HomeClusterName, ns.Cluster)
}

func TestMultiClusterGetNamespaces(t *testing.T) {
	require := require.New(t)
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	k8s := setupNamespaceServiceWithNs()

	clientFactory := kubetest.NewK8SClientFactoryMock(nil)
	clients := map[string]kubernetes.ClientInterface{
		"east": kubetest.NewFakeK8sClient(
			&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo"}},
		),
		"west": kubetest.NewFakeK8sClient(
			&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo"}},
		),
	}
	clientFactory.SetClients(clients)
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)
	cache := newTestingCache(t, clientFactory, *conf)
	kialiCache = cache

	nsservice := NewNamespaceService(clients, clients)
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
	config.Set(conf)

	k8s := setupNamespaceServiceWithNs()

	clientFactory := kubetest.NewK8SClientFactoryMock(nil)
	clients := map[string]kubernetes.ClientInterface{
		"east": k8s,
	}
	clientFactory.SetClients(clients)
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)
	cache := newTestingCache(t, clientFactory, *conf)
	cache.SetNamespaces(
		k8s.GetToken(),
		// gamma is only cached.
		[]models.Namespace{{Name: "bookinfo"}, {Name: "alpha"}, {Name: "beta"}, {Name: "gamma", Cluster: "west"}},
	)
	kialiCache = cache

	nsservice := NewNamespaceService(clients, clients)
	namespaces, err := nsservice.GetNamespaces(context.TODO())
	require.NoError(err)

	require.Len(namespaces, 4)

	namespace, err := nsservice.GetNamespaceByCluster(context.TODO(), "gamma", "west")
	require.NoError(err)

	assert.Equal("west", namespace.Cluster)
}

type forbiddenFake struct{ kubernetes.ClientInterface }

func (f *forbiddenFake) GetNamespace(namespace string) (*core_v1.Namespace, error) {
	return nil, fmt.Errorf("forbidden")
}

// Tests that GetNamespaces won't return a namespace with the same name from another cluster
// if the user doesn't have access to that cluster but the namespace is cached.
func TestGetNamespacesForbiddenCached(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	k8s := setupNamespaceServiceWithNs()

	clientFactory := kubetest.NewK8SClientFactoryMock(nil)
	// Two clusters: one the user has access to, one they don't.
	clients := map[string]kubernetes.ClientInterface{
		"east": &forbiddenFake{k8s},
		"west": k8s,
	}
	clientFactory.SetClients(clients)
	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	SetWithBackends(mockClientFactory, nil)
	cache := newTestingCache(t, clientFactory, *conf)
	cache.SetNamespaces(
		k8s.GetToken(),
		// Bookinfo is cached for the west cluster that the user has access to
		// but NOT for the east cluster that the user doesn't have access to.
		[]models.Namespace{{Name: "bookinfo", Cluster: "west"}},
	)
	kialiCache = cache

	nsservice := NewNamespaceService(clients, clients)
	// Try to get the bookinfo namespace from the home cluster.
	_, err := nsservice.GetNamespaceByCluster(context.TODO(), "bookinfo", "east")
	require.Error(err)
}

// TODO: Add projects tests
