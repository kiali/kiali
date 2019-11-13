package cache

import (
	"errors"
	"fmt"

	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/informers"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

type (
	KubernetesCache interface {
		GetDeployments(namespace string) ([]apps_v1.Deployment, error)
		GetDeployment(namespace, name string) (*apps_v1.Deployment, error)
		GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error)
		GetPods(namespace, labelSelector string) ([]core_v1.Pod, error)
		GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error)
	}
)

func (c *kialiCacheImpl) createKubernetesInformers(namespace string, informer *typeCache) {
	sharedInformers := informers.NewSharedInformerFactoryWithOptions(c.k8sApi, c.refreshDuration, informers.WithNamespace(namespace))
	(*informer)[kubernetes.DeploymentType] = sharedInformers.Apps().V1().Deployments().Informer()
	(*informer)[kubernetes.ReplicaSetType] = sharedInformers.Apps().V1().ReplicaSets().Informer()
	(*informer)[kubernetes.ServiceType] = sharedInformers.Core().V1().Services().Informer()
	(*informer)[kubernetes.PodType] = sharedInformers.Core().V1().Pods().Informer()
}

func (c *kialiCacheImpl) isKubernetesSynced(namespace string) bool {
	var isSynced bool
	if nsCache, exist := c.nsCache[namespace]; exist {
		isSynced = nsCache[kubernetes.DeploymentType].HasSynced() &&
			nsCache[kubernetes.ReplicaSetType].HasSynced() &&
			nsCache[kubernetes.ServiceType].HasSynced() &&
			nsCache[kubernetes.PodType].HasSynced()
	} else {
		isSynced = false
	}
	return isSynced
}

func (c *kialiCacheImpl) GetDeployments(namespace string) ([]apps_v1.Deployment, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		deps := nsCache[kubernetes.DeploymentType].GetStore().List()
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

func (c *kialiCacheImpl) GetDeployment(namespace, name string) (*apps_v1.Deployment, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.DeploymentType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			dep, ok := obj.(*apps_v1.Deployment)
			if !ok {
				return nil, errors.New("bad Deployment type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: Deployment] for [namespace: %s] [name: %s]", namespace, name)
			return dep, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		services := nsCache[kubernetes.ServiceType].GetStore().List()
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
			labelsMap := labels.Set(selectorLabels)
			for _, svc := range nsServices {
				svcSelector := labels.Set(svc.Spec.Selector).AsSelector()
				if !svcSelector.Empty() && svcSelector.Matches(labelsMap) {
					filteredServices = append(filteredServices, svc)
				}
			}
			return filteredServices, nil
		}
	}
	return []core_v1.Service{}, nil
}

func (c *kialiCacheImpl) GetPods(namespace, labelSelector string) ([]core_v1.Pod, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		pods := nsCache[kubernetes.PodType].GetStore().List()
		lenPods := len(pods)
		if lenPods > 0 {
			_, ok := pods[0].(*core_v1.Pod)
			if !ok {
				return []core_v1.Pod{}, errors.New("bad Pod type found in cache")
			}
			nsPods := make([]core_v1.Pod, lenPods)
			for i, pod := range pods {
				nsPods[i] = *(pod.(*core_v1.Pod))
			}
			log.Tracef("[Kiali Cache] Get [resource: Pod] for [namespace: %s] = %d", namespace, lenPods)
			if labelSelector == "" {
				return nsPods, nil
			}
			var filteredPods []core_v1.Pod
			selector, selErr := labels.Parse(labelSelector)
			if selErr != nil {
				return []core_v1.Pod{}, fmt.Errorf("%s can not be processed as selector: %v", labelSelector, selErr)
			}
			for _, pod := range nsPods {
				if selector.Matches(labels.Set(pod.Labels)) {
					filteredPods = append(filteredPods, pod)
				}
			}
			return filteredPods, nil
		}
	}
	return []core_v1.Pod{}, nil
}

func (c *kialiCacheImpl) GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		reps := nsCache[kubernetes.ReplicaSetType].GetStore().List()
		lenReps := len(reps)
		if lenReps > 0 {
			_, ok := reps[0].(*apps_v1.ReplicaSet)
			if !ok {
				return nil, errors.New("bad ReplicaSet type found in cache")
			}
			nsReps := make([]apps_v1.ReplicaSet, lenReps)
			for i, rep := range reps {
				nsReps[i] = *(rep.(*apps_v1.ReplicaSet))
			}
			log.Tracef("[Kiali Cache] Get [resource: ReplicaSet] for [namespace: %s] = %d", namespace, lenReps)
			return nsReps, nil
		}
	}
	return []apps_v1.ReplicaSet{}, nil
}
