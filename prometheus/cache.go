package prometheus

import (
	"context"
	"sync"
	"time"

	"github.com/prometheus/common/model"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

type (
	timeInResult struct {
		queryTime time.Time
		inResult  model.Vector
	}

	timeInOutResult struct {
		queryTime time.Time
		inResult  model.Vector
		outResult model.Vector
	}

	PromCache interface {
		GetAllRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time) (bool, model.Vector)
		GetAppRequestRates(namespace, cluster, app, ratesInterval string, queryTime time.Time) (bool, model.Vector, model.Vector)
		GetNamespaceServicesRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time) (bool, model.Vector)
		GetServiceRequestRates(namespace, cluster, service, ratesInterval string, queryTime time.Time) (bool, model.Vector)
		GetWorkloadRequestRates(namespace, cluster, workload, ratesInterval string, queryTime time.Time) (bool, model.Vector, model.Vector)
		SetAllRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time, inResult model.Vector)
		SetAppRequestRates(namespace, cluster, app, ratesInterval string, queryTime time.Time, inResult model.Vector, outResult model.Vector)
		SetNamespaceServicesRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time, inResult model.Vector)
		SetServiceRequestRates(namespace, cluster, service, ratesInterval string, queryTime time.Time, inResult model.Vector)
		SetWorkloadRequestRates(namespace, cluster, workload, ratesInterval string, queryTime time.Time, inResult model.Vector, outResult model.Vector)
	}

	promCacheImpl struct {
		// to hold internal data such as the logger
		ctx context.Context

		cacheDuration   time.Duration
		cacheExpiration time.Duration
		// Cached by namespace, cluster, app, ratesInterval
		cacheSvcRequestRates map[string]map[string]map[string]map[string]timeInResult
		cacheWkRequestRates  map[string]map[string]map[string]map[string]timeInOutResult
		cacheAppRequestRates map[string]map[string]map[string]map[string]timeInOutResult
		// Cached by namespace, cluster, ratesInterval
		cacheAllRequestRates   map[string]map[string]map[string]timeInResult
		cacheNsSvcRequestRates map[string]map[string]map[string]timeInResult
		allRequestRatesLock    sync.RWMutex
		appRequestRatesLock    sync.RWMutex
		nsSvcRequestRatesLock  sync.RWMutex
		svcRequestRatesLock    sync.RWMutex
		wkRequestRatesLock     sync.RWMutex
	}
)

func NewPromCache(ctx context.Context) PromCache {
	kConfig := kialiConfig.Get()

	cacheDuration := time.Duration(kConfig.ExternalServices.Prometheus.CacheDuration) * time.Second
	cacheExpiration := time.Duration(kConfig.ExternalServices.Prometheus.CacheExpiration) * time.Second
	promCacheImpl := promCacheImpl{
		ctx:                    ctx,
		cacheDuration:          cacheDuration,
		cacheExpiration:        cacheExpiration,
		cacheAllRequestRates:   make(map[string]map[string]map[string]timeInResult),
		cacheAppRequestRates:   make(map[string]map[string]map[string]map[string]timeInOutResult),
		cacheNsSvcRequestRates: make(map[string]map[string]map[string]timeInResult),
		cacheSvcRequestRates:   make(map[string]map[string]map[string]map[string]timeInResult),
		cacheWkRequestRates:    make(map[string]map[string]map[string]map[string]timeInOutResult),
	}

	go promCacheImpl.watchExpiration()

	return &promCacheImpl
}

func (c *promCacheImpl) GetAllRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time) (bool, model.Vector) {
	defer c.allRequestRatesLock.RUnlock()
	c.allRequestRatesLock.RLock()

	if nsRates, okNs := c.cacheAllRequestRates[namespace][cluster]; okNs {
		if rtInterval, okRt := nsRates[ratesInterval]; okRt {
			if !queryTime.Before(rtInterval.queryTime) && queryTime.Sub(rtInterval.queryTime) < c.cacheDuration {
				log.FromContext(c.ctx).Trace().Msgf("GetAllRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())
				return true, rtInterval.inResult
			}
		}
	}
	return false, nil
}

func (c *promCacheImpl) SetAllRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time, inResult model.Vector) {
	defer c.allRequestRatesLock.Unlock()
	c.allRequestRatesLock.Lock()

	if _, okNs := c.cacheAllRequestRates[namespace]; !okNs {
		c.cacheAllRequestRates[namespace] = make(map[string]map[string]timeInResult)
	}

	if _, okCluster := c.cacheAllRequestRates[namespace][cluster]; !okCluster {
		c.cacheAllRequestRates[namespace][cluster] = make(map[string]timeInResult)
	}

	c.cacheAllRequestRates[namespace][cluster][ratesInterval] = timeInResult{
		queryTime: queryTime,
		inResult:  inResult,
	}
	log.FromContext(c.ctx).Trace().Msgf("SetAllRequestRates [namespace: %s] [cluster: %s] [ratesInterval: %s] [queryTime: %s]", namespace, cluster, ratesInterval, queryTime.String())
}

func (c *promCacheImpl) GetAppRequestRates(namespace, cluster, app, ratesInterval string, queryTime time.Time) (bool, model.Vector, model.Vector) {
	defer c.appRequestRatesLock.RUnlock()
	c.appRequestRatesLock.RLock()

	if nsRates, okNs := c.cacheAppRequestRates[namespace]; okNs {
		if appInterval, okApp := nsRates[app][cluster]; okApp {
			if rtInterval, okRt := appInterval[ratesInterval]; okRt {
				if !queryTime.Before(rtInterval.queryTime) && queryTime.Sub(rtInterval.queryTime) < c.cacheDuration {
					log.FromContext(c.ctx).Trace().Msgf("GetAppRequestRates [namespace: %s] [app: %s] [ratesInterval: %s] [queryTime: %s]", namespace, app, ratesInterval, queryTime.String())
					return true, rtInterval.inResult, rtInterval.outResult
				}
			}
		}
	}
	return false, nil, nil
}

func (c *promCacheImpl) SetAppRequestRates(namespace, cluster, app, ratesInterval string, queryTime time.Time, inResult model.Vector, outResult model.Vector) {
	defer c.appRequestRatesLock.Unlock()
	c.appRequestRatesLock.Lock()

	if _, okNs := c.cacheAppRequestRates[namespace]; !okNs {
		c.cacheAppRequestRates[namespace] = make(map[string]map[string]map[string]timeInOutResult)
	}
	if _, okCluster := c.cacheAppRequestRates[namespace][cluster]; !okCluster {
		c.cacheAppRequestRates[namespace][cluster] = make(map[string]map[string]timeInOutResult)
	}
	if _, okApp := c.cacheAppRequestRates[namespace][app]; !okApp {
		c.cacheAppRequestRates[namespace][cluster][app] = make(map[string]timeInOutResult)
	}

	c.cacheAppRequestRates[namespace][cluster][app][ratesInterval] = timeInOutResult{
		queryTime: queryTime,
		inResult:  inResult,
		outResult: outResult,
	}
	log.FromContext(c.ctx).Trace().Msgf("SetAppRequestRates [namespace: %s] [cluster: %s] [app: %s] [ratesInterval: %s] [queryTime: %s]", namespace, cluster, app, ratesInterval, queryTime.String())
}

func (c *promCacheImpl) GetNamespaceServicesRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time) (bool, model.Vector) {
	defer c.nsSvcRequestRatesLock.RUnlock()
	c.nsSvcRequestRatesLock.RLock()

	if nsRates, okNs := c.cacheNsSvcRequestRates[namespace][cluster]; okNs {
		if rtInterval, okRt := nsRates[ratesInterval]; okRt {
			if !queryTime.Before(rtInterval.queryTime) && queryTime.Sub(rtInterval.queryTime) < c.cacheDuration {
				log.FromContext(c.ctx).Trace().Msgf("GetNamespaceServicesRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())
				return true, rtInterval.inResult
			}
		}
	}
	return false, nil
}

func (c *promCacheImpl) SetNamespaceServicesRequestRates(namespace, cluster string, ratesInterval string, queryTime time.Time, inResult model.Vector) {
	defer c.nsSvcRequestRatesLock.Unlock()
	c.nsSvcRequestRatesLock.Lock()

	if _, okNs := c.cacheNsSvcRequestRates[namespace]; !okNs {
		c.cacheNsSvcRequestRates[namespace] = make(map[string]map[string]timeInResult)
	}

	if _, okCluster := c.cacheNsSvcRequestRates[namespace][cluster]; !okCluster {
		c.cacheNsSvcRequestRates[namespace][cluster] = make(map[string]timeInResult)
	}

	c.cacheNsSvcRequestRates[namespace][cluster][ratesInterval] = timeInResult{
		queryTime: queryTime,
		inResult:  inResult,
	}
	log.FromContext(c.ctx).Trace().Msgf("SetNamespaceServicesRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())
}

func (c *promCacheImpl) GetServiceRequestRates(namespace, cluster, service, ratesInterval string, queryTime time.Time) (bool, model.Vector) {
	defer c.svcRequestRatesLock.RUnlock()
	c.svcRequestRatesLock.RLock()

	if rtInterval, okRt := c.cacheSvcRequestRates[namespace][cluster][service][ratesInterval]; okRt {
		if !queryTime.Before(rtInterval.queryTime) && queryTime.Sub(rtInterval.queryTime) < c.cacheDuration {
			log.FromContext(c.ctx).Trace().Msgf("GetServiceRequestRates [namespace: %s] [service: %s] [ratesInterval: %s] [queryTime: %s]", namespace, service, ratesInterval, queryTime.String())
			return true, rtInterval.inResult
		}
	}
	return false, nil
}

func (c *promCacheImpl) SetServiceRequestRates(namespace, cluster, service, ratesInterval string, queryTime time.Time, inResult model.Vector) {
	defer c.svcRequestRatesLock.Unlock()
	c.svcRequestRatesLock.Lock()

	if _, okNs := c.cacheSvcRequestRates[namespace]; !okNs {
		c.cacheSvcRequestRates[namespace] = make(map[string]map[string]map[string]timeInResult)
	}
	if _, okCluster := c.cacheSvcRequestRates[namespace][cluster]; !okCluster {
		c.cacheSvcRequestRates[namespace][cluster] = make(map[string]map[string]timeInResult)
	}
	if _, okSvc := c.cacheSvcRequestRates[namespace][cluster][service]; !okSvc {
		c.cacheSvcRequestRates[namespace][cluster][service] = make(map[string]timeInResult)
	}

	c.cacheSvcRequestRates[namespace][cluster][service][ratesInterval] = timeInResult{
		queryTime: queryTime,
		inResult:  inResult,
	}
	log.FromContext(c.ctx).Trace().Msgf("SetServiceRequestRates [namespace: %s] [cluster: %s] [service: %s] [ratesInterval: %s] [queryTime: %s]", namespace, cluster, service, ratesInterval, queryTime.String())
}

func (c *promCacheImpl) GetWorkloadRequestRates(namespace, cluster, workload, ratesInterval string, queryTime time.Time) (bool, model.Vector, model.Vector) {
	defer c.wkRequestRatesLock.RUnlock()
	c.wkRequestRatesLock.RLock()

	if nsRates, okNs := c.cacheWkRequestRates[namespace][cluster]; okNs {
		if wkInterval, okWk := nsRates[workload]; okWk {
			if rtInterval, okRt := wkInterval[ratesInterval]; okRt {
				if !queryTime.Before(rtInterval.queryTime) && queryTime.Sub(rtInterval.queryTime) < c.cacheDuration {
					log.FromContext(c.ctx).Trace().Msgf("GetWorkloadRequestRates [namespace: %s] [cluster :%s] [workload: %s] [ratesInterval: %s] [queryTime: %s]", namespace, cluster, workload, ratesInterval, queryTime.String())
					return true, rtInterval.inResult, rtInterval.outResult
				}
			}
		}
	}
	return false, nil, nil
}

func (c *promCacheImpl) SetWorkloadRequestRates(namespace, cluster, workload, ratesInterval string, queryTime time.Time, inResult model.Vector, outResult model.Vector) {
	defer c.wkRequestRatesLock.Unlock()
	c.wkRequestRatesLock.Lock()

	if _, okNs := c.cacheWkRequestRates[namespace]; !okNs {
		c.cacheWkRequestRates[namespace] = make(map[string]map[string]map[string]timeInOutResult)
	}
	if _, clusterNs := c.cacheWkRequestRates[namespace][cluster]; !clusterNs {
		c.cacheWkRequestRates[namespace][cluster] = make(map[string]map[string]timeInOutResult)
	}
	if _, okApp := c.cacheWkRequestRates[namespace][workload]; !okApp {
		c.cacheWkRequestRates[namespace][cluster][workload] = make(map[string]timeInOutResult)
	}

	c.cacheWkRequestRates[namespace][cluster][workload][ratesInterval] = timeInOutResult{
		queryTime: queryTime,
		inResult:  inResult,
		outResult: outResult,
	}
	log.FromContext(c.ctx).Trace().Msgf("SetAppRequestRates [namespace: %s] [cluster: %s] [workload: %s] [ratesInterval: %s] [queryTime: %s]", namespace, cluster, workload, ratesInterval, queryTime.String())
}

// Expiration is done globally, this cache is designed as short term, so in the worst case it would populated the queries
// Doing an expiration check per item is costly and it's not necessary in this particular context
func (c *promCacheImpl) watchExpiration() {
	for {
		time.Sleep(c.cacheExpiration)
		c.allRequestRatesLock.Lock()
		c.cacheAllRequestRates = make(map[string]map[string]map[string]timeInResult)
		c.allRequestRatesLock.Unlock()

		c.appRequestRatesLock.Lock()
		c.cacheAppRequestRates = make(map[string]map[string]map[string]map[string]timeInOutResult)
		c.appRequestRatesLock.Unlock()

		c.nsSvcRequestRatesLock.Lock()
		c.cacheNsSvcRequestRates = make(map[string]map[string]map[string]timeInResult)
		c.nsSvcRequestRatesLock.Unlock()

		c.svcRequestRatesLock.Lock()
		c.cacheSvcRequestRates = make(map[string]map[string]map[string]map[string]timeInResult)
		c.svcRequestRatesLock.Unlock()

		c.wkRequestRatesLock.Lock()
		c.cacheWkRequestRates = make(map[string]map[string]map[string]map[string]timeInOutResult)
		c.wkRequestRatesLock.Unlock()
		log.FromContext(c.ctx).Trace().Msgf("Expired")
	}
}
