package cache

import (
	"regexp"
	"strings"
	"time"

	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/kubernetes"
)

// Istio uses caches for pods and controllers.
// Kiali will use caches for specific namespaces and types
// https://github.com/istio/istio/blob/master/mixer/adapter/kubernetesenv/cache.go

type (
	KialiCache interface {
		// Control methods
		// Check if a namespace is listed to be cached; if yes, creates a cache for that namespace
		CheckNamespace(namespace string) bool
		// Stop all caches
		Stop()

		KubernetesCache
		IstioCache
	}

	// This map will store Informers per specific types
	// i.e. map["Deployment"], map["Service"]
	typeCache map[string]cache.SharedIndexInformer

	kialiCacheImpl struct {
		istioClient     kubernetes.IstioClient
		refreshDuration time.Duration
		cacheNamespaces []string
		stopChan        chan struct{}
		nsCache         map[string]typeCache
	}
)

func NewKialiCache() (KialiCache, error) {
	config, err := kubernetes.ConfigClient()
	if err != nil {
		return nil, err
	}
	// Kiali Cache will use ServiceAccount token instead of user token
	// Cache creates watchers that have a long cycle to sync with k8s backend maintaining a cache from events
	// Cache will be used only for *Get* operations, update/delete operations will executed directly against the API
	// Cache will see what ServiceAccount can see, so when using OpenShift scenarios, user token is used to fetch the
	// list of projects/namespaces a specific user can see. When using cache, business layer needs to check if a
	// specific user can see a specific namespace
	cacheToken := ""
	kConfig := kialiConfig.Get()
	if kConfig.InCluster {
		if saToken, err := kubernetes.GetKialiToken(); err != nil {
			return nil, err
		} else {
			cacheToken = saToken
		}
	}
	istioConfig := rest.Config{
		Host:            config.Host,
		TLSClientConfig: config.TLSClientConfig,
		QPS:             config.QPS,
		BearerToken:     cacheToken,
		Burst:           config.Burst,
	}
	istioClient, err := kubernetes.NewClientFromConfig(&istioConfig)

	refreshDuration := time.Duration(kConfig.KubernetesConfig.CacheDuration)
	cacheNamespaces := kConfig.KubernetesConfig.CacheNamespaces
	kialiCacheImpl := kialiCacheImpl{
		istioClient:     *istioClient,
		refreshDuration: refreshDuration,
		cacheNamespaces: cacheNamespaces,
		stopChan:        make(chan struct{}),
		nsCache:     	 make(map[string]typeCache),
	}

	log.Infof("Kiali Cache is active for namespaces %v", cacheNamespaces)
	return &kialiCacheImpl, nil
}

// It will indicate if a namespace should have a cache
func (c *kialiCacheImpl) isCached(namespace string) bool {
	for _, cacheNs := range c.cacheNamespaces {
		if matches, _ := regexp.MatchString(strings.TrimSpace(cacheNs), namespace); matches {
			return true
		}
	}
	return false
}

func (c *kialiCacheImpl) createCache(namespace string) bool {
	informer := make(typeCache)
	c.createKubernetesInformers(namespace, &informer)
	c.createIstioInformers(namespace, &informer)
	c.nsCache[namespace] = informer

	go func() {
		for _, informer := range c.nsCache[namespace] {
			go informer.Run(c.stopChan)
		}
		<- c.stopChan
		log.Infof("Kiali cache for [namespace: %s] stopped", namespace)
	}()

	log.Infof("Waiting for Kiali cache for [namespace: %s] to sync", namespace)
	isSynced := func () bool {
		hasSynced := true
		for _, informer := range c.nsCache[namespace] {
			hasSynced = hasSynced && informer.HasSynced()
		}
		return hasSynced
	}
	if synced := cache.WaitForCacheSync(c.stopChan, isSynced); !synced {
		c.stopChan <- struct{}{}
		log.Errorf("Kiali cache for [namespace: %s] sync failure", namespace)
		return false
	}
	log.Infof("Kiali cache for [namespace: %s] started", namespace)

	return true
}

func (c *kialiCacheImpl) CheckNamespace(namespace string) bool {
	if !c.isCached(namespace) {
		return false
	}
	if _, exist := c.nsCache[namespace]; !exist {
		return c.createCache(namespace)
	}
	return true
}

func (c *kialiCacheImpl) Stop() {
	log.Infof("Stopping Kiali Cache")
	if c.stopChan != nil {
		close(c.stopChan)
		c.stopChan = nil
	}
}