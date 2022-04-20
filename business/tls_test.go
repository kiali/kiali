package business

import (
	"context"
	"testing"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	api_security_v1beta1 "istio.io/api/security/v1beta1"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/tests/data"
)

func TestMeshStatusEnabled(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	ns := []string{"test"}
	pa := fakeStrictMeshPeerAuthentication("default")
	dr := []networking_v1beta1.DestinationRule{
		*data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("test", "default", "*.local"))}

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetNamespaces", mock.AnythingOfType("string")).Return(&core_v1.Namespace{}, nil)
	k8s.On("GetToken").Return("token")

	TLSService := getTLSService(k8s, false, ns, pa, dr)
	status, err := TLSService.MeshWidemTLSStatus(context.TODO(), ns)

	cleanTestGlobals()

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func TestMeshStatusEnabledAutoMtls(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	ns := []string{"test"}
	pa := fakeStrictMeshPeerAuthentication("default")
	dr := []networking_v1beta1.DestinationRule{}

	k8s := new(kubetest.K8SClientMock)

	k8s.On("IsMaistraApi").Return(false)
	k8s.On("IsOpenShift").Return(false)

	TLSService := getTLSService(k8s, true, ns, pa, dr)
	status, err := TLSService.MeshWidemTLSStatus(context.TODO(), ns)

	cleanTestGlobals()

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func TestMeshStatusPartiallyEnabled(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	ns := []string{"test"}
	pa := fakeStrictMeshPeerAuthentication("default")
	dr := []networking_v1beta1.DestinationRule{
		*data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("istio-system", "default", "sleep.foo.svc.cluster.local"))}

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("IsOpenShift").Return(false)

	TLSService := getTLSService(k8s, false, ns, pa, dr)
	status, err := TLSService.MeshWidemTLSStatus(context.TODO(), ns)

	cleanTestGlobals()

	assert.NoError(err)
	assert.Equal(MTLSPartiallyEnabled, status.Status)
}

func TestMeshStatusNotEnabled(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	ns := []string{"test"}
	pa := []security_v1beta1.PeerAuthentication{}
	dr := []networking_v1beta1.DestinationRule{
		*data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("istio-system", "default", "sleep.foo.svc.cluster.local"))}

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetNamespace", mock.AnythingOfType("string")).Return(&core_v1.Namespace{}, nil)

	TLSService := getTLSService(k8s, false, ns, pa, dr)
	status, err := TLSService.MeshWidemTLSStatus(context.TODO(), ns)

	cleanTestGlobals()

	assert.NoError(err)
	assert.Equal(MTLSNotEnabled, status.Status)
}

func TestMeshStatusDisabled(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	ns := []string{"test"}
	pa := fakeMeshPeerAuthenticationWithMtlsMode("default", "DISABLE")
	dr := []networking_v1beta1.DestinationRule{
		*data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("istio-system", "default", "*.local"))}

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("IsOpenShift").Return(false)
	k8s.On("GetNamespace", mock.AnythingOfType("string")).Return(&core_v1.Namespace{}, nil)

	TLSService := getTLSService(k8s, false, ns, pa, dr)
	status, err := TLSService.MeshWidemTLSStatus(context.TODO(), ns)

	cleanTestGlobals()

	assert.NoError(err)
	assert.Equal(MTLSDisabled, status.Status)
}

func TestMeshStatusNotEnabledAutoMtls(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	ns := []string{"test"}
	pa := []security_v1beta1.PeerAuthentication{}
	dr := []networking_v1beta1.DestinationRule{}

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("IsOpenShift").Return(false)

	TLSService := getTLSService(k8s, true, ns, pa, dr)
	status, err := TLSService.MeshWidemTLSStatus(context.TODO(), ns)

	cleanTestGlobals()

	assert.NoError(err)
	assert.Equal(MTLSNotEnabled, status.Status)
}

func TestNamespaceHasMTLSEnabled(t *testing.T) {
	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []networking_v1beta1.DestinationRule{
		*data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSEnabled, []networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPeerAuthnDisabled(t *testing.T) {
	ps := fakePeerAuthnWithMtlsMode("default", "bookinfo", "DISABLE")
	drs := []networking_v1beta1.DestinationRule{
		*data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSDisabled, []networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasDestinationRuleDisabled(t *testing.T) {
	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []networking_v1beta1.DestinationRule{
		*data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSEnabled, []networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasNoDestinationRulesNoPolicy(t *testing.T) {
	var drs []networking_v1beta1.DestinationRule
	var ps []security_v1beta1.PeerAuthentication

	testNamespaceScenario(MTLSNotEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSNotEnabled, drs, ps, false, t)

	ps = fakePeerAuthnWithSelector("default", "bookinfo", "productpage")
	drs = []networking_v1beta1.DestinationRule{
		*data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	testNamespaceScenario(MTLSNotEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSNotEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSNotEnabled, []networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPermissivePeerAuthDisableDestRule(t *testing.T) {
	ps := fakePermissivePeerAuthn("default", "bookinfo")
	drs := []networking_v1beta1.DestinationRule{
		*data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSPartiallyEnabled, []networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPermissivePeerAuthStrictDestRule(t *testing.T) {
	ps := fakePermissivePeerAuthn("default", "bookinfo")
	drs := []networking_v1beta1.DestinationRule{
		*data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "strict-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSPartiallyEnabled, []networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasMTLSDisabled(t *testing.T) {
	ps := fakePeerAuthnWithMtlsMode("default", "bookinfo", "DISABLE")
	drs := []networking_v1beta1.DestinationRule{
		*data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSDisabled, drs, ps, false, t)
	testNamespaceScenario(MTLSDisabled, drs, ps, true, t)
	testNamespaceScenario(MTLSDisabled, []networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPeerAuthnDisabledMtlsDestRule(t *testing.T) {
	ps := fakePeerAuthnWithMtlsMode("default", "bookinfo", "DISABLE")
	drs := []networking_v1beta1.DestinationRule{
		*data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSDisabled, []networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasDestinationRuleEnabledDifferentNs(t *testing.T) {
	assert := assert.New(t)

	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []networking_v1beta1.DestinationRule{
		*data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("foo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}

	k8s := new(kubetest.K8SClientMock)
	projects := fakeProjects()
	nss := []string{}
	for _, p := range projects {
		nss = append(nss, p.Name)
	}
	k8s.On("IsOpenShift").Return(true)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("GetProjects", mock.AnythingOfType("string")).Return(projects, nil)
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&projects[0], nil)
	k8s.On("GetToken").Return("token")

	autoMtls := false
	kialiCache = cache.FakeTlsKialiCache("token", nss, ps, drs)
	TLSService := TLSService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil), enabledAutoMtls: &autoMtls}
	status, err := TLSService.NamespaceWidemTLSStatus(context.TODO(), "bookinfo")

	cleanTestGlobals()

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func testNamespaceScenario(exStatus string, drs []networking_v1beta1.DestinationRule, ps []security_v1beta1.PeerAuthentication, autoMtls bool, t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	k8s := new(kubetest.K8SClientMock)
	projects := fakeProjects()
	nss := []string{}
	for _, p := range projects {
		nss = append(nss, p.Name)
	}
	k8s.On("IsOpenShift").Return(true)
	k8s.On("IsMaistraApi").Return(false)
	k8s.On("GetProjects", mock.AnythingOfType("string")).Return(projects, nil)
	k8s.On("GetProject", mock.AnythingOfType("string")).Return(&projects[0], nil)
	k8s.On("GetToken").Return("token")

	conf = config.NewConfig()
	conf.Deployment.AccessibleNamespaces = []string{"**"}
	config.Set(conf)

	kialiCache = cache.FakeTlsKialiCache("token", nss, ps, drs)
	TLSService := &TLSService{k8s: k8s, enabledAutoMtls: &autoMtls, businessLayer: NewWithBackends(k8s, nil, nil)}
	status, err := TLSService.NamespaceWidemTLSStatus(context.TODO(), "bookinfo")

	cleanTestGlobals()

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

func fakeStrictPeerAuthn(name, namespace string) []security_v1beta1.PeerAuthentication {
	return fakePeerAuthnWithMtlsMode(name, namespace, "STRICT")
}

func fakePeerAuthnWithSelector(name, namespace, target string) []security_v1beta1.PeerAuthentication {
	return []security_v1beta1.PeerAuthentication{*data.CreateEmptyPeerAuthenticationWithSelector(name, namespace, data.CreateOneLabelSelector(target))}
}

func fakePermissivePeerAuthn(name, namespace string) []security_v1beta1.PeerAuthentication {
	return fakePeerAuthnWithMtlsMode(name, namespace, "PERMISSIVE")
}

func fakePeerAuthnWithMtlsMode(name, namespace, mTLSmode string) []security_v1beta1.PeerAuthentication {
	return fakePeerAuthn(name, namespace, data.CreateMTLS(mTLSmode))
}

func fakePeerAuthn(name, namespace string, peers *api_security_v1beta1.PeerAuthentication_MutualTLS) []security_v1beta1.PeerAuthentication {
	return []security_v1beta1.PeerAuthentication{*data.CreateEmptyPeerAuthentication(name, namespace, peers)}
}

func getTLSService(k8s kubernetes.ClientInterface, autoMtls bool, namespaces []string, pa []security_v1beta1.PeerAuthentication, dr []networking_v1beta1.DestinationRule) *TLSService {
	kialiCache = cache.FakeTlsKialiCache("token", namespaces, pa, dr)
	return &TLSService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil, nil), enabledAutoMtls: &autoMtls}
}

func fakeStrictMeshPeerAuthentication(name string) []security_v1beta1.PeerAuthentication {
	return fakeMeshPeerAuthenticationWithMtlsMode(name, "STRICT")
}

func fakeMeshPeerAuthenticationWithMtlsMode(name, mTLSmode string) []security_v1beta1.PeerAuthentication {
	mtls := &api_security_v1beta1.PeerAuthentication_MutualTLS{
		Mode: api_security_v1beta1.PeerAuthentication_MutualTLS_Mode(api_security_v1beta1.PeerAuthentication_MutualTLS_Mode_value[mTLSmode]),
	}
	return fakeMeshPeerAuthentication(name, mtls)
}

func fakeMeshPeerAuthentication(name string, mtls *api_security_v1beta1.PeerAuthentication_MutualTLS) []security_v1beta1.PeerAuthentication {
	return []security_v1beta1.PeerAuthentication{*data.CreateEmptyMeshPeerAuthentication(name, mtls)}
}

// Global variables should be updated after a test is finished
func cleanTestGlobals() {
	kialiCache = nil
}
