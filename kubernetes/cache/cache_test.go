package cache

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
)

func TestFilterNamespaces(t *testing.T) {
	assert := assert.New(t)

	kialiCacheImpl := kialiCacheImpl{
		istioClient:       kubernetes.IstioClient{},
		refreshDuration: 0,
		cacheNamespaces: []string{"bookinfo", "a.*", "galicia"},
		stopChan:        nil,
		nsCache:     	 map[string]typeCache{},
	}

	assert.True(kialiCacheImpl.isCached("bookinfo"))
	assert.True(kialiCacheImpl.isCached("a"))
	assert.True(kialiCacheImpl.isCached("abcdefghi"))
	assert.False(kialiCacheImpl.isCached("b"))
	assert.False(kialiCacheImpl.isCached("bbcdefghi"))
	assert.True(kialiCacheImpl.isCached("galicia"))
}
