package prometheus

import (
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
		GetAllRequestRates(namespace string, ratesInterval string, queryTime time.Time) (bool, model.Vector)
		GetAppRequestRates(namespace, app, ratesInterval string, queryTime time.Time) (bool, model.Vector, model.Vector)
		GetNamespaceServicesRequestRates(namespace string, ratesInterval string, queryTime time.Time) (bool, model.Vector)
		GetServiceRequestRates(namespace, service, ratesInterval string, queryTime time.Time) (bool, model.Vector)
		GetWorkloadRequestRates(namespace, workload, ratesInterval string, queryTime time.Time) (bool, model.Vector, model.Vector)
		SetAllRequestRates(namespace string, ratesInterval string, queryTime time.Time, inResult model.Vector)
		SetAppRequestRates(namespace, app, ratesInterval string, queryTime time.Time, inResult model.Vector, outResult model.Vector)
		SetNamespaceServicesRequestRates(namespace string, ratesInterval string, queryTime time.Time, inResult model.Vector)
		SetServiceRequestRates(namespace, service, ratesInterval string, queryTime time.Time, inResult model.Vector)
		SetWorkloadRequestRates(namespace, workload, ratesInterval string, queryTime time.Time, inResult model.Vector, outResult model.Vector)
	}

	promCacheImpl struct {
		cacheDuration          time.Duration
		cacheExpiration        time.Duration
		cacheAllRequestRates   map[string]map[string]timeInResult
		cacheAppRequestRates   map[string]map[string]map[string]timeInOutResult
		cacheNsSvcRequestRates map[string]map[string]timeInResult
		cacheSvcRequestRates   map[string]map[string]map[string]timeInResult
		cacheWkRequestRates    map[string]map[string]map[string]timeInOutResult
		allRequestRatesLock    sync.RWMutex
		appRequestRatesLock    sync.RWMutex
		nsSvcRequestRatesLock  sync.RWMutex
		svcRequestRatesLock    sync.RWMutex
		wkRequestRatesLock     sync.RWMutex
	}
)

func NewPromCache() PromCache {
	kConfig := kialiConfig.Get()

	cacheDuration := time.Duration(kConfig.ExternalServices.Prometheus.CacheDuration) * time.Second
	cacheExpiration := time.Duration(kConfig.ExternalServices.Prometheus.CacheExpiration) * time.Second
	promCacheImpl := promCacheImpl{
		cacheDuration:          cacheDuration,
		cacheExpiration:        cacheExpiration,
		cacheAllRequestRates:   make(map[string]map[string]timeInResult),
		cacheAppRequestRates:   make(map[string]map[string]map[string]timeInOutResult),
		cacheNsSvcRequestRates: make(map[string]map[string]timeInResult),
		cacheSvcRequestRates:   make(map[string]map[string]map[string]timeInResult),
		cacheWkRequestRates:    make(map[string]map[string]map[string]timeInOutResult),
	}

	go promCacheImpl.watchExpiration()

	return &promCacheImpl
}

func (c *promCacheImpl) GetAllRequestRates(namespace string, ratesInterval string, queryTime time.Time) (bool, model.Vector) {
	defer c.allRequestRatesLock.RUnlock()
	c.allRequestRatesLock.RLock()

	if nsRates, okNs := c.cacheAllRequestRates[namespace]; okNs {
		if rtInterval, okRt := nsRates[ratesInterval]; okRt {
			if !queryTime.Before(rtInterval.queryTime) && queryTime.Sub(rtInterval.queryTime) < c.cacheDuration {
				log.Tracef("[Prom Cache] GetAllRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())
				return true, rtInterval.inResult
			}
		}
	}
	return false, nil
}

func (c *promCacheImpl) SetAllRequestRates(namespace string, ratesInterval string, queryTime time.Time, inResult model.Vector) {
	defer c.allRequestRatesLock.Unlock()
	c.allRequestRatesLock.Lock()

	if _, okNs := c.cacheAllRequestRates[namespace]; !okNs {
		c.cacheAllRequestRates[namespace] = make(map[string]timeInResult)
	}

	c.cacheAllRequestRates[namespace][ratesInterval] = timeInResult{
		queryTime: queryTime,
		inResult:  inResult,
	}
	log.Tracef("[Prom Cache] SetAllRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())
}

func (c *promCacheImpl) GetAppRequestRates(namespace string, app string, ratesInterval string, queryTime time.Time) (bool, model.Vector, model.Vector) {
	defer c.appRequestRatesLock.RUnlock()
	c.appRequestRatesLock.RLock()

	if nsRates, okNs := c.cacheAppRequestRates[namespace]; okNs {
		if appInterval, okApp := nsRates[app]; okApp {
			if rtInterval, okRt := appInterval[ratesInterval]; okRt {
				if !queryTime.Before(rtInterval.queryTime) && queryTime.Sub(rtInterval.queryTime) < c.cacheDuration {
					log.Tracef("[Prom Cache] GetAppRequestRates [namespace: %s] [app: %s] [ratesInterval: %s] [queryTime: %s]", namespace, app, ratesInterval, queryTime.String())
					return true, rtInterval.inResult, rtInterval.outResult
				}
			}
		}
	}
	return false, nil, nil
}

func (c *promCacheImpl) SetAppRequestRates(namespace string, app string, ratesInterval string, queryTime time.Time, inResult model.Vector, outResult model.Vector) {
	defer c.appRequestRatesLock.Unlock()
	c.appRequestRatesLock.Lock()

	if _, okNs := c.cacheAppRequestRates[namespace]; !okNs {
		c.cacheAppRequestRates[namespace] = make(map[string]map[string]timeInOutResult)
	}

	if _, okApp := c.cacheAppRequestRates[namespace][app]; !okApp {
		c.cacheAppRequestRates[namespace][app] = make(map[string]timeInOutResult)
	}

	c.cacheAppRequestRates[namespace][app][ratesInterval] = timeInOutResult{
		queryTime: queryTime,
		inResult:  inResult,
		outResult: outResult,
	}
	log.Tracef("[Prom Cache] SetAppRequestRates [namespace: %s] [app: %s] [ratesInterval: %s] [queryTime: %s]", namespace, app, ratesInterval, queryTime.String())
}

func (c *promCacheImpl) GetNamespaceServicesRequestRates(namespace string, ratesInterval string, queryTime time.Time) (bool, model.Vector) {
	defer c.nsSvcRequestRatesLock.RUnlock()
	c.nsSvcRequestRatesLock.RLock()

	if nsRates, okNs := c.cacheNsSvcRequestRates[namespace]; okNs {
		if rtInterval, okRt := nsRates[ratesInterval]; okRt {
			if !queryTime.Before(rtInterval.queryTime) && queryTime.Sub(rtInterval.queryTime) < c.cacheDuration {
				log.Tracef("[Prom Cache] GetNamespaceServicesRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())
				return true, rtInterval.inResult
			}
		}
	}
	return false, nil
}

func (c *promCacheImpl) SetNamespaceServicesRequestRates(namespace string, ratesInterval string, queryTime time.Time, inResult model.Vector) {
	defer c.nsSvcRequestRatesLock.Unlock()
	c.nsSvcRequestRatesLock.Lock()

	if _, okNs := c.cacheNsSvcRequestRates[namespace]; !okNs {
		c.cacheNsSvcRequestRates[namespace] = make(map[string]timeInResult)
	}

	c.cacheNsSvcRequestRates[namespace][ratesInterval] = timeInResult{
		queryTime: queryTime,
		inResult:  inResult,
	}
	log.Tracef("[Prom Cache] SetNamespaceServicesRequestRates [namespace: %s] [ratesInterval: %s] [queryTime: %s]", namespace, ratesInterval, queryTime.String())
}

func (c *promCacheImpl) GetServiceRequestRates(namespace string, service string, ratesInterval string, queryTime time.Time) (bool, model.Vector) {
	defer c.svcRequestRatesLock.RUnlock()
	c.svcRequestRatesLock.RLock()

	if nsRates, okNs := c.cacheSvcRequestRates[namespace]; okNs {
		if svcInterval, okSvc := nsRates[service]; okSvc {
			if rtInterval, okRt := svcInterval[ratesInterval]; okRt {
				if !queryTime.Before(rtInterval.queryTime) && queryTime.Sub(rtInterval.queryTime) < c.cacheDuration {
					log.Tracef("[Prom Cache] GetServiceRequestRates [namespace: %s] [service: %s] [ratesInterval: %s] [queryTime: %s]", namespace, service, ratesInterval, queryTime.String())
					return true, rtInterval.inResult
				}
			}
		}
	}
	return false, nil
}

func (c *promCacheImpl) SetServiceRequestRates(namespace string, service string, ratesInterval string, queryTime time.Time, inResult model.Vector) {
	defer c.svcRequestRatesLock.Unlock()
	c.svcRequestRatesLock.Lock()

	if _, okNs := c.cacheSvcRequestRates[namespace]; !okNs {
		c.cacheSvcRequestRates[namespace] = make(map[string]map[string]timeInResult)
	}

	if _, okSvc := c.cacheSvcRequestRates[namespace][service]; !okSvc {
		c.cacheSvcRequestRates[namespace][service] = make(map[string]timeInResult)
	}

	c.cacheSvcRequestRates[namespace][service][ratesInterval] = timeInResult{
		queryTime: queryTime,
		inResult:  inResult,
	}
	log.Tracef("[Prom Cache] SetServiceRequestRates [namespace: %s] [service: %s] [ratesInterval: %s] [queryTime: %s]", namespace, service, ratesInterval, queryTime.String())
}

func (c *promCacheImpl) GetWorkloadRequestRates(namespace string, workload string, ratesInterval string, queryTime time.Time) (bool, model.Vector, model.Vector) {
	defer c.wkRequestRatesLock.RUnlock()
	c.wkRequestRatesLock.RLock()

	if nsRates, okNs := c.cacheWkRequestRates[namespace]; okNs {
		if wkInterval, okWk := nsRates[workload]; okWk {
			if rtInterval, okRt := wkInterval[ratesInterval]; okRt {
				if !queryTime.Before(rtInterval.queryTime) && queryTime.Sub(rtInterval.queryTime) < c.cacheDuration {
					log.Tracef("[Prom Cache] GetWorkloadRequestRates [namespace: %s] [workload: %s] [ratesInterval: %s] [queryTime: %s]", namespace, workload, ratesInterval, queryTime.String())
					return true, rtInterval.inResult, rtInterval.outResult
				}
			}
		}
	}
	return false, nil, nil
}

func (c *promCacheImpl) SetWorkloadRequestRates(namespace string, workload string, ratesInterval string, queryTime time.Time, inResult model.Vector, outResult model.Vector) {
	defer c.wkRequestRatesLock.Unlock()
	c.wkRequestRatesLock.Lock()

	if _, okNs := c.cacheWkRequestRates[namespace]; !okNs {
		c.cacheWkRequestRates[namespace] = make(map[string]map[string]timeInOutResult)
	}

	if _, okApp := c.cacheWkRequestRates[namespace][workload]; !okApp {
		c.cacheWkRequestRates[namespace][workload] = make(map[string]timeInOutResult)
	}

	c.cacheWkRequestRates[namespace][workload][ratesInterval] = timeInOutResult{
		queryTime: queryTime,
		inResult:  inResult,
		outResult: outResult,
	}
	log.Tracef("[Prom Cache] SetAppRequestRates [namespace: %s] [workload: %s] [ratesInterval: %s] [queryTime: %s]", namespace, workload, ratesInterval, queryTime.String())
}

// Expiration is done globally, this cache is designed as short term, so in the worst case it would populated the queries
// Doing an expiration check per item is costly and it's not necessary in this particular context
func (c *promCacheImpl) watchExpiration() {
	for {
		time.Sleep(c.cacheExpiration)
		c.allRequestRatesLock.Lock()
		c.cacheAllRequestRates = make(map[string]map[string]timeInResult)
		c.allRequestRatesLock.Unlock()

		c.appRequestRatesLock.Lock()
		c.cacheAppRequestRates = make(map[string]map[string]map[string]timeInOutResult)
		c.appRequestRatesLock.Unlock()

		c.nsSvcRequestRatesLock.Lock()
		c.cacheNsSvcRequestRates = make(map[string]map[string]timeInResult)
		c.nsSvcRequestRatesLock.Unlock()

		c.svcRequestRatesLock.Lock()
		c.cacheSvcRequestRates = make(map[string]map[string]map[string]timeInResult)
		c.svcRequestRatesLock.Unlock()

		c.wkRequestRatesLock.Lock()
		c.cacheWkRequestRates = make(map[string]map[string]map[string]timeInOutResult)
		c.wkRequestRatesLock.Unlock()
		log.Tracef("[Prom Cache] Expired")
	}
}
