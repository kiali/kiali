package kubernetes

import (
	"errors"
	"fmt"
	"sync"
	"time"

	apps_v1 "k8s.io/api/apps/v1"
	batch_v1 "k8s.io/api/batch/v1"
	batch_v1beta1 "k8s.io/api/batch/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/informers"
	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"

	osproject_v1 "github.com/openshift/api/project/v1"
	osproject_v1_client "github.com/openshift/client-go/project/clientset/versioned/typed/project/v1"

	"github.com/kiali/kiali/log"
)

type (
	// Inspired/reused from istio code:
	// https://github.com/istio/istio/blob/master/mixer/adapter/kubernetesenv/cache.go
	cacheController interface {
		// Control Cache
		Start()
		HasSynced() bool
		WaitForSync() bool
		Stop()

		// Business methods
		GetCronJobs(namespace string) ([]batch_v1beta1.CronJob, error)
		GetDeployment(namespace string, name string) (*apps_v1.Deployment, error)
		GetDeployments(namespace string) ([]apps_v1.Deployment, error)
		GetEndpoints(namespace, name string) (*core_v1.Endpoints, error)
		GetJobs(namespace string) ([]batch_v1.Job, error)
		GetPods(namespace string) ([]core_v1.Pod, error)
		GetReplicationControllers(namespace string) ([]core_v1.ReplicationController, error)
		GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error)
		GetService(namespace string, name string) (*core_v1.Service, error)
		GetServices(namespace string) ([]core_v1.Service, error)
		GetStatefulSet(namespace string, name string) (*apps_v1.StatefulSet, error)
		GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error)

		// Openshift caches
		GetProjects() ([]osproject_v1.Project, error)

		// Istio caches
		GetVirtualServices(namespace string) (*GenericIstioObjectList, error)
	}

	controllerImpl struct {
		istioClient     IstioClient
		clientset       *kube.Clientset
		refreshDuration time.Duration
		stopChan        chan struct{}
		syncCount       int
		maxSyncCount    int
		isErrorState    bool
		lastError       error
		lastErrorLock   sync.Mutex
		controllers     map[string]map[string]cache.SharedIndexInformer
		projectInformer cache.SharedIndexInformer
		syncLock        sync.Mutex
	}
)

var (
	lastCacheErrorLock sync.Mutex
	errorCallbacks     []func(error)
)

func init() {
	setupErrorHandlers()
	errorCallbacks = make([]func(error), 0)
}

func setupErrorHandlers() {
	nErrFunc := len(utilruntime.ErrorHandlers)
	customErrorHandler := make([]func(error), nErrFunc+1)
	copy(customErrorHandler, utilruntime.ErrorHandlers)
	customErrorHandler[nErrFunc] = func(err error) {
		for _, callback := range errorCallbacks {
			callback(err)
		}
	}
	utilruntime.ErrorHandlers = customErrorHandler
}

func registerErrorCallback(callback func(error)) {
	defer lastCacheErrorLock.Unlock()
	lastCacheErrorLock.Lock()
	errorCallbacks = append(errorCallbacks, callback)
}

func newCacheController(client IstioClient, refreshDuration time.Duration) cacheController {
	clientset := client.k8s
	newControllerImpl := controllerImpl{
		istioClient:     client,
		clientset:       clientset,
		refreshDuration: refreshDuration,
		stopChan:        nil,
		controllers:     make(map[string]map[string]cache.SharedIndexInformer),
		projectInformer: createProjectsInformer(client.projectApi, refreshDuration),
		// controllers:     initControllers(clientset, refreshDuration),
		syncCount:    0,
		maxSyncCount: 200, // Move this to config ? or this constant is good enough ?
	}
	registerErrorCallback(newControllerImpl.ErrorCallback)

	return &newControllerImpl
}

func initProjectInformer(clientset *kube.Clientset, refreshDuration time.Duration) cache.SharedIndexInformer {
	// if c, ok := clientset.(*kube.Clientset); ok {
	// TODO This is only for Openshift, we need separate code for Kubernetes
	// projectsInformer := createProjectsInformer(c, refreshDuration)
	// return projectsInformer
	// }
	// log.Errorf("Failed to init K8sCache, Clientset not compatible")
	return nil
}

func (c *controllerImpl) initControllersNamespace(clientset kube.Interface, refreshDuration time.Duration, namespace string) map[string]cache.SharedIndexInformer {
	sharedInformers := informers.NewSharedInformerFactoryWithOptions(clientset, refreshDuration, informers.WithNamespace(namespace))
	controllers := make(map[string]cache.SharedIndexInformer)
	controllers["Pod"] = sharedInformers.Core().V1().Pods().Informer()
	controllers["ReplicationController"] = sharedInformers.Core().V1().ReplicationControllers().Informer()
	controllers["Deployment"] = sharedInformers.Apps().V1().Deployments().Informer()
	controllers["ReplicaSet"] = sharedInformers.Apps().V1().ReplicaSets().Informer()
	controllers["StatefulSet"] = sharedInformers.Apps().V1().StatefulSets().Informer()
	controllers["Job"] = sharedInformers.Batch().V1().Jobs().Informer()
	controllers["CronJob"] = sharedInformers.Batch().V1beta1().CronJobs().Informer()
	controllers["Service"] = sharedInformers.Core().V1().Services().Informer()
	controllers["Endpoints"] = sharedInformers.Core().V1().Endpoints().Informer()
	// controllers["Namespaces"] = sharedInformers.Core().V1().Namespaces().Informer()

	controllers = c.initIstioControllersNamespace(namespace, controllers)
	return controllers
}

func (c *controllerImpl) initIstioControllersNamespace(namespace string, controllers map[string]cache.SharedIndexInformer) map[string]cache.SharedIndexInformer {
	controllers["VirtualServices"] = cache.NewSharedIndexInformer(cache.NewListWatchFromClient(c.istioClient.istioNetworkingApi, "virtualservices", namespace, fields.Everything()),
		&GenericIstioObjectList{},
		c.refreshDuration,
		cache.Indexers{},
	)
	return controllers
}

func (c *controllerImpl) ProjectListener() cache.ResourceEventHandlerFuncs {
	// TODO Might need to sync with NamespaceService to make sure we're not running in Maistra with accessibleNamespaces modifier
	return cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			project := obj.(*osproject_v1.Project)
			name := project.GetObjectMeta().GetName()
			if _, found := c.controllers[name]; found {
				// TODO Existing project reappeared.. close and reopen?
				return
			}
			c.syncLock.Lock()
			defer c.syncLock.Unlock()
			log.Infof("Starting controllers for project name: %s\n", name) // TODO Debugf
			c.controllers[name] = c.initControllersNamespace(c.clientset, c.refreshDuration, name)
			c.run(c.controllers[name])
			synced := c.WaitForSync() // WaitForSync before allowing creation of more..
			if !synced {
				log.Errorf("Could not sync the cache..")
			} else {
				log.Infof("Synced, ready for more..")
			}
		},
	}
}

func (c *controllerImpl) Start() {
	c.projectInformer.AddEventHandler(c.ProjectListener())

	if c.stopChan == nil {
		c.stopChan = make(chan struct{})
		go c.projectInformer.Run(c.stopChan)
		log.Infof("K8S cache started")
	} else {
		log.Warningf("K8S cache is already running")
	}
}

func (c *controllerImpl) run(controllers map[string]cache.SharedIndexInformer) {
	for _, cn := range controllers {
		go cn.Run(c.stopChan)
	}
}

func (c *controllerImpl) HasSynced() bool {
	if c.syncCount > c.maxSyncCount {
		log.Errorf("Max attempts reached syncing cache. Error connecting to k8s API: %d > %d", c.syncCount, c.maxSyncCount)
		c.Stop()
		return false
	}
	hasSynced := true
	for _, ns := range c.controllers {
		for _, cn := range ns {
			hasSynced = hasSynced && cn.HasSynced()
		}
	}
	if hasSynced {
		c.syncCount = 0
	} else {
		c.syncCount = c.syncCount + 1
	}
	return hasSynced
}

func (c *controllerImpl) WaitForSync() bool {
	synced := make([]cache.InformerSynced, 0, 128)
	for _, ns := range c.controllers {
		for _, cn := range ns {
			synced = append(synced, cn.HasSynced)
		}
	}
	return cache.WaitForCacheSync(c.stopChan, synced...)
}

func (c *controllerImpl) Stop() {
	if c.stopChan != nil {
		close(c.stopChan)
		c.stopChan = nil
	}
}

func (c *controllerImpl) ErrorCallback(err error) {
	if !c.isErrorState {
		log.Warningf("Error callback received: %s", err)
		c.lastErrorLock.Lock()
		c.isErrorState = true
		c.lastError = err
		c.lastErrorLock.Unlock()
		c.Stop()
	}
}

func (c *controllerImpl) checkStateAndRetry() error {
	if !c.isErrorState {
		return nil
	}

	return fmt.Errorf("Errors errors everywhere")
	/*
		// Retry of the cache is hold by one single goroutine
		c.lastErrorLock.Lock()
		if c.isErrorState {
			// ping to check if backend is still unavailable (used namespace endpoint)
			_, err := c.clientset.CoreV1().Namespaces().List(emptyListOptions) // Not acceptable in Openshift?
			if err != nil {
				c.lastError = fmt.Errorf("error retrying to connect to K8S API backend. %s", err)
			} else {
				c.lastError = nil
				c.isErrorState = false
				c.Start()
				c.WaitForSync()
			}
		}
		c.lastErrorLock.Unlock()
		return c.lastError
	*/
}

func (c *controllerImpl) GetCronJobs(namespace string) ([]batch_v1beta1.CronJob, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return []batch_v1beta1.CronJob{}, err
	}
	if _, found := c.controllers[namespace]; !found {
		return nil, nil
	}

	indexer := c.controllers[namespace]["CronJob"].GetIndexer()
	cronjobs, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return []batch_v1beta1.CronJob{}, err
	}
	if len(cronjobs) > 0 {
		_, ok := cronjobs[0].(*batch_v1beta1.CronJob)
		if !ok {
			return []batch_v1beta1.CronJob{}, errors.New("bad CronJob type found in cache")
		}
		nsCronjobs := make([]batch_v1beta1.CronJob, len(cronjobs))
		for i, cronjob := range cronjobs {
			nsCronjobs[i] = *(cronjob.(*batch_v1beta1.CronJob))
		}
		return nsCronjobs, nil
	}
	return []batch_v1beta1.CronJob{}, nil
}

func (c *controllerImpl) GetDeployment(namespace, name string) (*apps_v1.Deployment, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return nil, err
	}
	if _, found := c.controllers[namespace]; !found {
		return nil, nil
	}

	indexer := c.controllers[namespace]["Deployment"].GetIndexer()
	deps, exist, err := indexer.GetByKey(namespace + "/" + name)
	if err != nil {
		return nil, err
	}
	if exist {
		dep, ok := deps.(*apps_v1.Deployment)
		if !ok {
			return nil, errors.New("bad Deployment type found in cache")
		}
		return dep, nil
	}
	return nil, NewNotFound(name, "apps/v1", "Deployment")
}

func (c *controllerImpl) GetDeployments(namespace string) ([]apps_v1.Deployment, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return []apps_v1.Deployment{}, err
	}
	if _, found := c.controllers[namespace]; !found {
		return nil, nil
	}

	indexer := c.controllers[namespace]["Deployment"].GetIndexer()
	deps, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return []apps_v1.Deployment{}, err
	}
	if len(deps) > 0 {
		_, ok := deps[0].(*apps_v1.Deployment)
		if !ok {
			return nil, errors.New("bad Deployment type found in cache")
		}
		nsDeps := make([]apps_v1.Deployment, len(deps))
		for i, dep := range deps {
			nsDeps[i] = *(dep.(*apps_v1.Deployment))
		}
		return nsDeps, nil
	}
	return []apps_v1.Deployment{}, nil
}

func (c *controllerImpl) GetEndpoints(namespace, name string) (*core_v1.Endpoints, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return nil, err
	}
	if _, found := c.controllers[namespace]; !found {
		return nil, nil
	}
	indexer := c.controllers[namespace]["Endpoints"].GetIndexer()
	endpoints, exist, err := indexer.GetByKey(namespace + "/" + name)
	if err != nil {
		return nil, err
	}
	if exist {
		endpoint, ok := endpoints.(*core_v1.Endpoints)
		if !ok {
			return nil, errors.New("bad Endpoints type found in cache")
		}
		return endpoint, nil
	}
	return nil, NewNotFound(name, "core/v1", "Endpoints")
}

func (c *controllerImpl) GetJobs(namespace string) ([]batch_v1.Job, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return []batch_v1.Job{}, err
	}
	if _, found := c.controllers[namespace]; !found {
		return nil, nil
	}
	indexer := c.controllers[namespace]["Job"].GetIndexer()
	jobs, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return []batch_v1.Job{}, err
	}
	if len(jobs) > 0 {
		_, ok := jobs[0].(*batch_v1.Job)
		if !ok {
			return []batch_v1.Job{}, errors.New("bad Job type found in cache")
		}
		nsJobs := make([]batch_v1.Job, len(jobs))
		for i, job := range jobs {
			nsJobs[i] = *(job.(*batch_v1.Job))
		}
		return nsJobs, nil
	}
	return []batch_v1.Job{}, nil
}

func (c *controllerImpl) GetPods(namespace string) ([]core_v1.Pod, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return []core_v1.Pod{}, err
	}
	if _, found := c.controllers[namespace]; !found {
		return nil, nil
	}
	indexer := c.controllers[namespace]["Pod"].GetIndexer()
	pods, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return []core_v1.Pod{}, err
	}
	if len(pods) > 0 {
		_, ok := pods[0].(*core_v1.Pod)
		if !ok {
			return []core_v1.Pod{}, errors.New("bad Pod type found in cache")
		}
		nsPods := make([]core_v1.Pod, len(pods))
		for i, pod := range pods {
			nsPods[i] = *(pod.(*core_v1.Pod))
		}
		return nsPods, nil
	}
	return []core_v1.Pod{}, nil
}

func (c *controllerImpl) GetReplicationControllers(namespace string) ([]core_v1.ReplicationController, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return []core_v1.ReplicationController{}, err
	}
	if _, found := c.controllers[namespace]; !found {
		return nil, nil
	}
	indexer := c.controllers[namespace]["ReplicationController"].GetIndexer()
	repcons, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return []core_v1.ReplicationController{}, err
	}
	if len(repcons) > 0 {
		_, ok := repcons[0].(*core_v1.ReplicationController)
		if !ok {
			return []core_v1.ReplicationController{}, errors.New("bad ReplicationController type found in cache")
		}
		nsRepcons := make([]core_v1.ReplicationController, len(repcons))
		for i, repcon := range repcons {
			nsRepcons[i] = *(repcon.(*core_v1.ReplicationController))
		}
		return nsRepcons, nil
	}
	return []core_v1.ReplicationController{}, nil
}

func (c *controllerImpl) GetReplicaSets(namespace string) ([]apps_v1.ReplicaSet, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return []apps_v1.ReplicaSet{}, err
	}
	if _, found := c.controllers[namespace]; !found {
		return nil, nil
	}
	indexer := c.controllers[namespace]["ReplicaSet"].GetIndexer()
	repsets, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return []apps_v1.ReplicaSet{}, err
	}
	if len(repsets) > 0 {
		_, ok := repsets[0].(*apps_v1.ReplicaSet)
		if !ok {
			return []apps_v1.ReplicaSet{}, errors.New("bad ReplicaSet type found in cache")
		}
		nsRepsets := make([]apps_v1.ReplicaSet, len(repsets))
		for i, repset := range repsets {
			nsRepsets[i] = *(repset.(*apps_v1.ReplicaSet))
		}
		return nsRepsets, nil
	}
	return []apps_v1.ReplicaSet{}, nil
}

func (c *controllerImpl) GetStatefulSet(namespace, name string) (*apps_v1.StatefulSet, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return nil, err
	}
	if _, found := c.controllers[namespace]; !found {
		return nil, nil
	}
	indexer := c.controllers[namespace]["StatefulSet"].GetIndexer()
	fulsets, exist, err := indexer.GetByKey(namespace + "/" + name)
	if err != nil {
		return nil, err
	}
	if exist {
		fulset, ok := fulsets.(*apps_v1.StatefulSet)
		if !ok {
			return nil, errors.New("bad StatefulSet type found in cache")
		}
		return fulset, nil
	}
	return nil, NewNotFound(name, "apps/v1", "StatefulSet")
}

func (c *controllerImpl) GetStatefulSets(namespace string) ([]apps_v1.StatefulSet, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return []apps_v1.StatefulSet{}, err
	}
	if _, found := c.controllers[namespace]; !found {
		return nil, nil
	}
	indexer := c.controllers[namespace]["StatefulSet"].GetIndexer()
	fulsets, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return []apps_v1.StatefulSet{}, err
	}
	if len(fulsets) > 0 {
		_, ok := fulsets[0].(*apps_v1.StatefulSet)
		if !ok {
			return []apps_v1.StatefulSet{}, errors.New("bad StatefulSet type found in cache")
		}
		nsFulsets := make([]apps_v1.StatefulSet, len(fulsets))
		for i, fulset := range fulsets {
			nsFulsets[i] = *(fulset.(*apps_v1.StatefulSet))
		}
		return nsFulsets, nil
	}
	return []apps_v1.StatefulSet{}, nil
}

func (c *controllerImpl) GetService(namespace, name string) (*core_v1.Service, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return nil, err
	}
	if _, found := c.controllers[namespace]; !found {
		log.Infof("No service informers for %s found", namespace)
		return nil, nil
	}
	indexer := c.controllers[namespace]["Service"].GetIndexer()
	services, exist, err := indexer.GetByKey(namespace + "/" + name)
	if err != nil {
		return nil, err
	}
	if exist {
		service, ok := services.(*core_v1.Service)
		if !ok {
			return nil, errors.New("bad Service type found in cache")
		}
		return service, nil
	}
	return nil, NewNotFound(name, "core/v1", "Service")
}

func (c *controllerImpl) GetServices(namespace string) ([]core_v1.Service, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return []core_v1.Service{}, err
	}
	if _, found := c.controllers[namespace]; !found {
		log.Infof("No services informers for %s found", namespace)
		return []core_v1.Service{}, nil
	}
	indexer := c.controllers[namespace]["Service"].GetIndexer()
	services, err := indexer.ByIndex("namespace", namespace)
	if err != nil {
		return []core_v1.Service{}, err
	}
	if len(services) > 0 {
		_, ok := services[0].(*core_v1.Service)
		if !ok {
			return []core_v1.Service{}, errors.New("bad Service type found in cache")
		}
		nsServices := make([]core_v1.Service, len(services))
		for i, service := range services {
			nsServices[i] = *(service.(*core_v1.Service))
		}
		return nsServices, nil
	}
	return []core_v1.Service{}, nil
}

func (c *controllerImpl) GetProjects() ([]osproject_v1.Project, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return []osproject_v1.Project{}, err
	}

	projects := c.projectInformer.GetIndexer().List()
	// projects := c.projectInformer.GetStore().List()
	if len(projects) > 0 {
		if _, ok := projects[0].(*osproject_v1.Project); ok {
			osProjects := make([]osproject_v1.Project, len(projects))
			for i, project := range projects {
				osProjects[i] = *(project.(*osproject_v1.Project))
			}
			return osProjects, nil
		}
	}

	return []osproject_v1.Project{}, nil
}

func createProjectsInformer(client *osproject_v1_client.ProjectV1Client, refreshDuration time.Duration) cache.SharedIndexInformer {
	return cache.NewSharedIndexInformer(cache.NewListWatchFromClient(client.RESTClient(), "projects", meta_v1.NamespaceAll, fields.Everything()),
		&osproject_v1.ProjectList{},
		refreshDuration,
		cache.Indexers{},
	)
}

func (c *controllerImpl) GetVirtualServices(namespace string) (*GenericIstioObjectList, error) {
	return c.getGenericIstioObjectList(namespace, "VirtualServices")
}

func (c *controllerImpl) getGenericIstioObjectList(namespace, istioType string) (*GenericIstioObjectList, error) {
	// Do the parsing from GenericIstioObjectList to the correct one in istio_details_service.go so we don't replicate this..
	if err := c.checkStateAndRetry(); err != nil {
		return nil, err
	}
	if _, found := c.controllers[namespace]; !found {
		log.Infof("No %s informers for %s found", istioType, namespace) // Debugf
		return nil, nil
	}

	vss := c.controllers[namespace][istioType].GetIndexer().List()
	if len(vss) > 0 {
		log.Infof("Got %d %s items back from cache", len(vss), istioType) // Debugf
		list, ok := vss[0].(*GenericIstioObjectList)
		if ok {
			return list, nil
		}
	}

	return nil, nil
}
