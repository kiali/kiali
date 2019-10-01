package cache

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFilterNamespaces(t *testing.T) {
	assert := assert.New(t)

	kialiCacheImpl := kialiCacheImpl{
		clientset:       nil,
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
