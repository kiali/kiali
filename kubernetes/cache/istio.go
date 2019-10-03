package cache

import (
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/client-go/tools/cache"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

type (
	IstioCache interface {
		CheckIstioResource(resource string) bool
		GetIstioResources(resource string, namespace string) ([]kubernetes.IstioObject, error)
	}
)

func (c *kialiCacheImpl) CheckIstioResource(resource string) bool {
	istioResources := []string{"VirtualService", "DestinationRule"}
	for _, r := range istioResources {
		if r == resource {
			return true
		}
	}
	return false
}

func (c *kialiCacheImpl) createIstioInformers(namespace string, informer *typeCache) {
	// Networking API
	(*informer)["VirtualService"] = createIstioIndexInformer(c.istioClient.GetIstioNetworkingApi(), "virtualservices", c.refreshDuration, namespace)
	(*informer)["DestinationRule"] = createIstioIndexInformer(c.istioClient.GetIstioNetworkingApi(), "destinationrules", c.refreshDuration, namespace)
}

func createIstioIndexInformer(getter cache.Getter, resourceType string, refreshDuration time.Duration, namespace string) cache.SharedIndexInformer {
	return cache.NewSharedIndexInformer(cache.NewListWatchFromClient(getter, resourceType, namespace, fields.Everything()),
		&kubernetes.GenericIstioObject{},
		refreshDuration,
		cache.Indexers{},
	)
}

func (c* kialiCacheImpl) GetIstioResources(resource string, namespace string) ([]kubernetes.IstioObject, error) {
	if !c.CheckIstioResource(resource) {
		return nil, fmt.Errorf("Kiali cache doesn't support [resource: %s]", resource)
	}
	if nsCache, nsOk := c.nsCache[namespace]; nsOk {
		resources := nsCache[resource].GetStore().List()
		lenResources := len(resources)
		if lenResources > 0 {
			_, ok := resources[0].(*kubernetes.GenericIstioObject)
			if !ok {
				return nil, fmt.Errorf("bad GenericIstioObject type found in cache for [resource: %s]", resource)
			}
			iResources := make([]kubernetes.IstioObject, lenResources)
			for i, r := range resources {
				iResources[i] = (r.(*kubernetes.GenericIstioObject)).DeepCopyIstioObject()
				// TODO iResource[i].SetTypeMeta(typeMeta) is missing/needed ??
			}
			log.Tracef("[Kiali Cache] Get [resource: %s] for [namespace: %s] =  %d", resource, namespace, lenResources)
			return iResources, nil
		}
	}
	return []kubernetes.IstioObject{}, nil
}
