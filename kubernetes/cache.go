package kubernetes

import (
	"errors"
	"fmt"
	"reflect"
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
	"k8s.io/client-go/kubernetes"
	kube "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/cache"

	osproject_v1 "github.com/openshift/api/project/v1"
	osproject_v1_client "github.com/openshift/client-go/project/clientset/versioned/typed/project/v1"

	"github.com/kiali/kiali/config"
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
		GetNamespaces() ([]core_v1.Namespace, error)

		// Openshift caches
		GetProjects() ([]osproject_v1.Project, error)

		// Istio caches
		GetVirtualServices(namespace string) (*GenericIstioObjectList, error)

		// Allow subset of cache to be used
		KubeCached(namespace string) bool
		// OpenshiftCached(namespace string) bool
		IstioCached(namespace string) bool
	}

	controllerImpl struct {
		istioClient       IstioClient
		clientset         *kube.Clientset
		refreshDuration   time.Duration
		stopChans         map[string]chan struct{}
		controlStopChan   chan struct{}
		syncCount         int
		maxSyncCount      int
		isErrorState      bool
		lastError         error
		lastErrorLock     sync.Mutex
		controllers       map[string]map[string]cache.SharedIndexInformer
		istioControllers  map[string]map[string]cache.SharedIndexInformer
		projectInformer   cache.SharedIndexInformer
		syncLock          sync.Mutex
		istioEnabled      bool
		kubernetesEnabled bool
		// openshiftEnabled  bool
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

func newCacheController(client IstioClient, cacheCfg config.CacheConfig) cacheController {
	clientset := client.k8s
	newControllerImpl := controllerImpl{
		istioClient:       client,
		clientset:         clientset,
		refreshDuration:   time.Duration(cacheCfg.CacheDuration),
		stopChans:         make(map[string]chan struct{}),
		controllers:       make(map[string]map[string]cache.SharedIndexInformer),
		istioControllers:  make(map[string]map[string]cache.SharedIndexInformer),
		syncCount:         0,
		maxSyncCount:      200, // Move this to config ? or this constant is good enough ?
		istioEnabled:      cacheCfg.IstioObjects,
		kubernetesEnabled: cacheCfg.KubernetesObjects,
		// openshiftEnabled:  cacheCfg.KubernetesObjects, // TODO This is for now the same as there's only a single type
	}
	if client.IsOpenShift() {
		newControllerImpl.projectInformer = createProjectsInformer(client.projectApi, time.Duration(cacheCfg.CacheDuration))
	} else {
		newControllerImpl.projectInformer = createNamespaceInformer(clientset, time.Duration(cacheCfg.CacheDuration))
	}
	registerErrorCallback(newControllerImpl.ErrorCallback)

	return &newControllerImpl
}

func (c *controllerImpl) initKubernetesControllersNamespace(namespace string) {
	sharedInformers := informers.NewSharedInformerFactoryWithOptions(c.clientset, c.refreshDuration, informers.WithNamespace(namespace))
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

	c.controllers[namespace] = controllers
}

func (c *controllerImpl) initIstioControllersNamespace(namespace string) {
	// Caching only objects that are used in the validations

	controllers := make(map[string]cache.SharedIndexInformer)
	// Networking API
	controllers[virtualServiceType] = createIstioIndexInformer(c.istioClient.istioNetworkingApi, virtualServices, c.refreshDuration, namespace)
	controllers[destinationRuleType] = createIstioIndexInformer(c.istioClient.istioNetworkingApi, destinationRules, c.refreshDuration, namespace)
	controllers[gatewayType] = createIstioIndexInformer(c.istioClient.istioNetworkingApi, gateways, c.refreshDuration, namespace)
	controllers[serviceentryType] = createIstioIndexInformer(c.istioClient.istioNetworkingApi, serviceentries, c.refreshDuration, namespace)

	// Authentication API
	// controllers[meshPolicyType] = createIstioIndexInformer(c.istioClient.istioAuthenticationApi, meshPolicies, c.refreshDuration, namespace)
	controllers[policyType] = createIstioIndexInformer(c.istioClient.istioAuthenticationApi, policies, c.refreshDuration, namespace)

	// RBAC API
	controllers[serviceroleType] = createIstioIndexInformer(c.istioClient.istioRbacApi, serviceroles, c.refreshDuration, namespace)
	controllers[servicerolebindingType] = createIstioIndexInformer(c.istioClient.istioRbacApi, servicerolebindings, c.refreshDuration, namespace)
	// controllers[clusterrbacconfigType] = createIstioIndexInformer(c.istioClient.istioRbacApi, clusterrbacconfigs, c.refreshDuration, namespace)

	// Enable
	c.istioControllers[namespace] = controllers
}

func createIstioIndexInformer(getter cache.Getter, resourceType string, refreshDuration time.Duration, namespace string) cache.SharedIndexInformer {
	return cache.NewSharedIndexInformer(cache.NewListWatchFromClient(getter, resourceType, namespace, fields.Everything()),
		&GenericIstioObject{},
		refreshDuration,
		cache.Indexers{},
	)
}

func (c *controllerImpl) ProjectListener() cache.ResourceEventHandlerFuncs {
	return cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			project := obj.(*osproject_v1.Project)
			namespace := project.GetObjectMeta().GetName()
			c.controllerInitializer(namespace)
		},
		DeleteFunc: func(obj interface{}) {
			project := obj.(*osproject_v1.Project)
			namespace := project.GetObjectMeta().GetName()
			c.stopNamespace(namespace)
		},
	}
}

func (c *controllerImpl) NamespaceListener() cache.ResourceEventHandlerFuncs {
	return cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			namespaceObj := obj.(*core_v1.Namespace)
			namespace := namespaceObj.GetObjectMeta().GetName()
			c.controllerInitializer(namespace)
		},
		DeleteFunc: func(obj interface{}) {
			namespaceObj := obj.(*core_v1.Namespace)
			namespace := namespaceObj.GetObjectMeta().GetName()
			c.stopNamespace(namespace)
		},
	}
}

func (c *controllerImpl) controllerInitializer(namespace string) {
	if !c.kubernetesEnabled && !c.istioEnabled {
		return
	}

	if _, found := c.stopChans[namespace]; found {
		// Existing project reappeared.. we might have new settings, so closing the previous ones
		log.Debugf("Namespace %s reappeared to the informer.. closing existing", namespace)
		c.stopNamespace(namespace)
	}

	c.syncLock.Lock()
	defer c.syncLock.Unlock()
	// Maybe this should wait for the actual controllers to start before
	// creating more?

	stopChan := make(chan struct{})
	c.stopChans[namespace] = stopChan
	log.Debugf("Starting controllers for namespace: %s\n", namespace)
	if c.kubernetesEnabled {
		c.initKubernetesControllersNamespace(namespace)
		run(c.controllers[namespace], stopChan)
	}
	if c.istioEnabled {
		c.initIstioControllersNamespace(namespace)
		run(c.istioControllers[namespace], stopChan)
	}

	// TODO Previous istioEnabled && kubernetesEnabled are allowing isEnabled too soon, before the
	// caches are synced

	c.WaitForSync()
}

func (c *controllerImpl) Start() {
	if c.istioClient.IsOpenShift() {
		c.projectInformer.AddEventHandler(c.ProjectListener())
	} else {
		c.projectInformer.AddEventHandler(c.NamespaceListener())
	}

	if c.controlStopChan == nil {
		c.controlStopChan = make(chan struct{})
		c.projectInformer.Run(c.controlStopChan)
		log.Infof("K8S cache started")
	} else {
		log.Warningf("K8S cache is already running")
	}
}

func (c *controllerImpl) stopNamespace(namespace string) {
	if stopChan, found := c.stopChans[namespace]; found {
		close(stopChan)
		delete(c.controllers, namespace)
		delete(c.istioControllers, namespace)
		delete(c.stopChans, namespace)
	}
}

func run(controllers map[string]cache.SharedIndexInformer, stopChan chan struct{}) {
	for _, cn := range controllers {
		cn.Run(stopChan)
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
	syncSuccess := cache.WaitForCacheSync(c.controlStopChan, synced...)
	if !syncSuccess {
		c.lastErrorLock.Lock()
		c.isErrorState = true
		c.lastError = fmt.Errorf("failed to sync cache")
		c.lastErrorLock.Unlock()
		c.Stop()
	}
	return syncSuccess
}

func (c *controllerImpl) Stop() {
	c.syncLock.Lock()
	defer c.syncLock.Unlock()

	c.kubernetesEnabled = false
	c.istioEnabled = false

	for ns, ch := range c.stopChans {
		close(ch)
		delete(c.stopChans, ns)
	}
	close(c.controlStopChan)
	c.controlStopChan = make(chan struct{})
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
	return c.lastError

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

func (c *controllerImpl) GetNamespaces() ([]core_v1.Namespace, error) {
	if err := c.checkStateAndRetry(); err != nil {
		return []core_v1.Namespace{}, err
	}

	namespaces := c.projectInformer.GetIndexer().List()
	if len(namespaces) > 0 {
		if _, ok := namespaces[0].(*core_v1.Namespace); ok {
			coreNamespaces := make([]core_v1.Namespace, len(namespaces))
			for i, ns := range namespaces {
				coreNamespaces[i] = *(ns.(*core_v1.Namespace))
			}
			return coreNamespaces, nil
		}
	}

	return []core_v1.Namespace{}, nil

}

func createProjectsInformer(client *osproject_v1_client.ProjectV1Client, refreshDuration time.Duration) cache.SharedIndexInformer {
	return cache.NewSharedIndexInformer(cache.NewListWatchFromClient(client.RESTClient(), "projects", meta_v1.NamespaceAll, fields.Everything()),
		&osproject_v1.Project{},
		refreshDuration,
		cache.Indexers{},
	)
}

func createNamespaceInformer(clientset kubernetes.Interface, refreshDuration time.Duration) cache.SharedIndexInformer {
	sharedInformer := informers.NewSharedInformerFactory(clientset, refreshDuration)
	return sharedInformer.Core().V1().Namespaces().Informer()
}

func (c *controllerImpl) GetVirtualServices(namespace string) (*GenericIstioObjectList, error) {
	return c.getGenericIstioObjectList(namespace, virtualServiceType)
}

func (c *controllerImpl) getGenericIstioObjectList(namespace, istioType string) (*GenericIstioObjectList, error) {
	// Do the parsing from GenericIstioObjectList to the correct one in istio_details_service.go so we don't replicate that code..
	if err := c.checkStateAndRetry(); err != nil {
		return nil, err
	}
	if _, found := c.istioControllers[namespace]; !found {
		log.Debugf("No %s informers for %s found", istioType, namespace) // Debugf
		return nil, fmt.Errorf("Istio caching is not enabled for namespace %s", namespace)
	}

	vss := c.istioControllers[namespace][istioType].GetIndexer().List()
	log.Infof("Len of vss: %d for %s\n", len(vss), namespace)
	if len(vss) > 0 {
		log.Debugf("Received object of type: %s\n", reflect.TypeOf(vss[0]))
		itemList := &GenericIstioObjectList{}
		obj, ok := vss[0].(*GenericIstioObject)
		if ok {
			itemList.TypeMeta = obj.TypeMeta
			objects := make([]GenericIstioObject, 0, len(vss))
			for _, o := range vss {
				obj, ok := o.(*GenericIstioObject)
				if ok {
					objects = append(objects, *obj)
				}
			}
			itemList.Items = objects
			log.Debugf("Returning items size: %d\n", len(itemList.Items))
			return itemList, nil
		}
		log.Infof("Got %d %s items back from cache", len(vss), istioType) // Debugf
	}

	return nil, nil
}

// Allow subset of cache to be used - could be enabled all the way to namespace level
// TODO There's no config option for namespace level configuration yet
func (c *controllerImpl) KubeCached(namespace string) bool {
	if c.kubernetesEnabled && !c.isErrorState {
		_, found := c.controllers[namespace]
		return found
	}
	return false
}

// func (c *controllerImpl) OpenshiftCached(namespace string) bool {
// 	return c.openshiftEnabled && !c.isErrorState
// }

func (c *controllerImpl) IstioCached(namespace string) bool {
	if c.istioEnabled && !c.isErrorState {
		_, found := c.istioControllers[namespace]
		return found
	}
	return false
}

// Projects / namespaces are always cached if the cache is created
