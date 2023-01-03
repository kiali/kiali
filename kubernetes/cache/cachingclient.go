package cache

import (
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"
)

// CachingClient is a wrapper around a ClientInterface that adds caching.
// If the object is cached then it is read from the cache. Not all object
// types are cached. When an object is created, updated, or deleted, then
// the cache is refreshed and updated.
type CachingClient struct {
	cache KialiCache
	kubernetes.ClientInterface
}

// NewCachingClient creates a new CachingClient out of a cache and a client.
func NewCachingClient(cache KialiCache, client kubernetes.ClientInterface) *CachingClient {
	return &CachingClient{
		cache:           cache,
		ClientInterface: client,
	}
}

// TODO: Remove conditionals for cache once cache is fully mandatory.

func (cc *CachingClient) GetConfigMap(namespace, name string) (*core_v1.ConfigMap, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetConfigMap(namespace, name)
	}
	return cc.ClientInterface.GetConfigMap(namespace, name)
}

func (cc *CachingClient) GetDaemonSet(namespace string, name string) (*apps_v1.DaemonSet, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetDaemonSet(namespace, name)
	}
	return cc.ClientInterface.GetDaemonSet(namespace, name)
}

func (cc *CachingClient) GetDaemonSets(namespace string) ([]apps_v1.DaemonSet, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetDaemonSets(namespace)
	}
	return cc.ClientInterface.GetDaemonSets(namespace)
}

func (cc *CachingClient) GetDeployment(namespace string, name string) (*apps_v1.Deployment, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetDeployment(namespace, name)
	}
	return cc.ClientInterface.GetDeployment(namespace, name)
}

func (cc *CachingClient) GetDeployments(namespace string) ([]apps_v1.Deployment, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetDeployments(namespace)
	}
	return cc.ClientInterface.GetDeployments(namespace)
}

func (cc *CachingClient) GetEndpoints(namespace string, name string) (*core_v1.Endpoints, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetEndpoints(namespace, name)
	}
	return cc.ClientInterface.GetEndpoints(namespace, name)
}

func (cc *CachingClient) GetPods(namespace, labelSelector string) ([]core_v1.Pod, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetPods(namespace, labelSelector)
	}
	return cc.ClientInterface.GetPods(namespace, labelSelector)
}

func (cc *CachingClient) GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetReplicaSets(namespace)
	}
	return cc.ClientInterface.GetReplicaSets(namespace)
}

func (cc *CachingClient) GetService(namespace string, name string) (*core_v1.Service, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetService(namespace, name)
	}
	return cc.ClientInterface.GetService(namespace, name)
}

func (cc *CachingClient) GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetServices(namespace, selectorLabels)
	}
	return cc.ClientInterface.GetServices(namespace, selectorLabels)
}

func (cc *CachingClient) GetStatefulSet(namespace string, name string) (*apps_v1.StatefulSet, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetStatefulSet(namespace, name)
	}
	return cc.ClientInterface.GetStatefulSet(namespace, name)
}

func (cc *CachingClient) GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error) {
	if cc.cache.CheckNamespace(namespace) {
		return cc.cache.GetStatefulSets(namespace)
	}
	return cc.ClientInterface.GetStatefulSets(namespace)
}
