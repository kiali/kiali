package cache

import (
	"errors"

	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/client-go/informers"

	"github.com/kiali/kiali/log"
	"k8s.io/apimachinery/pkg/labels"
)

type (
	KubernetesCache interface {
		GetDeployments(namespace string) ([]apps_v1.Deployment, error)
		GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error)
	}
)

func (c *kialiCacheImpl) createKubernetesInformers(namespace string, informer *typeCache) {
	sharedInformers := informers.NewSharedInformerFactoryWithOptions(c.k8sApi, c.refreshDuration, informers.WithNamespace(namespace))
	(*informer)["Deployment"] = sharedInformers.Apps().V1().Deployments().Informer()
	(*informer)["Service"] = sharedInformers.Core().V1().Services().Informer()
}

func (c *kialiCacheImpl) GetDeployments(namespace string) ([]apps_v1.Deployment, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		deps := nsCache["Deployment"].GetStore().List()
		lenDeps := len(deps)
		if lenDeps > 0 {
			_, ok := deps[0].(*apps_v1.Deployment)
			if !ok {
				return nil, errors.New("bad Deployment type found in cache")
			}
			nsDeps := make([]apps_v1.Deployment, lenDeps)
			for i, dep := range deps {
				nsDeps[i] = *(dep.(*apps_v1.Deployment))
			}
			log.Tracef("[Kiali Cache] Get [resource: Deployment] for [namespace: %s] = %d", namespace, lenDeps)
			return nsDeps, nil
		}
	}
	return []apps_v1.Deployment{}, nil
}

func (c *kialiCacheImpl) GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		services := nsCache["Service"].GetStore().List()
		lenServices := len(services)
		if lenServices > 0 {
			_, ok := services[0].(*core_v1.Service)
			if !ok {
				return []core_v1.Service{}, errors.New("bad Service type found in cache")
			}
			nsServices := make([]core_v1.Service, lenServices)
			for i, service := range services {
				nsServices[i] = *(service.(*core_v1.Service))
			}
			log.Tracef("[Kiali Cache] Get [resource: Service] for [namespace: %s] = %d", namespace, lenServices)
			if selectorLabels == nil {
				return nsServices, nil
			}
			var filteredServices []core_v1.Service
			for _, svc := range nsServices {
				svcSelector := labels.Set(svc.Spec.Selector).AsSelector()
				if !svcSelector.Empty() && svcSelector.Matches(labels.Set(selectorLabels)) {
					filteredServices = append(filteredServices, svc)
				}
			}
			return filteredServices, nil
		}
	}
	return []core_v1.Service{}, nil
}
