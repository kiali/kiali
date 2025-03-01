package business

import (
	"context"
	"testing"

	osproject_v1 "github.com/openshift/api/project/v1"
	"github.com/stretchr/testify/assert"
	api_security_v1 "istio.io/api/security/v1"
	api_security_v1beta1 "istio.io/api/security/v1beta1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/util"
)

var injectionEnabledLabel = map[string]string{IstioInjectionLabel: "enabled"}

func TestMeshStatusEnabled(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	conf.IstioNamespace = "istio-system"
	kubernetes.SetConfig(t, *conf)

	pa := fakeStrictMeshPeerAuthentication("default")
	dr := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("test", "default", "*.local")),
	}
	objs := []runtime.Object{
		kubetest.FakeNamespaceWithLabels("test", injectionEnabledLabel),
		kubetest.FakeNamespace("istio-system"),
		kubetest.FakeNamespaceWithLabels("default", injectionEnabledLabel),
	}
	objs = append(objs, kubernetes.ToRuntimeObjects(pa)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(dr)...)

	k8s := kubetest.NewFakeK8sClient(objs...)
	SetupBusinessLayer(t, k8s, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				IstiodNamespace: conf.IstioNamespace,
				Revision:        "default",
				Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				Config: models.ControlPlaneConfiguration{
					IstioMeshConfig: models.IstioMeshConfig{
						EnableAutoMtls: util.AsPtr(false),
					},
				},
			}},
		},
	}
	WithDiscovery(discovery)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), conf.KubernetesConfig.ClusterName, "default")

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func TestMeshStatusEnabledAutoMtls(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	pa := fakeStrictMeshPeerAuthentication("default")
	dr := []*networking_v1.DestinationRule{}

	objs := []runtime.Object{
		kubetest.FakeNamespaceWithLabels("test", injectionEnabledLabel),
		kubetest.FakeNamespace("istio-system"),
		kubetest.FakeNamespaceWithLabels("default", injectionEnabledLabel),
	}
	objs = append(objs, kubernetes.ToRuntimeObjects(pa)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(dr)...)

	k8s := kubetest.NewFakeK8sClient(objs...)
	SetupBusinessLayer(t, k8s, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				IstiodNamespace: conf.IstioNamespace,
				Revision:        "default",
				Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				Config: models.ControlPlaneConfiguration{
					IstioMeshConfig: models.IstioMeshConfig{
						EnableAutoMtls: util.AsPtr(true),
					},
				},
			}},
		},
	}
	WithDiscovery(discovery)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), conf.KubernetesConfig.ClusterName, "default")

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)
}

func TestMeshStatusPartiallyEnabled(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	pa := fakeStrictMeshPeerAuthentication("default")
	dr := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("istio-system", "default", "sleep.foo.svc.cluster.local")),
	}

	objs := []runtime.Object{
		kubetest.FakeNamespaceWithLabels("test", injectionEnabledLabel),
		kubetest.FakeNamespace("istio-system"),
		kubetest.FakeNamespaceWithLabels("default", injectionEnabledLabel),
	}
	objs = append(objs, kubernetes.ToRuntimeObjects(pa)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(dr)...)

	k8s := kubetest.NewFakeK8sClient(objs...)
	SetupBusinessLayer(t, k8s, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				IstiodNamespace: conf.IstioNamespace,
				Revision:        "default",
				Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				Config: models.ControlPlaneConfiguration{
					IstioMeshConfig: models.IstioMeshConfig{
						EnableAutoMtls: util.AsPtr(false),
					},
				},
			}},
		},
	}
	WithDiscovery(discovery)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), conf.KubernetesConfig.ClusterName, "default")

	assert.NoError(err)
	assert.Equal(MTLSPartiallyEnabled, status.Status)
}

func TestMeshStatusNotEnabled(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	ns := kubetest.FakeNamespaceWithLabels("test", injectionEnabledLabel)
	pa := []*security_v1.PeerAuthentication{}
	dr := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("istio-system", "default", "sleep.foo.svc.cluster.local")),
	}
	objs := []runtime.Object{ns}
	objs = append(objs, kubernetes.ToRuntimeObjects(pa)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(dr)...)

	k8s := kubetest.NewFakeK8sClient(objs...)
	SetupBusinessLayer(t, k8s, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				IstiodNamespace: conf.IstioNamespace,
				Revision:        "default",
				Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				Config: models.ControlPlaneConfiguration{
					IstioMeshConfig: models.IstioMeshConfig{
						EnableAutoMtls: util.AsPtr(false),
					},
				},
			}},
		},
	}
	WithDiscovery(discovery)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), conf.KubernetesConfig.ClusterName, "default")

	assert.NoError(err)
	assert.Equal(MTLSNotEnabled, status.Status)
}

func TestMeshStatusDisabled(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	pa := fakeMeshPeerAuthenticationWithMtlsMode("default", "DISABLE")
	dr := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("istio-system", "default", "*.local")),
	}
	objs := []runtime.Object{
		kubetest.FakeNamespaceWithLabels("test", injectionEnabledLabel),
		kubetest.FakeNamespace("istio-system"),
		kubetest.FakeNamespaceWithLabels("default", injectionEnabledLabel),
	}
	objs = append(objs, kubernetes.ToRuntimeObjects(pa)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(dr)...)

	k8s := kubetest.NewFakeK8sClient(objs...)
	SetupBusinessLayer(t, k8s, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				IstiodNamespace: conf.IstioNamespace,
				Revision:        "default",
				Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				Config: models.ControlPlaneConfiguration{
					IstioMeshConfig: models.IstioMeshConfig{
						EnableAutoMtls: util.AsPtr(false),
					},
				},
			}},
		},
	}
	WithDiscovery(discovery)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), conf.KubernetesConfig.ClusterName, "default")

	assert.NoError(err)
	assert.Equal(MTLSDisabled, status.Status)
}

func TestMeshStatusNotEnabledAutoMtls(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	ns := kubetest.FakeNamespaceWithLabels("test", injectionEnabledLabel)
	k8s := kubetest.NewFakeK8sClient(ns)
	SetupBusinessLayer(t, k8s, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				IstiodNamespace: conf.IstioNamespace,
				Revision:        "default",
				Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				Config: models.ControlPlaneConfiguration{
					IstioMeshConfig: models.IstioMeshConfig{
						EnableAutoMtls: util.AsPtr(true),
					},
				},
			}},
		},
	}
	WithDiscovery(discovery)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	status, err := tlsService.MeshWidemTLSStatus(context.TODO(), conf.KubernetesConfig.ClusterName, "default")

	assert.NoError(err)
	assert.Equal(MTLSNotEnabled, status.Status)
}

func TestNamespaceHasMTLSEnabled(t *testing.T) {
	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSEnabled, []*networking_v1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPeerAuthnDisabled(t *testing.T) {
	ps := fakePeerAuthnWithMtlsMode("default", "bookinfo", "DISABLE")
	drs := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "allow-mtls", "*.bookinfo.svc.cluster.local")),
	}
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSDisabled, []*networking_v1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasDestinationRuleDisabled(t *testing.T) {
	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []*networking_v1.DestinationRule{
		data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSEnabled, []*networking_v1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasNoDestinationRulesNoPolicy(t *testing.T) {
	var drs []*networking_v1.DestinationRule
	var ps []*security_v1.PeerAuthentication

	testNamespaceScenario(MTLSNotEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSNotEnabled, drs, ps, false, t)

	ps = fakePeerAuthnWithSelector("default", "bookinfo", "productpage")
	drs = []*networking_v1.DestinationRule{
		data.CreateEmptyDestinationRule("bookinfo", "dr-1", "*.bookinfo.svc.cluster.local"),
	}

	testNamespaceScenario(MTLSNotEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSNotEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSNotEnabled, []*networking_v1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPermissivePeerAuthDisableDestRule(t *testing.T) {
	ps := fakePermissivePeerAuthn("default", "bookinfo")
	drs := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSPartiallyEnabled, []*networking_v1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPermissivePeerAuthStrictDestRule(t *testing.T) {
	ps := fakePermissivePeerAuthn("default", "bookinfo")
	drs := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "strict-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSPartiallyEnabled, []*networking_v1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasMTLSDisabled(t *testing.T) {
	ps := fakePeerAuthnWithMtlsMode("default", "bookinfo", "DISABLE")
	drs := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateDisabledMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSDisabled, drs, ps, false, t)
	testNamespaceScenario(MTLSDisabled, drs, ps, true, t)
	testNamespaceScenario(MTLSDisabled, []*networking_v1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasPeerAuthnDisabledMtlsDestRule(t *testing.T) {
	ps := fakePeerAuthnWithMtlsMode("default", "bookinfo", "DISABLE")
	drs := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateEmptyDestinationRule("bookinfo", "disable-mtls", "*.bookinfo.svc.cluster.local")),
	}

	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, false, t)
	testNamespaceScenario(MTLSPartiallyEnabled, drs, ps, true, t)
	testNamespaceScenario(MTLSDisabled, []*networking_v1.DestinationRule{}, ps, true, t)
}

func TestNamespaceHasDestinationRuleEnabledDifferentNs(t *testing.T) {
	assert := assert.New(t)

	ps := fakeStrictPeerAuthn("default", "bookinfo")
	drs := []*networking_v1.DestinationRule{
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
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)
	SetupBusinessLayer(t, k8s, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				IstiodNamespace: conf.IstioNamespace,
				Revision:        "default",
				Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				Config: models.ControlPlaneConfiguration{
					IstioMeshConfig: models.IstioMeshConfig{
						EnableAutoMtls: util.AsPtr(false),
					},
				},
			}},
		},
	}
	WithDiscovery(discovery)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	status, err := tlsService.NamespaceWidemTLSStatus(context.TODO(), "bookinfo", conf.KubernetesConfig.ClusterName)

	assert.NoError(err)
	assert.Equal(MTLSEnabled, status.Status)

	statuses, err := tlsService.ClusterWideNSmTLSStatus(context.TODO(), []models.Namespace{{Name: "bookinfo", Labels: injectionEnabledLabel}}, conf.KubernetesConfig.ClusterName)
	assert.NoError(err)
	assert.NotEmpty(statuses)
	for _, status := range statuses {
		assert.Equal(MTLSEnabled, status.Status)
	}
}

func testNamespaceScenario(exStatus string, drs []*networking_v1.DestinationRule, ps []*security_v1.PeerAuthentication, autoMtls bool, t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	objs := []runtime.Object{
		kubetest.FakeNamespaceWithLabels("bookinfo", injectionEnabledLabel),
		kubetest.FakeNamespaceWithLabels("foo", injectionEnabledLabel),
	}
	objs = append(objs, kubernetes.ToRuntimeObjects(ps)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(drs)...)
	objs = append(objs, kubernetes.ToRuntimeObjects(fakeProjects())...)
	k8s := kubetest.NewFakeK8sClient(objs...)
	k8s.OpenShift = true

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	SetupBusinessLayer(t, k8s, *conf)
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				IstiodNamespace: conf.IstioNamespace,
				Revision:        "default",
				Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				Config: models.ControlPlaneConfiguration{
					IstioMeshConfig: models.IstioMeshConfig{
						EnableAutoMtls: &autoMtls,
					},
				},
			}},
		},
	}
	WithDiscovery(discovery)

	tlsService := NewWithBackends(k8sclients, k8sclients, nil, nil).TLS
	status, err := tlsService.NamespaceWidemTLSStatus(context.TODO(), "bookinfo", conf.KubernetesConfig.ClusterName)

	assert.NoError(err)
	assert.Equal(exStatus, status.Status)

	statuses, err := tlsService.ClusterWideNSmTLSStatus(context.TODO(), []models.Namespace{{Name: "bookinfo", Labels: injectionEnabledLabel}}, conf.KubernetesConfig.ClusterName)
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
				Name:   "bookinfo",
				Labels: injectionEnabledLabel,
			},
		},
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:   "foo",
				Labels: injectionEnabledLabel,
			},
		},
	}
}

func fakeStrictPeerAuthn(name, namespace string) []*security_v1.PeerAuthentication {
	return fakePeerAuthnWithMtlsMode(name, namespace, "STRICT")
}

func fakePeerAuthnWithSelector(name, namespace, target string) []*security_v1.PeerAuthentication {
	return []*security_v1.PeerAuthentication{data.CreateEmptyPeerAuthenticationWithSelector(name, namespace, data.CreateOneLabelSelector(target))}
}

func fakePermissivePeerAuthn(name, namespace string) []*security_v1.PeerAuthentication {
	return fakePeerAuthnWithMtlsMode(name, namespace, "PERMISSIVE")
}

func fakePeerAuthnWithMtlsMode(name, namespace, mTLSmode string) []*security_v1.PeerAuthentication {
	return fakePeerAuthn(name, namespace, data.CreateMTLS(mTLSmode))
}

func fakePeerAuthn(name, namespace string, peers *api_security_v1.PeerAuthentication_MutualTLS) []*security_v1.PeerAuthentication {
	return []*security_v1.PeerAuthentication{data.CreateEmptyPeerAuthentication(name, namespace, peers)}
}

func fakeStrictMeshPeerAuthentication(name string) []*security_v1.PeerAuthentication {
	return fakeMeshPeerAuthenticationWithMtlsMode(name, "STRICT")
}

func fakeMeshPeerAuthenticationWithMtlsMode(name, mTLSmode string) []*security_v1.PeerAuthentication {
	mtls := &api_security_v1.PeerAuthentication_MutualTLS{
		Mode: api_security_v1.PeerAuthentication_MutualTLS_Mode(api_security_v1beta1.PeerAuthentication_MutualTLS_Mode_value[mTLSmode]),
	}
	return fakeMeshPeerAuthentication(name, mtls)
}

func fakeMeshPeerAuthentication(name string, mtls *api_security_v1.PeerAuthentication_MutualTLS) []*security_v1.PeerAuthentication {
	return []*security_v1.PeerAuthentication{data.CreateEmptyMeshPeerAuthentication(name, mtls)}
}
