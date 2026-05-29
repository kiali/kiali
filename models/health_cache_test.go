package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseHealthCacheKey_Valid(t *testing.T) {
	cluster, ns, ok := ParseHealthCacheKey("health:east:bookinfo")
	assert.True(t, ok)
	assert.Equal(t, "east", cluster)
	assert.Equal(t, "bookinfo", ns)
}

func TestParseHealthCacheKey_RoundTrip(t *testing.T) {
	key := HealthCacheKey("my-cluster", "my-namespace")
	cluster, ns, ok := ParseHealthCacheKey(key)
	assert.True(t, ok)
	assert.Equal(t, "my-cluster", cluster)
	assert.Equal(t, "my-namespace", ns)
}

func TestParseHealthCacheKey_MissingPrefix(t *testing.T) {
	_, _, ok := ParseHealthCacheKey("east:bookinfo")
	assert.False(t, ok)
}

func TestParseHealthCacheKey_MissingNamespace(t *testing.T) {
	_, _, ok := ParseHealthCacheKey("health:east:")
	assert.False(t, ok)
}

func TestParseHealthCacheKey_MissingCluster(t *testing.T) {
	_, _, ok := ParseHealthCacheKey("health::bookinfo")
	assert.False(t, ok)
}

func TestParseHealthCacheKey_NoSeparator(t *testing.T) {
	_, _, ok := ParseHealthCacheKey("health:eastbookinfo")
	assert.False(t, ok)
}

func TestParseHealthCacheKey_Empty(t *testing.T) {
	_, _, ok := ParseHealthCacheKey("")
	assert.False(t, ok)
}
