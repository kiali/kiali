package cache

import (
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
)

func TestNewKialiCache_isCached(t *testing.T) {
	assert := assert.New(t)

	kialiCacheImpl := kialiCacheImpl{
		istioClient:            kubernetes.K8SClient{},
		refreshDuration:        0,
		cacheNamespacesRegexps: []regexp.Regexp{*regexp.MustCompile("bookinfo"), *regexp.MustCompile("a.*"), *regexp.MustCompile("galicia")},
		stopChan:               nil,
		nsCache:                map[string]typeCache{},
	}

	assert.True(kialiCacheImpl.isCached("bookinfo"))
	assert.True(kialiCacheImpl.isCached("a"))
	assert.True(kialiCacheImpl.isCached("abcdefghi"))
	assert.False(kialiCacheImpl.isCached("b"))
	assert.False(kialiCacheImpl.isCached("bbcdefghi"))
	assert.True(kialiCacheImpl.isCached("galicia"))
}
