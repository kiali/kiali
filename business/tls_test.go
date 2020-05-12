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

func TestCorrectMeshPeerAuthn(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakeStrictMeshPeerAuthentication("default"), nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := TLSService{k8s: k8s}
	meshPolicyEnabled, err := (tlsService).hasMeshPeerAuthnEnabled()

	assert.NoError(err)
	assert.Equal(true, meshPolicyEnabled)
}

func TestMeshPeerAuthnWithoutNamespaces(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakeStrictMeshPeerAuthentication("default"), nil)
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

	peerAuthn := data.AddSelectorToPeerAuthn(selector,
		data.CreateEmptyMeshPeerAuthentication("non-global-tls-enabled", data.CreateMTLS("STRICT")))

	return []kubernetes.IstioObject{peerAuthn}
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
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakeStrictMeshPeerAuthentication("default"), nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := getTLSService(k8s, false)
	status, err := (tlsService).MeshWidemTLSStatus([]string{"test"})

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func TestMeshStatusEnabledAutoMtls(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakeStrictMeshPeerAuthentication("default"), nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := getTLSService(k8s, true)
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
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return(fakeStrictMeshPeerAuthentication("default"), nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := getTLSService(k8s, false)
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

	tlsService := getTLSService(k8s, false)
	status, err := (tlsService).MeshWidemTLSStatus([]string{"test"})

	assert.NoError(err)
	assert.Equal(MTLSNotEnabled, status.Status)
}

func TestMeshStatusNotEnabledAutoMtls(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetPeerAuthentications", mock.AnythingOfType("string")).Return([]kubernetes.IstioObject{}, nil)
	k8s.On("IsMaistraApi").Return(false)

	tlsService := getTLSService(k8s, true)
	status, err := (tlsService).MeshWidemTLSStatus([]string{"test"})

	assert.NoError(err)
	assert.Equal(MTLSNotEnabled, status.Status)
}

func TestNamespaceHasMTLSEnabled(t *testing.T) {
	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSEnabled, []kubernetes.IstioObject{}, ps, true, t)
}

func TestNamespaceHasPolicyDisabled(t *testing.T) {
	ps := fakePeerAuthnWithMtlsMode("default", "bookinfo", "DISABLE")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSPartiallyEnabled, []kubernetes.IstioObject{}, ps, true, t)
}

func TestNamespaceHasDestinationRuleDisabled(t *testing.T) {
	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSEnabled, []kubernetes.IstioObject{}, ps, true, t)
}

func TestNamespaceHasNoDestinationRulesNoPolicy(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	var drs, ps []kubernetes.IstioObject

	testNamespaceScenario(MTLSNotEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSNotEnabled, drs, ps, false, t)

	ps = fakePeerAuthnWithSelector("default", "bookinfo", "productpage")
	drs = []kubernetes.IstioObject{
		data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	testNamespaceScenario(MTLSNotEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSNotEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSNotEnabled, []kubernetes.IstioObject{}, ps, true, t)
}

func TestNamespaceHasMTLSDisabled(t *testing.T) {
	ps := fakePermissivePeerAuthn("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSDisabled, drs, ps, false, t)
	testNamespaceScenario(MTLSDisabled, drs, ps, true, t)
	testNamespaceScenario(MTLSEnabled, []kubernetes.IstioObject{}, ps, true, t)
}

func TestNamespaceHasSimpleTls(t *testing.T) {
	ps := fakePermissivePeerAuthn("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateSimpleTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSDisabled, drs, ps, false, t)
	testNamespaceScenario(MTLSDisabled, drs, ps, true, t)
	testNamespaceScenario(MTLSEnabled, []kubernetes.IstioObject{}, ps, true, t)
}

func TestNamespaceHasDestinationRuleEnabledDifferentNs(t *testing.T) {
	assert := assert.New(t)

	ps := fakeStrictPeerAuthn("default", "bookinfo")
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

	autoMtls := false
	tlsService := TLSService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil), enabledAutoMtls: &autoMtls}
	status, err := (tlsService).NamespaceWidemTLSStatus("bookinfo")

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func testNamespaceScenario(exStatus string, drs []kubernetes.IstioObject, ps []kubernetes.IstioObject, autoMtls bool, t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("GetProjects").Return(fakeProjects(), nil)
	k8s.On("GetDestinationRules", "bookinfo", "").Return(drs, nil)
	k8s.On("GetDestinationRules", "foo", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetPeerAuthentications", "bookinfo").Return(ps, nil)

	config.Set(config.NewConfig())

	tlsService := TLSService{k8s: k8s, enabledAutoMtls: &autoMtls, businessLayer: NewWithBackends(k8s, nil, nil)}
	tlsService.businessLayer.Namespace.isAccessibleNamespaces["**"] = true
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

func fakeStrictPeerAuthn(name, namespace string) []kubernetes.IstioObject {
	return fakePeerAuthnWithMtlsMode(name, namespace, "STRICT")
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

func getTLSService(k8s kubernetes.IstioClientInterface, autoMtls bool) *TLSService {
	return &TLSService{k8s: k8s, enabledAutoMtls: &autoMtls}
}
