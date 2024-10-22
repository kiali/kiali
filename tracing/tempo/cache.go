package tempo

import (
	"fmt"
	"strings"
	"sync"
	"time"
	"unsafe"

	kialiConfig "github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing/jaeger/model"
	otel "github.com/kiali/kiali/tracing/otel/model"
)

type (
	queryResult struct {
		queryTime time.Time // Expiration time
		inResult  *model.TracingResponse
	}

	traceResult struct {
		queryTime time.Time // Expiration time
		inResult  *model.TracingSingleTrace
	}

	tagsResult struct {
		queryTime time.Time // Expiration time
		inResult  *otel.TagsResponse
	}

	TempoCache interface {
		GetAppTracesHTTP(service string, q models.TracingQuery) (bool, *model.TracingResponse)
		GetTags() (bool, *otel.TagsResponse)
		GetTraceDetailHTTP(traceID string) (bool, *model.TracingSingleTrace)
		SetAppTracesHTTP(service string, q models.TracingQuery, response *model.TracingResponse)
		SetTags(response *otel.TagsResponse)
		SetTraceDetailHTTP(traceID string, response *model.TracingSingleTrace)
	}

	tempoCacheImpl struct {
		cacheDuration   time.Duration
		cacheExpiration time.Duration
		// Cache by query,
		cacheAppTraces map[string]*queryResult
		// Cache individual traces
		cacheTraceDetails map[string]*traceResult
		// Cache tags
		cacheTags        *tagsResult
		appTracesLock    sync.RWMutex
		traceDetailsLock sync.RWMutex
		tagsLock         sync.RWMutex
		// stats
		hits          int
		totalRequests int
	}
)

func NewTempoCache() TempoCache {
	kConfig := kialiConfig.Get()
	// TODO: Update with Tracing settings
	cacheDuration := time.Duration(kConfig.ExternalServices.Prometheus.CacheDuration) * time.Second
	cacheExpiration := time.Duration(kConfig.ExternalServices.Prometheus.CacheExpiration) * time.Second

	tempoCacheImpl := tempoCacheImpl{
		cacheDuration:     cacheDuration,
		cacheExpiration:   cacheExpiration,
		cacheAppTraces:    make(map[string]*queryResult),
		cacheTraceDetails: make(map[string]*traceResult),
		cacheTags:         &tagsResult{},
		hits:              0,
		totalRequests:     0,
	}
	go tempoCacheImpl.watchExpiration()

	return &tempoCacheImpl
}

func getKey(service string, q models.TracingQuery) string {
	return fmt.Sprintf("%s:%d:%d:%s:%s", service, q.Start.Unix()/60, q.End.Unix()/60, mapToString(q.Tags), q.Cluster)
}

func mapToString(tags map[string]string) string {
	var tagPairs []string

	for key, value := range tags {
		tagPairs = append(tagPairs, fmt.Sprintf("%s:%s", key, value))
	}

	return strings.Join(tagPairs, ",")
}

// Return the size of the cache
func (c *tempoCacheImpl) Size() int {
	size := 0
	for key, value := range c.cacheTraceDetails {
		size += int(unsafe.Sizeof(key)) + int(unsafe.Sizeof(value)) + len(key)
	}
	for key, value := range c.cacheAppTraces {
		size += int(unsafe.Sizeof(key)) + int(unsafe.Sizeof(value)) + len(key)
	}
	return size
}

// Remove expired items
// Check every minute
func (c *tempoCacheImpl) watchExpiration() {
	for {
		time.Sleep(1 * time.Minute)
		// Delete expired
		for key, value := range c.cacheTraceDetails {
			if time.Since(value.queryTime) > c.cacheExpiration {
				delete(c.cacheTraceDetails, key)
			}
		}
		for key, value := range c.cacheAppTraces {
			if time.Since(value.queryTime) > c.cacheExpiration {
				delete(c.cacheTraceDetails, key)
			}
		}

		// Show stats
		log.Infof("[Tempo Cache] STATS")
		if c.totalRequests == 0 {
			log.Infof("Total requests: 0.0%%")
		} else {
			rates := float64(c.hits) / float64(c.totalRequests) * 100
			log.Infof("[Tempo Cache] Cache hit rate: %.2f%%", rates)
		}
		log.Infof("[Tempo Cache] Cache size: %d bytes", c.Size())
	}
}

func (c *tempoCacheImpl) GetAppTracesHTTP(service string, q models.TracingQuery) (bool, *model.TracingResponse) {
	defer c.appTracesLock.RUnlock()
	c.appTracesLock.RLock()
	cacheKey := getKey(service, q)
	c.totalRequests++
	if appTraces, okNs := c.cacheAppTraces[cacheKey]; okNs {
		if time.Since(appTraces.queryTime) < c.cacheExpiration {
			// TODO: Change to Trace
			log.Infof("[Tempo Cache] GetAppTracesHTTP [service: %s] [key: %s]", service, cacheKey)
			c.hits++
			return true, appTraces.inResult
		}
	}
	return false, nil
}

func (c *tempoCacheImpl) GetTraceDetailHTTP(traceID string) (bool, *model.TracingSingleTrace) {
	defer c.traceDetailsLock.RUnlock()
	c.traceDetailsLock.RLock()
	c.totalRequests++
	if appTraces, okNs := c.cacheTraceDetails[traceID]; okNs {
		if time.Since(appTraces.queryTime) < c.cacheExpiration {
			// TODO: Change to Trace
			log.Infof("[Tempo Cache] GetTraceDetailHTTP [traceID: %s]", traceID)
			c.hits++
			return true, appTraces.inResult
		}
	}
	return false, nil
}

func (c *tempoCacheImpl) GetTags() (bool, *otel.TagsResponse) {
	defer c.tagsLock.RUnlock()
	c.tagsLock.RLock()
	c.totalRequests++
	if time.Since(c.cacheTags.queryTime) < c.cacheExpiration {
		// TODO: Change to Trace
		log.Infof("[Tempo Cache] GetTags ")
		c.hits++
		return true, c.cacheTags.inResult
	}
	return false, nil
}

func (c *tempoCacheImpl) SetAppTracesHTTP(service string, q models.TracingQuery, response *model.TracingResponse) {
	defer c.appTracesLock.RUnlock()
	c.appTracesLock.RLock()
	cacheKey := getKey(service, q)

	c.cacheAppTraces[cacheKey] = &queryResult{
		queryTime: time.Now(),
		inResult:  response,
	}
	// TODO: Change to Trace
	log.Infof("[Tempo Cache] SetAppTracesHTTP [service: %s] [key: %s]", service, cacheKey)
}

func (c *tempoCacheImpl) SetTags(response *otel.TagsResponse) {
	defer c.appTracesLock.RUnlock()
	c.appTracesLock.RLock()

	c.cacheTags = &tagsResult{
		queryTime: time.Now(),
		inResult:  response,
	}

	// TODO: Change to Trace
	log.Infof("[Tempo Cache] SetTags")
}

func (c *tempoCacheImpl) SetTraceDetailHTTP(traceID string, response *model.TracingSingleTrace) {
	defer c.appTracesLock.RUnlock()
	c.appTracesLock.RLock()

	c.cacheTraceDetails[traceID] = &traceResult{
		queryTime: time.Now(),
		inResult:  response,
	}
	// TODO: Change to Trace
	log.Infof("[Tempo Cache] SetTraceDetailHTTP [traceID: %s]", traceID)
}
