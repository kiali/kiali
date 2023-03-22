package business

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
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
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "bookinfo"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "alpha"}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "beta"}},
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
	assert.Equal(t, ns[0].Name, "bookinfo")
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

	ns, err := nsservice.UpdateNamespace(context.TODO(), "bookinfo", "new", kubernetes.HomeClusterName)

	assert.Nil(t, err)
	assert.NotNil(t, ns)
	assert.Equal(t, ns.Name, "bookinfo")

}

// TODO: Add projects tests
