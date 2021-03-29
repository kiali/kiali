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
		GetConfigMap(namespace, name string) (*core_v1.ConfigMap, error)
		GetDaemonSets(namespace string) ([]apps_v1.DaemonSet, error)
		GetDaemonSet(namespace, name string) (*apps_v1.DaemonSet, error)
		GetDeployments(namespace string) ([]apps_v1.Deployment, error)
		GetDeployment(namespace, name string) (*apps_v1.Deployment, error)
		GetEndpoints(namespace, name string) (*core_v1.Endpoints, error)
		GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error)
		GetStatefulSet(namespace, name string) (*apps_v1.StatefulSet, error)
		GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error)
		GetService(namespace string, name string) (*core_v1.Service, error)
		GetPods(namespace, labelSelector string) ([]core_v1.Pod, error)
		GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error)
	}
)

func (c *kialiCacheImpl) createKubernetesInformers(namespace string, informer *typeCache) {
	sharedInformers := informers.NewSharedInformerFactoryWithOptions(c.k8sApi, c.refreshDuration, informers.WithNamespace(namespace))
	(*informer)[kubernetes.DeploymentType] = sharedInformers.Apps().V1().Deployments().Informer()
	(*informer)[kubernetes.StatefulSetType] = sharedInformers.Apps().V1().StatefulSets().Informer()
	(*informer)[kubernetes.ReplicaSetType] = sharedInformers.Apps().V1().ReplicaSets().Informer()
	(*informer)[kubernetes.DaemonSetType] = sharedInformers.Apps().V1().DaemonSets().Informer()
	(*informer)[kubernetes.ServiceType] = sharedInformers.Core().V1().Services().Informer()
	(*informer)[kubernetes.PodType] = sharedInformers.Core().V1().Pods().Informer()
	(*informer)[kubernetes.ConfigMapType] = sharedInformers.Core().V1().ConfigMaps().Informer()
	(*informer)[kubernetes.EndpointsType] = sharedInformers.Core().V1().Endpoints().Informer()
}

func (c *kialiCacheImpl) isKubernetesSynced(namespace string) bool {
	var isSynced bool
	if nsCache, exist := c.nsCache[namespace]; exist {
		isSynced = nsCache[kubernetes.DeploymentType].HasSynced() &&
			nsCache[kubernetes.StatefulSetType].HasSynced() &&
			nsCache[kubernetes.ReplicaSetType].HasSynced() &&
			nsCache[kubernetes.DaemonSetType].HasSynced() &&
			nsCache[kubernetes.ServiceType].HasSynced() &&
			nsCache[kubernetes.PodType].HasSynced() &&
			nsCache[kubernetes.ConfigMapType].HasSynced() &&
			nsCache[kubernetes.EndpointsType].HasSynced()
	} else {
		isSynced = false
	}
	return isSynced
}

func (c *kialiCacheImpl) GetConfigMap(namespace, name string) (*core_v1.ConfigMap, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.ConfigMapType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			cm, ok := obj.(*core_v1.ConfigMap)
			if !ok {
				return nil, errors.New("bad ConfigMap type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: ConfigMap] for [namespace: %s] [name: %s]", namespace, name)
			return cm, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetDaemonSets(namespace string) ([]apps_v1.DaemonSet, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		daeset := nsCache[kubernetes.DaemonSetType].GetStore().List()
		lenDaeSet := len(daeset)
		if lenDaeSet > 0 {
			_, ok := daeset[0].(*apps_v1.DaemonSet)
			if !ok {
				return nil, errors.New("bad DaemonSet type found in cache")
			}
			nsDaeSets := make([]apps_v1.DaemonSet, lenDaeSet)
			for i, ds := range daeset {
				nsDaeSets[i] = *(ds.(*apps_v1.DaemonSet))
			}
			log.Tracef("[Kiali Cache] Get [resource: DaemonSet] for [namespace: %s] = %d", namespace, lenDaeSet)
			return nsDaeSets, nil
		}
	}
	return []apps_v1.DaemonSet{}, nil
}

func (c *kialiCacheImpl) GetDaemonSet(namespace, name string) (*apps_v1.DaemonSet, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.DaemonSetType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			ds, ok := obj.(*apps_v1.DaemonSet)
			if !ok {
				return nil, errors.New("bad DaemonSet type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: DaemonSet] for [namespace: %s] [name: %s]", namespace, name)
			return ds, nil
		}
	}
	return nil, nil
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

func (c *kialiCacheImpl) GetEndpoints(namespace, name string) (*core_v1.Endpoints, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.EndpointsType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			eps, ok := obj.(*core_v1.Endpoints)
			if !ok {
				return nil, errors.New("bad Endpoints type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: Endpoints] for [namespace: %s] [name: %s]", namespace, name)
			return eps, nil
		}
	}
	return nil, nil
}

func (c *kialiCacheImpl) GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		ss := nsCache[kubernetes.StatefulSetType].GetStore().List()
		lenSs := len(ss)
		if lenSs > 0 {
			_, ok := ss[0].(*apps_v1.StatefulSet)
			if !ok {
				return nil, errors.New("bad StatefulSet type found in cache")
			}
			nsSs := make([]apps_v1.StatefulSet, lenSs)
			for i, s := range ss {
				nsSs[i] = *(s.(*apps_v1.StatefulSet))
			}
			log.Tracef("[Kiali Cache] Get [resource: StatefulSet] for [namespace: %s] = %d", namespace, lenSs)
			return nsSs, nil
		}
	}
	return []apps_v1.StatefulSet{}, nil
}

func (c *kialiCacheImpl) GetStatefulSet(namespace, name string) (*apps_v1.StatefulSet, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.StatefulSetType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			ss, ok := obj.(*apps_v1.StatefulSet)
			if !ok {
				return nil, errors.New("bad StatefulSet type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: StatefulSet] for [namespace: %s] [name: %s]", namespace, name)
			return ss, nil
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

func (c *kialiCacheImpl) GetService(namespace, name string) (*core_v1.Service, error) {
	if nsCache, ok := c.nsCache[namespace]; ok {
		// Cache stores natively items with namespace/name pattern, we can skip the Indexer by name and make a direct call
		key := namespace + "/" + name
		obj, exist, err := nsCache[kubernetes.ServiceType].GetStore().GetByKey(key)
		if err != nil {
			return nil, err
		}
		if exist {
			svc, ok := obj.(*core_v1.Service)
			if !ok {
				return nil, errors.New("bad Service type found in cache")
			}
			log.Tracef("[Kiali Cache] Get [resource: Service] for [namespace: %s] [name: %s]", namespace, name)
			return svc, nil
		}
	}
	return nil, nil
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
