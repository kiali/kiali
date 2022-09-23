package cache

import (
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

// createKubernetesInformers creates kube informers for all objects kiali watches and
// saves them to the typeCache. If namespace is not empty, the informers are scoped
// to the namespace. Otherwise, the informers are cluster-wide.
func (c *kialiCacheImpl) createKubernetesInformers(namespace string) informers.SharedInformerFactory {
	var opts []informers.SharedInformerOption
	if namespace != "" {
		opts = append(opts, informers.WithNamespace(namespace))
	}
	sharedInformers := informers.NewSharedInformerFactoryWithOptions(c.k8sApi, c.refreshDuration, opts...)

	lister := &cacheLister{
		deploymentLister:  sharedInformers.Apps().V1().Deployments().Lister(),
		statefulSetLister: sharedInformers.Apps().V1().StatefulSets().Lister(),
		daemonSetLister:   sharedInformers.Apps().V1().DaemonSets().Lister(),
		serviceLister:     sharedInformers.Core().V1().Services().Lister(),
		endpointLister:    sharedInformers.Core().V1().Endpoints().Lister(),
		podLister:         sharedInformers.Core().V1().Pods().Lister(),
		replicaSetLister:  sharedInformers.Apps().V1().ReplicaSets().Lister(),
		configMapLister:   sharedInformers.Core().V1().ConfigMaps().Lister(),
	}
	sharedInformers.Core().V1().Services().Informer().AddEventHandler(c.registryRefreshHandler)
	sharedInformers.Core().V1().Endpoints().Informer().AddEventHandler(c.registryRefreshHandler)

	if c.clusterScoped {
		c.clusterCacheLister = lister
	} else {
		c.nsCacheLister[namespace] = lister
	}

	return sharedInformers
}

func (c *kialiCacheImpl) getCacheLister(namespace string) *cacheLister {
	if c.clusterScoped {
		return c.clusterCacheLister
	}
	return c.nsCacheLister[namespace]
}

func (c *kialiCacheImpl) GetConfigMap(namespace, name string) (*core_v1.ConfigMap, error) {
	log.Tracef("[Kiali Cache] Get [resource: ConfigMap] for [namespace: %s] [name: %s]", namespace, name)
	cfg, err := c.getCacheLister(namespace).configMapLister.ConfigMaps(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	cfg.Kind = kubernetes.ConfigMapType
	return cfg, nil
}

func (c *kialiCacheImpl) GetDaemonSets(namespace string) ([]apps_v1.DaemonSet, error) {
	daemonSets, err := c.getCacheLister(namespace).daemonSetLister.DaemonSets(namespace).List(labels.Everything())
	if err != nil {
		return nil, err
	}
	log.Tracef("[Kiali Cache] Get [resource: DaemonSet] for [namespace: %s] = %d", namespace, len(daemonSets))

	retSets := []apps_v1.DaemonSet{}
	for _, ds := range daemonSets {
		ds.Kind = kubernetes.DaemonSetType
		retSets = append(retSets, *ds)
	}
	return retSets, nil
}

func (c *kialiCacheImpl) GetDaemonSet(namespace, name string) (*apps_v1.DaemonSet, error) {
	log.Tracef("[Kiali Cache] Get [resource: DaemonSet] for [namespace: %s] [name: %s]", namespace, name)
	ds, err := c.getCacheLister(namespace).daemonSetLister.DaemonSets(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	ds.Kind = kubernetes.DaemonSetType
	return c.getCacheLister(namespace).daemonSetLister.DaemonSets(namespace).Get(name)
}

func (c *kialiCacheImpl) GetDeployments(namespace string) ([]apps_v1.Deployment, error) {
	deployments, err := c.getCacheLister(namespace).deploymentLister.Deployments(namespace).List(labels.Everything())
	if err != nil {
		return nil, err
	}
	log.Tracef("[Kiali Cache] Get [resource: Deployment] for [namespace: %s] = %d", namespace, len(deployments))

	retDeployments := []apps_v1.Deployment{}
	for _, deployment := range deployments {
		deployment.Kind = kubernetes.DeploymentType
		retDeployments = append(retDeployments, *deployment)
	}
	return retDeployments, nil
}

func (c *kialiCacheImpl) GetDeployment(namespace, name string) (*apps_v1.Deployment, error) {
	log.Tracef("[Kiali Cache] Get [resource: Deployment] for [namespace: %s] [name: %s]", namespace, name)
	deployment, err := c.getCacheLister(namespace).deploymentLister.Deployments(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	deployment.Kind = kubernetes.DeploymentType
	return deployment, nil
}

func (c *kialiCacheImpl) GetEndpoints(namespace, name string) (*core_v1.Endpoints, error) {
	log.Tracef("[Kiali Cache] Get [resource: Endpoints] for [namespace: %s] [name: %s]", namespace, name)
	endpoints, err := c.getCacheLister(namespace).endpointLister.Endpoints(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	endpoints.Kind = kubernetes.EndpointsType
	return endpoints, nil
}

func (c *kialiCacheImpl) GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error) {
	statefulSets, err := c.getCacheLister(namespace).statefulSetLister.StatefulSets(namespace).List(labels.Everything())
	if err != nil {
		return nil, err
	}
	log.Tracef("[Kiali Cache] Get [resource: StatefulSet] for [namespace: %s] = %d", namespace, len(statefulSets))

	retSets := []apps_v1.StatefulSet{}
	for _, ss := range statefulSets {
		ss.Kind = kubernetes.StatefulSetType
		retSets = append(retSets, *ss)
	}
	return retSets, nil
}

func (c *kialiCacheImpl) GetStatefulSet(namespace, name string) (*apps_v1.StatefulSet, error) {
	log.Tracef("[Kiali Cache] Get [resource: StatefulSet] for [namespace: %s] [name: %s]", namespace, name)
	statefulSet, err := c.getCacheLister(namespace).statefulSetLister.StatefulSets(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	statefulSet.Kind = kubernetes.StatefulSetType
	return statefulSet, nil
}

func (c *kialiCacheImpl) GetServices(namespace string, selectorLabels map[string]string) ([]core_v1.Service, error) {
	services, err := c.getCacheLister(namespace).serviceLister.Services(namespace).List(labels.Set(selectorLabels).AsSelector())
	if err != nil {
		return nil, err
	}
	log.Tracef("[Kiali Cache] Get [resource: Service] for [namespace: %s] = %d", namespace, len(services))

	retServices := []core_v1.Service{}
	for _, service := range services {
		service.Kind = kubernetes.ServiceType
		retServices = append(retServices, *service)
	}
	return retServices, nil
}

func (c *kialiCacheImpl) GetService(namespace, name string) (*core_v1.Service, error) {
	log.Tracef("[Kiali Cache] Get [resource: Service] for [namespace: %s] [name: %s]", namespace, name)
	service, err := c.getCacheLister(namespace).serviceLister.Services(namespace).Get(name)
	if err != nil {
		return nil, err
	}

	service.Kind = kubernetes.ServiceType
	return service, nil
}

func (c *kialiCacheImpl) GetPods(namespace, labelSelector string) ([]core_v1.Pod, error) {
	selector, err := labels.Parse(labelSelector)
	if err != nil {
		return nil, err
	}

	pods, err := c.getCacheLister(namespace).podLister.Pods(namespace).List(selector)
	if err != nil {
		return nil, err
	}
	log.Tracef("[Kiali Cache] Get [resource: Pod] for [namespace: %s] = %d", namespace, len(pods))

	retPods := []core_v1.Pod{}
	for _, pod := range pods {
		pod.Kind = kubernetes.PodType
		retPods = append(retPods, *pod)
	}
	return retPods, nil
}

// GetReplicaSets returns the cached ReplicaSets for the namespace.  For any given RS for a given
// Owner (i.e. Deployment), only the most recent version of the RS will be included in the returned list.
// When an owning Deployment is configured with revisionHistoryLimit > 0, then k8s may return multiple
// versions of the RS for the same Deployment (current and older revisions). Note that it is still possible
// to have multiple RS for the same owner. In which case the most recent version of each is returned.
// see also: ../kubernetes.go
func (c *kialiCacheImpl) GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error) {
	reps, err := c.getCacheLister(namespace).replicaSetLister.ReplicaSets(namespace).List(labels.Everything())
	if err != nil {
		return nil, err
	}

	result := []apps_v1.ReplicaSet{}
	if len(reps) > 0 {
		activeRSMap := map[string]*apps_v1.ReplicaSet{}
		for _, rs := range reps {
			if len(rs.OwnerReferences) > 0 {
				for _, ownerRef := range rs.OwnerReferences {
					if ownerRef.Controller != nil && *ownerRef.Controller {
						if currRS, ok := activeRSMap[fmt.Sprintf("%s_%s_%s", ownerRef.Name, rs.Name, rs.ResourceVersion)]; ok {
							if currRS.CreationTimestamp.Time.Before(rs.CreationTimestamp.Time) {
								activeRSMap[ownerRef.Name] = rs
							}
						} else {
							activeRSMap[ownerRef.Name] = rs
						}
					}
				}
			} else {
				// it is it's own controller
				activeRSMap[rs.Name] = rs
			}
		}

		lenRS := len(activeRSMap)
		result = make([]apps_v1.ReplicaSet, lenRS)
		i := 0
		for _, activeRS := range activeRSMap {
			activeRS.Kind = kubernetes.ReplicaSetType
			result[i] = *(activeRS)
			i = i + 1
		}
		log.Tracef("[Kiali Cache] Get [resource: ReplicaSet] for [namespace: %s] = %d", namespace, lenRS)
	}
	return result, nil
}
