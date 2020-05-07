package business

import (
	"testing"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/mock"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

func TestCorrectMeshPolicy(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakeMeshPeerAuthenticationEmptyMTLS("default"), nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := TLSService{k8s: k8s}
	meshPolicyEnabled, err := (tlsService).hasMeshPeerAuthnEnabled()

	assert.NoError(err)
	assert.Equal(true, meshPolicyEnabled)
}

func TestMeshPolicyWithoutNamespaces(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakeMeshPeerAuthenticationEmptyMTLS("default"), nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := TLSService{k8s: k8s}
	// Update: KIALI-3223, now this API doesn't require a list of namespaces, as it has a MeshPolicy it will return true
	// Perhaps this test can be removed in the future
	meshPolicyEnabled, _ := (tlsService).hasMeshPeerAuthnEnabled()

	assert.Equal(true, meshPolicyEnabled)
}

func TestPeerAuthnWithPermissiveMode(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakePermissiveMeshPeerAuthentication("default"), nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := TLSService{k8s: k8s}
	isGloballyEnabled, err := (tlsService).hasMeshPeerAuthnEnabled()

	assert.NoError(err)
	assert.Equal(false, isGloballyEnabled)
}

func TestPeerAuthnWithStrictMode(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakeStrictMeshPeerAuthentication("default"), nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := TLSService{k8s: k8s}
	isGloballyEnabled, err := (tlsService).hasMeshPeerAuthnEnabled()

	assert.NoError(err)
	assert.Equal(true, isGloballyEnabled)
}

func fakeMeshPeerAuthenticationEmptyMTLS(name string) []kubernetes.IstioObject {
	return fakeMeshPeerAuthentication(name, map[string]interface{}{})
}

func fakePermissiveMeshPeerAuthentication(name string) []kubernetes.IstioObject {
	return fakeMeshPeerAuthenticationWithMtlsMode(name, "PERMISSIVE")
}

func fakeStrictMeshPeerAuthentication(name string) []kubernetes.IstioObject {
	return fakeMeshPeerAuthenticationWithMtlsMode(name, "STRICT")
}

func fakeMeshPeerAuthenticationWithMtlsMode(name, mTLSmode string) []kubernetes.IstioObject {
	mtls := map[string]interface{}{
		"mode": mTLSmode,
	}
	return fakeMeshPeerAuthentication(name, mtls)
}

func fakeMeshPeerAuthentication(name string, mtls interface{}) []kubernetes.IstioObject {
	return []kubernetes.IstioObject{data.CreateEmptyMeshPeerAuthentication(name, mtls)}
}

func TestWithoutMeshPeerAuthn(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return([]kubernetes.IstioObject{}, nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := TLSService{k8s: k8s}
	meshPolicyEnabled, err := (tlsService).hasMeshPeerAuthnEnabled()

	assert.NoError(err)
	assert.Equal(false, meshPolicyEnabled)
}

func TestMeshPeerAuthnWithSelector(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakeMeshPeerAuthnEnablingMTLSSpecificTarget(), nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := TLSService{k8s: k8s}
	meshPolicyEnabled, err := (tlsService).hasMeshPeerAuthnEnabled()

	assert.NoError(err)
	assert.Equal(false, meshPolicyEnabled)
}

func fakeMeshPeerAuthnEnablingMTLSSpecificTarget() []kubernetes.IstioObject {
	selector := map[string]interface{}{
		"matchLabels": map[string]interface{}{
			"app": "productpage",
		},
	}

	policy := data.AddSelectorToPeerAuthn(selector,
		data.CreateEmptyMeshPeerAuthentication("non-global-tls-enabled", data.CreateMTLS("STRICT")))

	return []kubernetes.IstioObject{policy}
}

func TestDestinationRuleEnabled(t *testing.T) {
	assert := assert.New(t)

	dr := data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("istio-system", "default", "*.local"))

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDestinationRules", "test", "").Return([]kubernetes.IstioObject{dr}, nil)

	tlsService := TLSService{k8s: k8s}
	drEnabled, err := (tlsService).hasDestinationRuleEnabled([]string{"test"})

	assert.NoError(err)
	assert.Equal(true, drEnabled)
}

func TestDRWildcardLocalHost(t *testing.T) {
	assert := assert.New(t)

	dr := data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("myproject", "default", "sleep.foo.svc.cluster.local"))

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDestinationRules", "test", "").Return([]kubernetes.IstioObject{dr}, nil)

	tlsService := TLSService{k8s: k8s}
	drEnabled, err := (tlsService).hasDestinationRuleEnabled([]string{"test"})

	assert.NoError(err)
	assert.Equal(false, drEnabled)
}

func TestDRNotMutualTLSMode(t *testing.T) {
	assert := assert.New(t)

	trafficPolicy := map[string]interface{}{
		"tls": map[string]interface{}{
			"mode": "SIMPLE",
		},
	}

	dr := data.AddTrafficPolicyToDestinationRule(trafficPolicy,
		data.CreateEmptyDestinationRule("istio-system", "default", "*.local"))

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDestinationRules", "test", "").Return([]kubernetes.IstioObject{dr}, nil)

	tlsService := TLSService{k8s: k8s}
	drEnabled, err := (tlsService).hasDestinationRuleEnabled([]string{"test"})

	assert.NoError(err)
	assert.Equal(false, drEnabled)
}

func TestMeshStatusEnabled(t *testing.T) {
	assert := assert.New(t)

	dr := data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("istio-system", "default", "*.local"))

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDestinationRules", "test", "").Return([]kubernetes.IstioObject{dr}, nil)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakeMeshPeerAuthenticationEmptyMTLS("default"), nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := TLSService{k8s: k8s}
	status, err := (tlsService).MeshWidemTLSStatus([]string{"test"})

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func TestMeshStatusPartiallyEnabled(t *testing.T) {
	assert := assert.New(t)

	dr := data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("istio-system", "default", "sleep.foo.svc.cluster.local"))

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDestinationRules", "test", "").Return([]kubernetes.IstioObject{dr}, nil)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakeMeshPeerAuthenticationEmptyMTLS("default"), nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := TLSService{k8s: k8s}
	status, err := (tlsService).MeshWidemTLSStatus([]string{"test"})

	assert.NoError(err)
	assert.Equal(MTLSPartiallyEnabled, status.Status)
}

func TestMeshStatusNotEnabled(t *testing.T) {
	assert := assert.New(t)

	dr := data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("istio-system", "default", "sleep.foo.svc.cluster.local"))

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetDestinationRules", "test", "").Return([]kubernetes.IstioObject{dr}, nil)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return([]kubernetes.IstioObject{}, nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := TLSService{k8s: k8s}
	status, err := (tlsService).MeshWidemTLSStatus([]string{"test"})

	assert.NoError(err)
	assert.Equal(MTLSNotEnabled, status.Status)
}

func TestNamespaceHasMTLSEnabled(t *testing.T) {
	ps := fakePeerAuthnEmptyMTLS("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSEnabled, drs, ps, t)
}

func TestNamespaceHasPolicyDisabled(t *testing.T) {
	ps := fakePermissivePeerAuthn("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, t)
}

func TestNamespaceHasDestinationRuleDisabled(t *testing.T) {
	ps := fakePeerAuthnEmptyMTLS("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, t)
}

func TestNamespaceHasNoDestinationRulesNoPolicy(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	ps := []kubernetes.IstioObject{}
	drs := []kubernetes.IstioObject{}

	testNamespaceScenario(MTLSNotEnabled, drs, ps, t)

	ps = fakePeerAuthnWithSelector("default", "bookinfo", "productpage")
	drs = []kubernetes.IstioObject{
		data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	testNamespaceScenario(MTLSNotEnabled, drs, ps, t)
}

func TestNamespaceHasMTLSDisabled(t *testing.T) {
	ps := fakePermissivePeerAuthn("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSDisabled, drs, ps, t)
}

func TestNamespaceHasSimpleTls(t *testing.T) {
	ps := fakePermissivePeerAuthn("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateSimpleTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSDisabled, drs, ps, t)
}

func TestNamespaceHasDestinationRuleEnabledDifferentNs(t *testing.T) {
	assert := assert.New(t)

	ps := fakePeerAuthnEmptyMTLS("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("foo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("GetProjects").Return(fakeProjects(), nil)
	k8s.On("GetDestinationRules", "foo", "").Return(drs, nil)
	k8s.On("GetDestinationRules", "bookinfo", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetPeerAuthentications", "bookinfo").Return(ps, nil)

	tlsService := TLSService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil)}
	status, err := (tlsService).NamespaceWidemTLSStatus("bookinfo")

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func testNamespaceScenario(exStatus string, drs []kubernetes.IstioObject, ps []kubernetes.IstioObject, t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("GetProjects").Return(fakeProjects(), nil)
	k8s.On("GetDestinationRules", "bookinfo", "").Return(drs, nil)
	k8s.On("GetDestinationRules", "foo", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetPeerAuthentications", "bookinfo").Return(ps, nil)

	tlsService := TLSService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil)}
	status, err := (tlsService).NamespaceWidemTLSStatus("bookinfo")

	assert.NoError(err)
	assert.Equal(exStatus, status.Status)
}

func fakeProjects() []osproject_v1.Project {
	return []osproject_v1.Project{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "bookinfo",
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "foo",
			},
		},
	}
}

func fakePeerAuthnEmptyMTLS(name, namespace string) []kubernetes.IstioObject {
	return fakePeerAuthn(name, namespace, map[string]interface{}{})
}

func fakePeerAuthnWithSelector(name, namespace, target string) []kubernetes.IstioObject {
	return []kubernetes.IstioObject{data.CreateEmptyPeerAuthenticationWithSelector(name, namespace, data.CreateOneLabelSelector(target))}
}

func fakePermissivePeerAuthn(name, namespace string) []kubernetes.IstioObject {
	return fakePeerAuthnWithMtlsMode(name, namespace, "PERMISSIVE")
}

func fakePeerAuthnWithMtlsMode(name, namespace, mTLSmode string) []kubernetes.IstioObject {
	return fakePeerAuthn(name, namespace, data.CreateMTLS(mTLSmode))
}

func fakePeerAuthn(name, namespace string, peers interface{}) []kubernetes.IstioObject {
	return []kubernetes.IstioObject{data.CreateEmptyPeerAuthentication(name, namespace, peers)}
}
