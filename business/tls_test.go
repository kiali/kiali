package business

import (
	"context"
	"testing"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	api_security_v1beta1 "istio.io/api/security/v1beta1"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta1 "istio.io/client-go/pkg/apis/security/v1beta1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/util"
)

func TestMeshStatusEnabled(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	pa := fakeStrictMeshPeerAuthentication("default")
	dr := []*networking_v1beta1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("test", "default", "*.local")),
	}

	objs := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "test"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "default"}},
	}
	objs = append(objs, kubernetes.ToRuntimeObjects(pa)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(dr)...)

	k8s := kubetest.NewFakeK8sClient(objs...)
	SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	tlsService.enabledAutoMtls = util.AsPtr(false)
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), []string{"test"}, conf.KubernetesConfig.ClusterName)

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func TestMeshStatusEnabledAutoMtls(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	pa := fakeStrictMeshPeerAuthentication("default")
	dr := []*networking_v1beta1.DestinationRule{}

	objs := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "test"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "default"}},
	}
	objs = append(objs, kubernetes.ToRuntimeObjects(pa)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(dr)...)

	k8s := kubetest.NewFakeK8sClient(objs...)
	SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	tlsService.enabledAutoMtls = util.AsPtr(true)
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), []string{"test"}, conf.KubernetesConfig.ClusterName)

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func TestMeshStatusPartiallyEnabled(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	pa := fakeStrictMeshPeerAuthentication("default")
	dr := []*networking_v1beta1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("istio-system", "default", "sleep.foo.svc.cluster.local")),
	}

	objs := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "test"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "default"}},
	}
	objs = append(objs, kubernetes.ToRuntimeObjects(pa)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(dr)...)

	k8s := kubetest.NewFakeK8sClient(objs...)
	SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	tlsService.enabledAutoMtls = util.AsPtr(false)
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), []string{"test"}, conf.KubernetesConfig.ClusterName)

	assert.NoError(err)
	assert.Equal(MTLSPartiallyEnabled, status.Status)
}

func TestMeshStatusNotEnabled(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	ns := &core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "test"}}
	pa := []*security_v1beta1.PeerAuthentication{}
	dr := []*networking_v1beta1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("istio-system", "default", "sleep.foo.svc.cluster.local")),
	}
	objs := []runtime.Object{ns}
	objs = append(objs, kubernetes.ToRuntimeObjects(pa)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(dr)...)

	k8s := kubetest.NewFakeK8sClient(objs...)
	SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	tlsService.enabledAutoMtls = util.AsPtr(false)
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), []string{ns.Name}, conf.KubernetesConfig.ClusterName)

	assert.NoError(err)
	assert.Equal(MTLSNotEnabled, status.Status)
}

func TestMeshStatusDisabled(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	pa := fakeMeshPeerAuthenticationWithMtlsMode("default", "DISABLE")
	dr := []*networking_v1beta1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("istio-system", "default", "*.local")),
	}
	objs := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "test"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "default"}},
	}
	objs = append(objs, kubernetes.ToRuntimeObjects(pa)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(dr)...)

	k8s := kubetest.NewFakeK8sClient(objs...)
	SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	tlsService.enabledAutoMtls = util.AsPtr(false)
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), []string{"test"}, conf.KubernetesConfig.ClusterName)

	assert.NoError(err)
	assert.Equal(MTLSDisabled, status.Status)
}

func TestMeshStatusNotEnabledAutoMtls(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	ns := &core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "test"}}
	k8s := kubetest.NewFakeK8sClient(ns)
	SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	tlsService.enabledAutoMtls = util.AsPtr(true)
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), []string{ns.Name}, conf.KubernetesConfig.ClusterName)

	assert.NoError(err)
	assert.Equal(MTLSNotEnabled, status.Status)
}

func TestNamespaceHasMTLSEnabled(t *testing.T) {
	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []*networking_v1beta1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSEnabled, []*networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPeerAuthnDisabled(t *testing.T) {
	ps := fakePeerAuthnWithMtlsMode("default", "bookinfo", "DISABLE")
	drs := []*networking_v1beta1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSDisabled, []*networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasDestinationRuleDisabled(t *testing.T) {
	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []*networking_v1beta1.DestinationRule{
		data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSEnabled, []*networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasNoDestinationRulesNoPolicy(t *testing.T) {
	var drs []*networking_v1beta1.DestinationRule
	var ps []*security_v1beta1.PeerAuthentication

	testNamespaceScenario(MTLSNotEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSNotEnabled, drs, ps, false, t)

	ps = fakePeerAuthnWithSelector("default", "bookinfo", "productpage")
	drs = []*networking_v1beta1.DestinationRule{
		data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	testNamespaceScenario(MTLSNotEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSNotEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSNotEnabled, []*networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPermissivePeerAuthDisableDestRule(t *testing.T) {
	ps := fakePermissivePeerAuthn("default", "bookinfo")
	drs := []*networking_v1beta1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSPartiallyEnabled, []*networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPermissivePeerAuthStrictDestRule(t *testing.T) {
	ps := fakePermissivePeerAuthn("default", "bookinfo")
	drs := []*networking_v1beta1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "strict-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSPartiallyEnabled, []*networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasMTLSDisabled(t *testing.T) {
	ps := fakePeerAuthnWithMtlsMode("default", "bookinfo", "DISABLE")
	drs := []*networking_v1beta1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSDisabled, drs, ps, false, t)
	testNamespaceScenario(MTLSDisabled, drs, ps, true, t)
	testNamespaceScenario(MTLSDisabled, []*networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPeerAuthnDisabledMtlsDestRule(t *testing.T) {
	ps := fakePeerAuthnWithMtlsMode("default", "bookinfo", "DISABLE")
	drs := []*networking_v1beta1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSDisabled, []*networking_v1beta1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasDestinationRuleEnabledDifferentNs(t *testing.T) {
	assert := assert.New(t)

	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []*networking_v1beta1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("foo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}

	var objs []runtime.Object
	objs = append(objs, kubernetes.ToRuntimeObjects(ps)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(drs)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(fakeProjects())...)
	k8s := kubetest.NewFakeK8sClient(objs...)
	k8s.OpenShift = true
	conf := config.NewConfig()
	conf.Deployment.AccessibleNamespaces = []string{"**"}
	kubernetes.SetConfig(t, *conf)
	SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	tlsService.enabledAutoMtls = util.AsPtr(false)
	status, err := tlsService.NamespaceWidemTLSStatus(context.TODO(), "bookinfo", conf.KubernetesConfig.ClusterName)

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)

	statuses, err := tlsService.ClusterWideNSmTLSStatus(context.TODO(), []string{"bookinfo"}, conf.KubernetesConfig.ClusterName)
	assert.NoError(err)
	assert.NotEmpty(statuses)
	for _, status := range statuses {
		assert.Equal(MTLSEnabled, status.Status)
	}
}

func testNamespaceScenario(exStatus string, drs []*networking_v1beta1.DestinationRule, ps []*security_v1beta1.PeerAuthentication, autoMtls bool, t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	var objs []runtime.Object
	objs = append(objs, kubernetes.ToRuntimeObjects(ps)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(drs)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(fakeProjects())...)
	k8s := kubetest.NewFakeK8sClient(objs...)
	k8s.OpenShift = true
	SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	tlsService.enabledAutoMtls = &autoMtls
	status, err := tlsService.NamespaceWidemTLSStatus(context.TODO(), "bookinfo", conf.KubernetesConfig.ClusterName)

	assert.NoError(err)
	assert.Equal(exStatus, status.Status)

	statuses, err := tlsService.ClusterWideNSmTLSStatus(context.TODO(), []string{"bookinfo"}, conf.KubernetesConfig.ClusterName)
	assert.NoError(err)
	assert.NotEmpty(statuses)
	for _, status := range statuses {
		assert.Equal(exStatus, status.Status)
	}
}

func fakeProjects() []*osproject_v1.Project {
	return []*osproject_v1.Project{
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

func fakeStrictPeerAuthn(name, namespace string) []*security_v1beta1.PeerAuthentication {
	return fakePeerAuthnWithMtlsMode(name, namespace, "STRICT")
}

func fakePeerAuthnWithSelector(name, namespace, target string) []*security_v1beta1.PeerAuthentication {
	return []*security_v1beta1.PeerAuthentication{data.CreateEmptyPeerAuthenticationWithSelector(name, namespace, data.CreateOneLabelSelector(target))}
}

func fakePermissivePeerAuthn(name, namespace string) []*security_v1beta1.PeerAuthentication {
	return fakePeerAuthnWithMtlsMode(name, namespace, "PERMISSIVE")
}

func fakePeerAuthnWithMtlsMode(name, namespace, mTLSmode string) []*security_v1beta1.PeerAuthentication {
	return fakePeerAuthn(name, namespace, data.CreateMTLS(mTLSmode))
}

func fakePeerAuthn(name, namespace string, peers *api_security_v1beta1.PeerAuthentication_MutualTLS) []*security_v1beta1.PeerAuthentication {
	return []*security_v1beta1.PeerAuthentication{data.CreateEmptyPeerAuthentication(name, namespace, peers)}
}

func fakeStrictMeshPeerAuthentication(name string) []*security_v1beta1.PeerAuthentication {
	return fakeMeshPeerAuthenticationWithMtlsMode(name, "STRICT")
}

func fakeMeshPeerAuthenticationWithMtlsMode(name, mTLSmode string) []*security_v1beta1.PeerAuthentication {
	mtls := &api_security_v1beta1.PeerAuthentication_MutualTLS{
		Mode: api_security_v1beta1.PeerAuthentication_MutualTLS_Mode(api_security_v1beta1.PeerAuthentication_MutualTLS_Mode_value[mTLSmode]),
	}
	return fakeMeshPeerAuthentication(name, mtls)
}

func fakeMeshPeerAuthentication(name string, mtls *api_security_v1beta1.PeerAuthentication_MutualTLS) []*security_v1beta1.PeerAuthentication {
	return []*security_v1beta1.PeerAuthentication{data.CreateEmptyMeshPeerAuthentication(name, mtls)}
}
