package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestFilterByHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert.True(t, FilterByHost("reviews", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews-bad", "reviews", "bookinfo"))

	assert.True(t, FilterByHost("reviews.bookinfo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews-bad.bookinfo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews.bookinfo-bad", "reviews", "bookinfo"))

	assert.True(t, FilterByHost("reviews.bookinfo.svc.cluster.local", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews-bad.bookinfo.svc.cluster.local", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews.bookinfo-bad.svc.cluster.local", "reviews", "bookinfo"))
}

func TestFQDNHostname(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert.True(t, FilterByHost("reviews.bookinfo.svc", "reviews", "bookinfo"))
	assert.True(t, FilterByHost("reviews.bookinfo.svc.cluster.local", "reviews", "bookinfo"))

	assert.False(t, FilterByHost("reviews.foo.svc", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews.foo.svc.cluster.local", "reviews", "bookinfo"))

	assert.False(t, FilterByHost("ratings.bookinfo.svc", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("ratings.bookinfo.svc.cluster.local", "reviews", "bookinfo"))

	assert.False(t, FilterByHost("ratings.foo.svc", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("ratings.foo.svc.cluster.local", "reviews", "bookinfo"))
}

func TestExactProtocolNameMatcher(t *testing.T) {
	// http, http2, grpc, mongo, or redis
	assert.True(t, matchPortNameRule("http", "http"))
	assert.True(t, matchPortNameRule("http", "HTTP"))
	assert.True(t, matchPortNameRule("grpc", "grpc"))
	assert.True(t, matchPortNameRule("http2", "http2"))
}

func TestTCPAndUDPMatcher(t *testing.T) {
	assert.True(t, matchPortNameRule("tcp", "TCP"))
	assert.True(t, matchPortNameRule("tcp", "tcp"))
	assert.True(t, matchPortNameRule("udp", "UDP"))
	assert.True(t, matchPortNameRule("udp", "udp"))

	assert.True(t, matchPortNameRule("tcp-any", "UDP"))
	assert.True(t, matchPortNameRule("udp-any", "TCP"))

	assert.True(t, matchPortNameRule("doesnotmatter", "UDP"))
	assert.True(t, matchPortNameRule("everythingisvalid", "TCP"))
}

func TestValidProtocolNameMatcher(t *testing.T) {
	assert.True(t, matchPortNameRule("http-name", "http"))
	assert.True(t, matchPortNameRule("http2-name", "http2"))
}

func TestInvalidProtocolNameMatcher(t *testing.T) {
	assert.False(t, matchPortNameRule("http2-name", "http"))
	assert.False(t, matchPortNameRule("http-name", "http2"))

	assert.False(t, matchPortNameRule("httpname", "http"))
	assert.False(t, matchPortNameRule("name", "http"))
}
