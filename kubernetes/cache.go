package kubernetes

import (
	"time"

	"github.com/kiali/kiali/log"
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/apps/v1beta2"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	"k8s.io/api/core/v1"
	"k8s.io/client-go/informers"
	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"
)

type (
	// Inspired/reused from istio code:
	// https://github.com/istio/istio/blob/master/mixer/adapter/kubernetesenv/cache.go
	cacheController interface {
		// Control Cache
		Run(<-chan struct{})
		HasSynced() bool
		StopControlChannel()

		// Business methods
		GetCronJobs(namespace string) ([]batch_v1beta1.CronJob, bool)
		GetDeployment(namespace string, name string) (*v1beta1.Deployment, bool)
		GetDeployments(namespace string) ([]v1beta1.Deployment, bool)
		GetEndpoints(namespace, name string) (*v1.Endpoints, bool)
		GetJobs(namespace string) ([]batch_v1.Job, bool)
		GetPods(namespace string) ([]v1.Pod, bool)
		GetReplicationControllers(namespace string) ([]v1.ReplicationController, bool)
		GetReplicaSets(namespace string) ([]v1beta2.ReplicaSet, bool)
		GetService(namespace string, name string) (*v1.Service, bool)
		GetServices(namespace string) ([]v1.Service, bool)
		GetStatefulSet(namespace string, name string) (*v1beta2.StatefulSet, bool)
		GetStatefulSets(namespace string) ([]v1beta2.StatefulSet, bool)
	}

	controllerImpl struct {
		stopChan     chan struct{}
		syncCount    int
		maxSyncCount int
		controllers  map[string]cache.SharedIndexInformer
	}
)

func newCacheController(clientset kube.Interface, refreshDuration time.Duration, stopChan chan struct{}) cacheController {
	sharedInformers := informers.NewSharedInformerFactory(clientset, refreshDuration)
	controllers := make(map[string]cache.SharedIndexInformer)

	controllers["Pod"] = sharedInformers.Core().V1().Pods().Informer()
	controllers["ReplicationController"] = sharedInformers.Core().V1().ReplicationControllers().Informer()
	controllers["Deployment"] = sharedInformers.Apps().V1beta1().Deployments().Informer()
	controllers["ReplicaSet"] = sharedInformers.Apps().V1beta2().ReplicaSets().Informer()
	controllers["StatefulSet"] = sharedInformers.Apps().V1beta2().StatefulSets().Informer()
	controllers["Job"] = sharedInformers.Batch().V1().Jobs().Informer()
	controllers["CronJob"] = sharedInformers.Batch().V1beta1().CronJobs().Informer()
	controllers["Service"] = sharedInformers.Core().V1().Services().Informer()
	controllers["Endpoints"] = sharedInformers.Core().V1().Endpoints().Informer()

	return &controllerImpl{
		stopChan:     stopChan,
		controllers:  controllers,
		syncCount:    0,
		maxSyncCount: 20, // Move this to config ? or this constant is good enough ?
	}
}

func (c *controllerImpl) Run(stop <-chan struct{}) {
	for _, cn := range c.controllers {
		go cn.Run(stop)
	}
	<-stop
}

func (c *controllerImpl) HasSynced() bool {
	if c.syncCount > c.maxSyncCount {
		log.Errorf("Max attempts reached syncing cache. Is there connection with the K8S backend ?")
		c.StopControlChannel()
		return false
	}
	hasSynced := true
	for _, cn := range c.controllers {
		hasSynced = hasSynced && cn.HasSynced()
	}
	if hasSynced {
		c.syncCount = 0
	} else {
		c.syncCount = c.syncCount + 1
	}
	return hasSynced
}

func (c *controllerImpl) StopControlChannel() {
	if c.stopChan != nil {
		close(c.stopChan)
		c.stopChan = nil
	}
}

func (c *controllerImpl) GetCronJobs(namespace string) ([]batch_v1beta1.CronJob, bool) {
	indexer := c.controllers["CronJob"].GetIndexer()
	cronjobs, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return nil, false
	}
	if len(cronjobs) > 0 {
		_, ok := cronjobs[0].(*batch_v1beta1.CronJob)
		if !ok {
			return nil, false
		}
		nsCronjobs := make([]batch_v1beta1.CronJob, len(cronjobs))
		for i, cronjob := range cronjobs {
			nsCronjobs[i] = *(cronjob.(*batch_v1beta1.CronJob))
		}
		return nsCronjobs, true
	}
	return nil, false
}

func (c *controllerImpl) GetDeployment(namespace, name string) (*v1beta1.Deployment, bool) {
	indexer := c.controllers["Deployment"].GetIndexer()
	deps, exist, err := indexer.GetByKey(namespace + "/" + name) // indexer.ByIndex("nsname", namespace + "#" + name)
	if err != nil {
		return nil, false
	}
	if exist {
		dep, ok := deps.(*v1beta1.Deployment)
		if !ok {
			return nil, false
		}
		return dep, true
	}
	return nil, false
}

func (c *controllerImpl) GetDeployments(namespace string) ([]v1beta1.Deployment, bool) {
	indexer := c.controllers["Deployment"].GetIndexer()
	deps, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return nil, false
	}
	if len(deps) > 0 {
		_, ok := deps[0].(*v1beta1.Deployment)
		if !ok {
			return nil, false
		}
		nsDeps := make([]v1beta1.Deployment, len(deps))
		for i, dep := range deps {
			nsDeps[i] = *(dep.(*v1beta1.Deployment))
		}
		return nsDeps, true
	}
	return nil, false
}

func (c *controllerImpl) GetEndpoints(namespace, name string) (*v1.Endpoints, bool) {
	indexer := c.controllers["Endpoints"].GetIndexer()
	endpoints, exist, err := indexer.GetByKey(namespace + "/" + name)
	if err != nil {
		return nil, false
	}
	if exist {
		endpoint, ok := endpoints.(*v1.Endpoints)
		if !ok {
			return nil, false
		}
		return endpoint, true
	}
	return nil, false
}

func (c *controllerImpl) GetJobs(namespace string) ([]batch_v1.Job, bool) {
	indexer := c.controllers["Job"].GetIndexer()
	jobs, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return nil, false
	}
	if len(jobs) > 0 {
		_, ok := jobs[0].(*batch_v1.Job)
		if !ok {
			return nil, false
		}
		nsJobs := make([]batch_v1.Job, len(jobs))
		for i, job := range jobs {
			nsJobs[i] = *(job.(*batch_v1.Job))
		}
		return nsJobs, true
	}
	return nil, false
}

func (c *controllerImpl) GetPods(namespace string) ([]v1.Pod, bool) {
	indexer := c.controllers["Pod"].GetIndexer()
	pods, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return nil, false
	}
	if len(pods) > 0 {
		_, ok := pods[0].(*v1.Pod)
		if !ok {
			return nil, false
		}
		nsPods := make([]v1.Pod, len(pods))
		for i, pod := range pods {
			nsPods[i] = *(pod.(*v1.Pod))
		}
		return nsPods, true
	}
	return nil, false
}

func (c *controllerImpl) GetReplicationControllers(namespace string) ([]v1.ReplicationController, bool) {
	indexer := c.controllers["ReplicationController"].GetIndexer()
	repcons, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return nil, false
	}
	if len(repcons) > 0 {
		_, ok := repcons[0].(*v1.ReplicationController)
		if !ok {
			return nil, false
		}
		nsRepcons := make([]v1.ReplicationController, len(repcons))
		for i, repcon := range repcons {
			nsRepcons[i] = *(repcon.(*v1.ReplicationController))
		}
		return nsRepcons, true
	}
	return nil, false
}

func (c *controllerImpl) GetReplicaSets(namespace string) ([]v1beta2.ReplicaSet, bool) {
	indexer := c.controllers["ReplicaSet"].GetIndexer()
	repsets, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return nil, false
	}
	if len(repsets) > 0 {
		_, ok := repsets[0].(*v1beta2.ReplicaSet)
		if !ok {
			return nil, false
		}
		nsRepsets := make([]v1beta2.ReplicaSet, len(repsets))
		for i, repset := range repsets {
			nsRepsets[i] = *(repset.(*v1beta2.ReplicaSet))
		}
		return nsRepsets, true
	}
	return nil, false
}

func (c *controllerImpl) GetStatefulSet(namespace, name string) (*v1beta2.StatefulSet, bool) {
	indexer := c.controllers["StatefulSet"].GetIndexer()
	fulsets, exist, err := indexer.GetByKey(namespace + "/" + name)
	if err != nil {
		return nil, false
	}
	if exist {
		fulset, ok := fulsets.(*v1beta2.StatefulSet)
		if !ok {
			return nil, false
		}
		return fulset, true
	}
	return nil, false
}

func (c *controllerImpl) GetStatefulSets(namespace string) ([]v1beta2.StatefulSet, bool) {
	indexer := c.controllers["StatefulSet"].GetIndexer()
	fulsets, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return nil, false
	}
	if len(fulsets) > 0 {
		_, ok := fulsets[0].(*v1beta2.StatefulSet)
		if !ok {
			return nil, false
		}
		nsFulsets := make([]v1beta2.StatefulSet, len(fulsets))
		for i, fulset := range fulsets {
			nsFulsets[i] = *(fulset.(*v1beta2.StatefulSet))
		}
		return nsFulsets, true
	}
	return nil, false
}

func (c *controllerImpl) GetService(namespace, name string) (*v1.Service, bool) {
	indexer := c.controllers["Service"].GetIndexer()
	services, exist, err := indexer.GetByKey(namespace + "/" + name)
	if err != nil {
		return nil, false
	}
	if exist {
		service, ok := services.(*v1.Service)
		if !ok {
			return nil, false
		}
		return service, true
	}
	return nil, false
}

func (c *controllerImpl) GetServices(namespace string) ([]v1.Service, bool) {
	indexer := c.controllers["Service"].GetIndexer()
	services, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return nil, false
	}
	if len(services) > 0 {
		_, ok := services[0].(*v1.Service)
		if !ok {
			return nil, false
		}
		nsServices := make([]v1.Service, len(services))
		for i, service := range services {
			nsServices[i] = *(service.(*v1.Service))
		}
		return nsServices, true
	}
	return nil, false
}
