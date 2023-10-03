package kubernetes

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	api_security_v1beta1 "istio.io/api/security/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util/httputil"
)

// Because config.Config is a global variable, we need to reset it after each test.
// This func will reset the config back to its previous value.
func setConfig(t *testing.T, newConfig config.Config) {
	t.Helper()
	previousConfig := *config.Get()
	t.Cleanup(func() {
		config.Set(&previousConfig)
	})
	config.Set(&newConfig)
}

// The port pool is a global variable so we need to reset it between tests.
func setPortPool(t *testing.T, addr string) {
	t.Helper()
	addrPieces := strings.Split(addr, ":")
	port, err := strconv.Atoi(addrPieces[len(addrPieces)-1])
	if err != nil {
		t.Fatalf("Error parsing port from address: %s", err)
	}

	oldRange := httputil.Pool.PortRangeInit
	oldBusyPort := httputil.Pool.LastBusyPort
	oldSize := httputil.Pool.PortRangeSize
	t.Cleanup(func() {
		httputil.Pool.PortRangeInit = oldRange
		httputil.Pool.LastBusyPort = oldBusyPort
		httputil.Pool.PortRangeSize = oldSize
	})
	httputil.Pool.PortRangeInit = port
	httputil.Pool.LastBusyPort = port - 1
	httputil.Pool.PortRangeSize = 1
}

type fakePortForwarder struct{}

func (f *fakePortForwarder) Start() error { return nil }
func (f *fakePortForwarder) Stop()        {}

func istiodTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var file string
		switch r.URL.Path {
		case "/debug/configz":
			file = "../tests/data/registry/registry-configz.json"
		case "/debug/registryz":
			file = "../tests/data/registry/registry-registryz.json"
		case "/debug/syncz":
			file = "../tests/data/registry/registry-syncz.json"
		case "/ready":
			w.WriteHeader(http.StatusOK)
			return
		default:
			w.WriteHeader(http.StatusInternalServerError)
			t.Fatalf("Unexpected request path: %s", r.URL.Path)
			return
		}
		if _, err := w.Write(ReadFile(t, file)); err != nil {
			t.Fatalf("Error writing response: %s", err)
		}
	}))
	t.Cleanup(testServer.Close)
	return testServer
}

func runningIstiodPod() *core_v1.Pod {
	return &core_v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "istiod-123",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app": "istiod",
			},
		},
		Status: core_v1.PodStatus{
			Phase: core_v1.PodRunning,
		},
	}
}

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

func TestParseRegistryConfig(t *testing.T) {
	assert := assert.New(t)

	configz := "../tests/data/registry/registry-configz.json"
	bRegistryz, err := os.ReadFile(configz)
	assert.NoError(err)

	rConfig := map[string][]byte{
		"istiod1": bRegistryz,
	}
	registry, err2 := ParseRegistryConfig(rConfig)
	assert.NoError(err2)
	assert.NotNil(registry)

	assert.Equal(2, len(registry.DestinationRules))
	assert.Equal(12, len(registry.EnvoyFilters))
	assert.Equal(1, len(registry.Gateways))
	assert.Equal(1, len(registry.Gateways))
	assert.Equal(11, len(registry.Sidecars))
	assert.Equal(3, len(registry.VirtualServices))
	assert.Equal(12, len(registry.AuthorizationPolicies))
}

func TestRegistryServices(t *testing.T) {
	assert := assert.New(t)

	registryz := "../tests/data/registry/registry-registryz.json"
	bRegistryz, err := os.ReadFile(registryz)
	assert.NoError(err)

	rRegistry := map[string][]byte{
		"istiod1": bRegistryz,
	}

	registry, err2 := ParseRegistryServices(rRegistry)
	assert.NoError(err2)
	assert.NotNil(registry)

	assert.Equal(79, len(registry))
	assert.Equal("*.msn.com", registry[0].Attributes.Name)
}

func TestGetRegistryConfig(t *testing.T) {
	assert := assert.New(t)

	testServer := istiodTestServer(t)
	setPortPool(t, testServer.URL)

	k8sClient := &K8SClient{
		k8s: fake.NewSimpleClientset(runningIstiodPod()),
		getPodPortForwarderFunc: func(namespace, name, portMap string) (httputil.PortForwarder, error) {
			return &fakePortForwarder{}, nil
		},
	}

	_, err := k8sClient.GetRegistryConfiguration()
	assert.NoError(err)
}

func TestGetRegistryConfigExternal(t *testing.T) {
	assert := assert.New(t)

	testServer := istiodTestServer(t)

	conf := config.Get()
	conf.ExternalServices.Istio.Registry = &config.RegistryConfig{
		IstiodURL: testServer.URL,
	}
	setConfig(t, *conf)

	k8sClient := &K8SClient{}
	_, err := k8sClient.GetRegistryConfiguration()
	assert.NoError(err)
}

func TestGetRegistryConfigExternalBadResponse(t *testing.T) {
	assert := assert.New(t)

	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(testServer.Close)

	conf := config.Get()
	conf.ExternalServices.Istio.Registry = &config.RegistryConfig{
		IstiodURL: testServer.URL,
	}
	setConfig(t, *conf)

	k8sClient := &K8SClient{}
	_, err := k8sClient.GetRegistryConfiguration()
	assert.Error(err)
}

func TestGetRegistryServices(t *testing.T) {
	assert := assert.New(t)

	testServer := istiodTestServer(t)
	setPortPool(t, testServer.URL)

	k8sClient := &K8SClient{
		k8s: fake.NewSimpleClientset(runningIstiodPod()),
		getPodPortForwarderFunc: func(namespace, name, portMap string) (httputil.PortForwarder, error) {
			return &fakePortForwarder{}, nil
		},
	}

	_, err := k8sClient.GetRegistryServices()
	assert.NoError(err)
}

func TestGetRegistryServicesExternal(t *testing.T) {
	assert := assert.New(t)

	testServer := istiodTestServer(t)

	conf := config.Get()
	conf.ExternalServices.Istio.Registry = &config.RegistryConfig{
		IstiodURL: testServer.URL,
	}
	setConfig(t, *conf)

	k8sClient := &K8SClient{}
	_, err := k8sClient.GetRegistryServices()
	assert.NoError(err)
}

func TestGetRegistryServicesExternalBadResponse(t *testing.T) {
	assert := assert.New(t)

	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(testServer.Close)

	conf := config.Get()
	conf.ExternalServices.Istio.Registry = &config.RegistryConfig{
		IstiodURL: testServer.URL,
	}
	setConfig(t, *conf)

	k8sClient := &K8SClient{}
	_, err := k8sClient.GetRegistryServices()
	assert.Error(err)
}

func TestGetProxyStatus(t *testing.T) {
	assert := assert.New(t)

	testServer := istiodTestServer(t)
	setPortPool(t, testServer.URL)

	k8sClient := &K8SClient{
		k8s: fake.NewSimpleClientset(runningIstiodPod()),
		getPodPortForwarderFunc: func(namespace, name, portMap string) (httputil.PortForwarder, error) {
			return &fakePortForwarder{}, nil
		},
	}

	_, err := k8sClient.GetProxyStatus()
	assert.NoError(err)
}

func TestGetProxyStatusExternal(t *testing.T) {
	assert := assert.New(t)

	testServer := istiodTestServer(t)

	conf := config.Get()
	conf.ExternalServices.Istio.Registry = &config.RegistryConfig{
		IstiodURL: testServer.URL,
	}
	setConfig(t, *conf)

	k8sClient := &K8SClient{}
	_, err := k8sClient.GetProxyStatus()
	assert.NoError(err)
}

func TestGetProxyStatusExternalBadResponse(t *testing.T) {
	assert := assert.New(t)

	testServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(testServer.Close)

	conf := config.Get()
	conf.ExternalServices.Istio.Registry = &config.RegistryConfig{
		IstiodURL: testServer.URL,
	}
	setConfig(t, *conf)

	k8sClient := &K8SClient{}
	_, err := k8sClient.GetProxyStatus()
	assert.Error(err)
}

func TestCanConnectToIstiodUnreachable(t *testing.T) {
	assert := assert.New(t)
	k8sClient := &K8SClient{
		k8s: fake.NewSimpleClientset(runningIstiodPod()),
		getPodPortForwarderFunc: func(namespace, name, portMap string) (httputil.PortForwarder, error) {
			return &fakePortForwarder{}, nil
		},
	}

	status, err := k8sClient.CanConnectToIstiod()
	assert.NoError(err)

	assert.Len(status, 1)
	assert.Equal(ComponentUnreachable, status[0].Status)
}

func TestCanConnectToIstiodReachable(t *testing.T) {
	assert := assert.New(t)
	k8sClient := &K8SClient{
		k8s: fake.NewSimpleClientset(runningIstiodPod()),
		getPodPortForwarderFunc: func(namespace, name, portMap string) (httputil.PortForwarder, error) {
			return &fakePortForwarder{}, nil
		},
	}
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(ts.Close)

	setPortPool(t, ts.URL)

	status, err := k8sClient.CanConnectToIstiod()
	assert.NoError(err)

	assert.Len(status, 1)
}
