package business

import (
	"testing"

	osproject_v1 "github.com/openshift/api/project/v1"
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
	k8s.On("GetMeshPolicies", "test").Return(fakeMeshPolicyEmptyMTLS("default"), nil)

	tlsService := TLSService{k8s: k8s}
	meshPolicyEnabled, err := (tlsService).hasMeshPolicyEnabled([]string{"test"})

	assert.NoError(err)
	assert.Equal(true, meshPolicyEnabled)
}

func TestMeshPolicyWithoutNamespaces(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetMeshPolicies", "test").Return(fakeMeshPolicyEmptyMTLS("default"), nil)

	tlsService := TLSService{k8s: k8s}
	meshPolicyEnabled, err := (tlsService).hasMeshPolicyEnabled([]string{})

	assert.EqualError(err, "Unable to determine mesh-wide mTLS status without access to any namespace")
	assert.Equal(false, meshPolicyEnabled)
}

func TestPolicyWithWrongName(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetMeshPolicies", "test").Return(fakeMeshPolicyEmptyMTLS("wrong-name"), nil)

	tlsService := TLSService{k8s: k8s}
	isGloballyEnabled, err := (tlsService).hasMeshPolicyEnabled([]string{"test"})

	assert.NoError(err)
	assert.Equal(false, isGloballyEnabled)
}

func TestPolicyWithPermissiveMode(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetMeshPolicies", "test").Return(fakePermissiveMeshPolicy("default"), nil)

	tlsService := TLSService{k8s: k8s}
	isGloballyEnabled, err := (tlsService).hasMeshPolicyEnabled([]string{"test"})

	assert.NoError(err)
	assert.Equal(false, isGloballyEnabled)
}

func TestPolicyWithStrictMode(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetMeshPolicies", "test").Return(fakeStrictMeshPolicy("default"), nil)

	tlsService := TLSService{k8s: k8s}
	isGloballyEnabled, err := (tlsService).hasMeshPolicyEnabled([]string{"test"})

	assert.NoError(err)
	assert.Equal(true, isGloballyEnabled)
}

func fakeMeshPolicyEmptyMTLS(name string) []kubernetes.IstioObject {
	mtls := []interface{}{
		map[string]interface{}{
			"mtls": nil,
		},
	}
	return fakeMeshPolicy(name, mtls)
}

func fakePermissiveMeshPolicy(name string) []kubernetes.IstioObject {
	return fakeMeshPolicyWithMtlsMode(name, "PERMISSIVE")
}

func fakeStrictMeshPolicy(name string) []kubernetes.IstioObject {
	return fakeMeshPolicyWithMtlsMode(name, "STRICT")
}

func fakeMeshPolicyWithMtlsMode(name, mTLSmode string) []kubernetes.IstioObject {
	mtls := []interface{}{
		map[string]interface{}{
			"mtls": map[string]interface{}{
				"mode": mTLSmode,
			},
		},
	}
	return fakeMeshPolicy(name, mtls)
}

func fakeMeshPolicy(name string, peers []interface{}) []kubernetes.IstioObject {
	return []kubernetes.IstioObject{data.CreateEmptyMeshPolicy(name, peers)}
}

func TestWithoutMeshPolicy(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetMeshPolicies", "test").Return([]kubernetes.IstioObject{}, nil)

	tlsService := TLSService{k8s: k8s}
	meshPolicyEnabled, err := (tlsService).hasMeshPolicyEnabled([]string{"test"})

	assert.NoError(err)
	assert.Equal(false, meshPolicyEnabled)
}

func TestMeshPolicyWithTargets(t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetMeshPolicies", "test").Return(fakeMeshPolicyEnablingMTLSSpecificTarget(), nil)

	tlsService := TLSService{k8s: k8s}
	meshPolicyEnabled, err := (tlsService).hasMeshPolicyEnabled([]string{"test"})

	assert.NoError(err)
	assert.Equal(false, meshPolicyEnabled)
}

func fakeMeshPolicyEnablingMTLSSpecificTarget() []kubernetes.IstioObject {
	targets := []interface{}{
		map[string]interface{}{
			"name": "productpage",
		},
	}

	mtls := []interface{}{
		map[string]interface{}{
			"mtls": "",
		},
	}

	policy := data.AddTargetsToMeshPolicy(targets,
		data.CreateEmptyMeshPolicy("non-global-tls-enabled", mtls))

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
	k8s.On("GetMeshPolicies", "test").Return(fakeMeshPolicyEmptyMTLS("default"), nil)

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
	k8s.On("GetMeshPolicies", "test").Return(fakeMeshPolicyEmptyMTLS("default"), nil)

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
	k8s.On("GetMeshPolicies", "test").Return(fakeMeshPolicyEmptyMTLS("wrong-name"), nil)

	tlsService := TLSService{k8s: k8s}
	status, err := (tlsService).MeshWidemTLSStatus([]string{"test"})

	assert.NoError(err)
	assert.Equal(MTLSNotEnabled, status.Status)
}

func TestNamespaceHasMTLSEnabled(t *testing.T) {
	ps := fakePolicyEmptyMTLS("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSEnabled, drs, ps, t)
}

func TestNamespaceHasPolicyDisabled(t *testing.T) {
	ps := fakePermissivePolicy("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, t)
}

func TestNamespaceHasDestinationRuleDisabled(t *testing.T) {
	ps := fakePolicyEmptyMTLS("default", "bookinfo")
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

	ps = fakeTargetedPolicy("default", "bookinfo", "productpage")
	drs = []kubernetes.IstioObject{
		data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	testNamespaceScenario(MTLSNotEnabled, drs, ps, t)
}

func TestNamespaceHasMTLSDisabled(t *testing.T) {
	ps := fakePermissivePolicy("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSDisabled, drs, ps, t)
}

func TestNamespaceHasSimpleTls(t *testing.T) {
	ps := fakePermissivePolicy("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateSimpleTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSDisabled, drs, ps, t)
}

func TestNamespaceHasDestinationRuleEnabledDifferentNs(t *testing.T) {
	assert := assert.New(t)

	ps := fakePolicyEmptyMTLS("default", "bookinfo")
	drs := []kubernetes.IstioObject{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("foo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetProjects").Return(fakeProjects(), nil)
	k8s.On("GetDestinationRules", "foo", "").Return(drs, nil)
	k8s.On("GetDestinationRules", "bookinfo", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetPolicies", "bookinfo").Return(ps, nil)

	tlsService := TLSService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil)}
	status, err := (tlsService).NamespaceWidemTLSStatus("bookinfo")

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func testNamespaceScenario(exStatus string, drs []kubernetes.IstioObject, ps []kubernetes.IstioObject, t *testing.T) {
	assert := assert.New(t)

	k8s := new(kubetest.K8SClientMock)
	k8s.On("IsOpenShift").Return(true)
	k8s.On("GetProjects").Return(fakeProjects(), nil)
	k8s.On("GetDestinationRules", "bookinfo", "").Return(drs, nil)
	k8s.On("GetDestinationRules", "foo", "").Return([]kubernetes.IstioObject{}, nil)
	k8s.On("GetPolicies", "bookinfo").Return(ps, nil)

	tlsService := TLSService{k8s: k8s, businessLayer: NewWithBackends(k8s, nil)}
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

func fakePolicyEmptyMTLS(name, namespace string) []kubernetes.IstioObject {
	mtls := []interface{}{
		map[string]interface{}{
			"mtls": nil,
		},
	}
	return fakePolicy(name, namespace, mtls)
}

func fakeTargetedPolicy(name, namespace, target string) []kubernetes.IstioObject {
	targets := []interface{}{
		map[string]interface{}{
			"name": target,
		},
	}

	return []kubernetes.IstioObject{data.CreateEmptyPolicyWithTargets(name, namespace, targets)}
}

func fakePermissivePolicy(name, namespace string) []kubernetes.IstioObject {
	return fakePolicyWithMtlsMode(name, namespace, "PERMISSIVE")
}

func fakePolicyWithMtlsMode(name, namespace, mTLSmode string) []kubernetes.IstioObject {
	mtls := []interface{}{
		map[string]interface{}{
			"mtls": map[string]interface{}{
				"mode": mTLSmode,
			},
		},
	}
	return fakePolicy(name, namespace, mtls)
}

func fakePolicy(name, namespace string, peers []interface{}) []kubernetes.IstioObject {
	return []kubernetes.IstioObject{data.CreateEmptyPolicy(name, namespace, peers)}
}
