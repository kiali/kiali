package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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
	assert.True(t, MatchPortNameRule("http", "http"))
	assert.True(t, MatchPortNameRule("http", "HTTP"))
	assert.True(t, MatchPortNameRule("grpc", "grpc"))
	assert.True(t, MatchPortNameRule("http2", "http2"))
}

func TestTCPAndUDPMatcher(t *testing.T) {
	assert.True(t, MatchPortNameRule("tcp", "TCP"))
	assert.True(t, MatchPortNameRule("tcp", "tcp"))
	assert.True(t, MatchPortNameRule("udp", "UDP"))
	assert.True(t, MatchPortNameRule("udp", "udp"))

	assert.True(t, MatchPortNameRule("tcp-any", "UDP"))
	assert.True(t, MatchPortNameRule("udp-any", "TCP"))

	assert.True(t, MatchPortNameRule("doesnotmatter", "UDP"))
	assert.True(t, MatchPortNameRule("everythingisvalid", "TCP"))
}

func TestValidProtocolNameMatcher(t *testing.T) {
	assert.True(t, MatchPortNameRule("http-name", "http"))
	assert.True(t, MatchPortNameRule("http2-name", "http2"))
}

func TestInvalidProtocolNameMatcher(t *testing.T) {
	assert.False(t, MatchPortNameRule("http2-name", "http"))
	assert.False(t, MatchPortNameRule("http-name", "http2"))

	assert.False(t, MatchPortNameRule("httpname", "http"))
	assert.False(t, MatchPortNameRule("name", "http"))
}

func TestValidPortNameMatcher(t *testing.T) {
	assert.True(t, MatchPortNameWithValidProtocols("http-name"))
	assert.True(t, MatchPortNameWithValidProtocols("http2-name"))
}

func TestInvalidPortNameMatcher(t *testing.T) {
	assert.False(t, MatchPortNameWithValidProtocols("httpname"))
	assert.False(t, MatchPortNameWithValidProtocols("name"))
}

func TestPolicyHasMtlsEnabledStructMode(t *testing.T) {
	policy := createPolicy("default", "bookinfo", []interface{}{
		map[string]interface{}{
			"mtls": map[string]interface{}{
				"mode": map[string]interface{}{},
			},
		},
	})

	enabled, mode := PolicyHasMTLSEnabled(policy)
	assert.False(t, enabled)
	assert.Equal(t, "", mode)
}

func TestPolicyHasMTLSEnabledNonDefaultName(t *testing.T) {
	policy := createPolicy("non-default", "bookinfo", []interface{}{
		map[string]interface{}{
			"mtls": map[string]interface{}{
				"mode": "STRICT",
			},
		},
	})

	enabled, mode := PolicyHasMTLSEnabled(policy)
	assert.False(t, enabled)
	assert.Equal(t, "", mode)
}

func TestPolicyHasMTLSEnabledStrictMode(t *testing.T) {
	policy := createPolicy("default", "bookinfo", []interface{}{
		map[string]interface{}{
			"mtls": map[string]interface{}{
				"mode": "STRICT",
			},
		},
	})

	enabled, mode := PolicyHasMTLSEnabled(policy)
	assert.True(t, enabled)
	assert.Equal(t, "STRICT", mode)
}

func TestPolicyHasMTLSEnabledStructMtls(t *testing.T) {
	policy := createPolicy("default", "bookinfo", []interface{}{
		map[string]interface{}{
			"mtls": map[string]interface{}{},
		},
	})

	enabled, mode := PolicyHasMTLSEnabled(policy)
	assert.True(t, enabled)
	assert.Equal(t, "STRICT", mode)
}

func TestPolicyHasMTLSEnabledPermissiveMode(t *testing.T) {
	policy := createPolicy("default", "bookinfo", []interface{}{
		map[string]interface{}{
			"mtls": map[string]interface{}{
				"mode": "PERMISSIVE",
			},
		},
	})

	enabled, mode := PolicyHasMTLSEnabled(policy)
	assert.True(t, enabled)
	assert.Equal(t, "PERMISSIVE", mode)
}

func createPolicy(name, namespace string, peers interface{}) IstioObject {
	return (&GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: map[string]interface{}{
			"peers": peers,
		},
	}).DeepCopyIstioObject()
}
