package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	api_security_v1beta1 "istio.io/api/security/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/config"
)

func TestFilterByHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert.True(t, FilterByHost("reviews", "bookinfo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews-bad", "bookinfo", "reviews", "bookinfo"))

	assert.True(t, FilterByHost("reviews.bookinfo", "bookinfo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews-bad.bookinfo", "bookinfo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews.bookinfo-bad", "bookinfo-bad", "reviews", "bookinfo"))

	assert.True(t, FilterByHost("reviews.bookinfo.svc.cluster.local", "bookinfo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews-bad.bookinfo.svc.cluster.local", "bookinfo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews.bookinfo-bad.svc.cluster.local", "bookinfo-bad", "reviews", "bookinfo"))
}

func TestFQDNHostname(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert.True(t, FilterByHost("reviews.bookinfo.svc", "bookinfo", "reviews", "bookinfo"))
	assert.True(t, FilterByHost("reviews.bookinfo.svc.cluster.local", "bookinfo", "reviews", "bookinfo"))

	assert.False(t, FilterByHost("reviews.foo.svc", "foo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("reviews.foo.svc.cluster.local", "foo", "reviews", "bookinfo"))

	assert.False(t, FilterByHost("ratings.bookinfo.svc", "bookinfo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("ratings.bookinfo.svc.cluster.local", "bookinfo", "reviews", "bookinfo"))

	assert.False(t, FilterByHost("ratings.foo.svc", "foo", "reviews", "bookinfo"))
	assert.False(t, FilterByHost("ratings.foo.svc.cluster.local", "foo", "reviews", "bookinfo"))
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
	assert.True(t, MatchPortNameWithValidProtocols("grpc-net-test"))
	assert.True(t, MatchPortNameWithValidProtocols("grpc-web-net"))
}

func TestInvalidPortNameMatcher(t *testing.T) {
	assert.False(t, MatchPortNameWithValidProtocols("httpname"))
	assert.False(t, MatchPortNameWithValidProtocols("name"))
}

func TestValidPortAppProtocolMatcher(t *testing.T) {
	s1 := "http"
	s2 := "mysql"
	s3 := "grpc-web"
	assert.True(t, MatchPortAppProtocolWithValidProtocols(&s1))
	assert.True(t, MatchPortAppProtocolWithValidProtocols(&s2))
	assert.True(t, MatchPortAppProtocolWithValidProtocols(&s3))
}

func TestInvalidPortAppProtocolMatcher(t *testing.T) {
	s1 := "httpname"
	s2 := "name"
	s3 := "http-name"
	s4 := ""
	s5 := "grpc-web-wrong"
	assert.False(t, MatchPortAppProtocolWithValidProtocols(&s1))
	assert.False(t, MatchPortAppProtocolWithValidProtocols(&s2))
	assert.False(t, MatchPortAppProtocolWithValidProtocols(&s3))
	assert.False(t, MatchPortAppProtocolWithValidProtocols(&s4))
	assert.False(t, MatchPortAppProtocolWithValidProtocols(&s5))
	assert.False(t, MatchPortAppProtocolWithValidProtocols(nil))
}

func TestPolicyHasMtlsEnabledStructMode(t *testing.T) {
	policy := createPeerAuthn("default", "bookinfo", nil)

	enabled, mode := PeerAuthnHasMTLSEnabled(policy)
	assert.False(t, enabled)
	assert.Equal(t, "", mode)
}

func TestPolicyHasMTLSEnabledStrictMode(t *testing.T) {
	policy := createPeerAuthn("default", "bookinfo", createMtls("STRICT"))

	enabled, mode := PeerAuthnHasMTLSEnabled(policy)
	assert.True(t, enabled)
	assert.Equal(t, "STRICT", mode)
}

func TestPolicyHasMTLSEnabledStructMtls(t *testing.T) {
	policy := createPeerAuthn("default", "bookinfo", createMtls("STRICT"))

	enabled, mode := PeerAuthnHasMTLSEnabled(policy)
	assert.True(t, enabled)
	assert.Equal(t, "STRICT", mode)
}

func TestPolicyHasMTLSEnabledPermissiveMode(t *testing.T) {
	policy := createPeerAuthn("default", "bookinfo", createMtls("PERMISSIVE"))

	enabled, mode := PeerAuthnHasMTLSEnabled(policy)
	assert.True(t, enabled)
	assert.Equal(t, "PERMISSIVE", mode)
}

func createMtls(mode string) *api_security_v1beta1.PeerAuthentication_MutualTLS {
	mtls := &api_security_v1beta1.PeerAuthentication_MutualTLS{}
	mtls.Mode = api_security_v1beta1.PeerAuthentication_MutualTLS_Mode(api_security_v1beta1.PeerAuthentication_MutualTLS_Mode_value[mode])
	return mtls
}

func createPeerAuthn(name, namespace string, mtls *api_security_v1beta1.PeerAuthentication_MutualTLS) *security_v1beta1.PeerAuthentication {
	pa := &security_v1beta1.PeerAuthentication{}
	pa.Name = name
	pa.Namespace = namespace
	pa.Spec.Mtls = mtls
	return pa
}
