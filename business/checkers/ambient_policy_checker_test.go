package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	extensions_v1alpha1_api "istio.io/api/extensions/v1alpha1"
	networking_v1_api "istio.io/api/networking/v1"
	security_v1_api "istio.io/api/security/v1"
	telemetry_v1_api "istio.io/api/telemetry/v1"
	api_v1beta1 "istio.io/api/type/v1beta1"
	extensions_v1alpha1 "istio.io/client-go/pkg/apis/extensions/v1alpha1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	telemetry_v1 "istio.io/client-go/pkg/apis/telemetry/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestAmbientPolicyChecker_L7AuthPolicyWithoutEnrollment(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	ap := data.CreateAuthorizationPolicy([]string{"bookinfo"}, []string{"GET"}, []string{"reviews"}, map[string]string{"app": "reviews"})
	ap.Namespace = ns

	vals := AmbientPolicyChecker{
		AuthorizationPolicies: []*security_v1.AuthorizationPolicy{ap},
		Cluster:               cluster,
		IdentityDomain:        conf.ExternalServices.Istio.IstioIdentityDomain,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true, Labels: map[string]string{}},
		},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.AuthorizationPolicies, ap.Name, ns, cluster)
	validation, ok := vals[key]
	require.True(t, ok)
	require.Len(t, validation.Checks, 2)
	assert.False(t, validation.Valid)
	assert.NoError(t, validations.ConfirmIstioCheckMessage("authorizationpolicy.ambient.l7notargetrefs", validation.Checks[0]))
	assert.NoError(t, validations.ConfirmIstioCheckMessage("authorizationpolicy.ambient.l7nowaypoint", validation.Checks[1]))
}

func TestAmbientPolicyChecker_L7WithNamespaceEnrollment_SelectorWarnsMissingTargetRefs(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	ap := data.CreateAuthorizationPolicy([]string{"bookinfo"}, []string{"GET"}, []string{"reviews"}, map[string]string{"app": "reviews"})
	ap.Namespace = ns

	vals := AmbientPolicyChecker{
		AuthorizationPolicies: []*security_v1.AuthorizationPolicy{ap},
		Cluster:               cluster,
		IdentityDomain:        conf.ExternalServices.Istio.IstioIdentityDomain,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true, Labels: map[string]string{
				config.WaypointUseLabel: "waypoint",
			}},
		},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.AuthorizationPolicies, ap.Name, ns, cluster)
	validation, ok := vals[key]
	require.True(t, ok, "selector-based L7 AuthPolicy must warn even when enrolled")
	require.Len(t, validation.Checks, 1)
	assert.NoError(t, validations.ConfirmIstioCheckMessage("authorizationpolicy.ambient.l7notargetrefs", validation.Checks[0]))
}

func TestAmbientPolicyChecker_L7WithTargetRefsAndEnrollment_NoWarning(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	ap := data.CreateAuthorizationPolicyWithTargetRefs("reviews-l7-deny-get", ns, "reviews", []string{"GET"})

	vals := AmbientPolicyChecker{
		AuthorizationPolicies: []*security_v1.AuthorizationPolicy{ap},
		Cluster:               cluster,
		IdentityDomain:        conf.ExternalServices.Istio.IstioIdentityDomain,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true, Labels: map[string]string{
				config.WaypointUseLabel: "waypoint",
			}},
		},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	assert.Empty(t, vals)
}

func TestAmbientPolicyChecker_L4AuthPolicy_NoWarning(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	ap := data.CreateAuthorizationPolicyWithPrincipals("l4-ap", ns, []string{"cluster.local/ns/default/sa/app"})

	vals := AmbientPolicyChecker{
		AuthorizationPolicies: []*security_v1.AuthorizationPolicy{ap},
		Cluster:               cluster,
		IdentityDomain:        conf.ExternalServices.Istio.IstioIdentityDomain,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true},
		},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "app", map[string]string{})},
		},
	}.Check()

	assert.Empty(t, vals)
}

func TestAmbientPolicyChecker_VirtualServiceServiceNotCaptured(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"
	identityDomain := conf.ExternalServices.Istio.IstioIdentityDomain

	vs := &networking_v1.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: ns},
		Spec: networking_v1_api.VirtualService{
			Hosts: []string{"reviews"},
			Http:  []*networking_v1_api.HTTPRoute{{Name: "route"}},
		},
	}

	// Namespace enrolled, but service opted out
	vals := AmbientPolicyChecker{
		Cluster:        cluster,
		IdentityDomain: identityDomain,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true, Labels: map[string]string{
				config.WaypointUseLabel: "waypoint",
			}},
		},
		Services: []core_v1.Service{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      "reviews",
					Namespace: ns,
					Labels:    map[string]string{config.WaypointUseLabel: config.WaypointNone},
				},
			},
		},
		VirtualServices: []*networking_v1.VirtualService{vs},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews", map[string]string{})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.VirtualServices, vs.Name, ns, cluster)
	validation, ok := vals[key]
	require.True(t, ok, "expected warning when service has use-waypoint:none despite ns enrollment")
	assert.NoError(t, validations.ConfirmIstioCheckMessage("virtualservice.ambient.servicenotcaptured", validation.Checks[0]))
	assert.Equal(t, "spec/hosts[0]", validation.Checks[0].Path)
}

func TestAmbientPolicyChecker_VirtualServiceServiceCaptured_NoWarning(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"
	identityDomain := conf.ExternalServices.Istio.IstioIdentityDomain

	vs := &networking_v1.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: ns},
		Spec: networking_v1_api.VirtualService{
			Hosts: []string{"reviews"},
			Http:  []*networking_v1_api.HTTPRoute{{Name: "route"}},
		},
	}

	vals := AmbientPolicyChecker{
		Cluster:        cluster,
		IdentityDomain: identityDomain,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true, Labels: map[string]string{}},
		},
		Services: []core_v1.Service{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      "reviews",
					Namespace: ns,
					Labels:    map[string]string{config.WaypointUseLabel: "reviews-waypoint"},
				},
			},
		},
		VirtualServices: []*networking_v1.VirtualService{vs},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews", map[string]string{})},
		},
	}.Check()

	assert.Empty(t, vals)
}

func TestAmbientPolicyChecker_VirtualServiceIngressOnly_NoWarning(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	vs := &networking_v1.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{Name: "ingress-vs", Namespace: ns},
		Spec: networking_v1_api.VirtualService{
			Gateways: []string{"my-ingress"},
			Hosts:    []string{"reviews"},
			Http:     []*networking_v1_api.HTTPRoute{{Name: "route"}},
		},
	}

	vals := AmbientPolicyChecker{
		Cluster:        cluster,
		IdentityDomain: conf.ExternalServices.Istio.IstioIdentityDomain,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true},
		},
		VirtualServices: []*networking_v1.VirtualService{vs},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews", map[string]string{})},
		},
	}.Check()

	assert.Empty(t, vals)
}

func TestAmbientPolicyChecker_RequestAuthenticationWithoutEnrollment(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	ra := &security_v1.RequestAuthentication{
		ObjectMeta: meta_v1.ObjectMeta{Name: "jwt", Namespace: ns},
		Spec:       security_v1_api.RequestAuthentication{},
	}

	vals := AmbientPolicyChecker{
		Cluster: cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true},
		},
		RequestAuthentications: []*security_v1.RequestAuthentication{ra},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "app", map[string]string{})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.RequestAuthentications, ra.Name, ns, cluster)
	validation, ok := vals[key]
	require.True(t, ok)
	require.Len(t, validation.Checks, 2)
	assert.NoError(t, validations.ConfirmIstioCheckMessage("requestauthentication.ambient.l7notargetrefs", validation.Checks[0]))
	assert.NoError(t, validations.ConfirmIstioCheckMessage("requestauthentication.ambient.l7nowaypoint", validation.Checks[1]))
}

func TestAmbientPolicyChecker_RequestAuthenticationWithTargetRefsAndEnrollment_NoWarning(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	ra := &security_v1.RequestAuthentication{
		ObjectMeta: meta_v1.ObjectMeta{Name: "jwt", Namespace: ns},
		Spec: security_v1_api.RequestAuthentication{
			TargetRefs: []*api_v1beta1.PolicyTargetReference{
				{Group: "", Kind: "Service", Name: "reviews"},
			},
			JwtRules: []*security_v1_api.JWTRule{
				{Issuer: "https://example.com"},
			},
		},
	}

	vals := AmbientPolicyChecker{
		Cluster: cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true, Labels: map[string]string{
				config.WaypointUseLabel: "waypoint",
			}},
		},
		RequestAuthentications: []*security_v1.RequestAuthentication{ra},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	assert.Empty(t, vals)
}

func TestAmbientPolicyChecker_NonAmbientNamespace_NoWarning(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "sidecar-ns"

	ap := data.CreateAuthorizationPolicy([]string{"bookinfo"}, []string{"GET"}, []string{"reviews"}, map[string]string{"app": "reviews"})
	ap.Namespace = ns

	vals := AmbientPolicyChecker{
		AuthorizationPolicies: []*security_v1.AuthorizationPolicy{ap},
		Cluster:               cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: false},
		},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews", map[string]string{})},
		},
	}.Check()

	assert.Empty(t, vals)
}

func TestAmbientPolicyChecker_VirtualServiceCrossNamespace_Warns(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	identityDomain := config.ResolveIdentityDomain(conf.ExternalServices.Istio.IstioIdentityDomain, "")
	ambientNS := "bookinfo"
	otherNS := "test"

	vs := &networking_v1.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-from-test", Namespace: otherNS},
		Spec: networking_v1_api.VirtualService{
			Hosts: []string{"reviews.bookinfo.svc.cluster.local"},
			Http:  []*networking_v1_api.HTTPRoute{{Name: "route"}},
		},
	}

	vals := AmbientPolicyChecker{
		Cluster:        cluster,
		IdentityDomain: identityDomain,
		Namespaces: models.Namespaces{
			{Name: ambientNS, Cluster: cluster, IsAmbient: true, Labels: map[string]string{
				config.WaypointUseLabel: "waypoint",
			}},
			{Name: otherNS, Cluster: cluster, IsAmbient: false},
		},
		Services: []core_v1.Service{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      "reviews",
					Namespace: ambientNS,
					Labels:    map[string]string{config.WaypointUseLabel: "waypoint"},
				},
			},
		},
		VirtualServices: []*networking_v1.VirtualService{vs},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ambientNS: {data.CreateWorkload(ambientNS, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.VirtualServices, vs.Name, otherNS, cluster)
	validation, ok := vals[key]
	require.True(t, ok, "L7 VS in another namespace targeting Ambient service must warn")
	require.NotEmpty(t, validation.Checks)
	assert.NoError(t, validations.ConfirmIstioCheckMessage("virtualservice.ambient.notinservicenamespace", validation.Checks[0]))
	assert.Equal(t, "spec/hosts[0]", validation.Checks[0].Path)
}

func TestAmbientPolicyChecker_DestinationRuleCrossNamespace_Warns(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	identityDomain := config.ResolveIdentityDomain(conf.ExternalServices.Istio.IstioIdentityDomain, "")
	ambientNS := "bookinfo"
	otherNS := "test"

	dr := &networking_v1.DestinationRule{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-from-test", Namespace: otherNS},
		Spec: networking_v1_api.DestinationRule{
			Host: "reviews.bookinfo.svc.cluster.local",
			TrafficPolicy: &networking_v1_api.TrafficPolicy{
				ConnectionPool: &networking_v1_api.ConnectionPoolSettings{
					Http: &networking_v1_api.ConnectionPoolSettings_HTTPSettings{Http1MaxPendingRequests: 1024},
				},
			},
		},
	}

	vals := AmbientPolicyChecker{
		Cluster:          cluster,
		IdentityDomain:   identityDomain,
		DestinationRules: []*networking_v1.DestinationRule{dr},
		Namespaces: models.Namespaces{
			{Name: ambientNS, Cluster: cluster, IsAmbient: true, Labels: map[string]string{
				config.WaypointUseLabel: "waypoint",
			}},
			{Name: otherNS, Cluster: cluster, IsAmbient: false},
		},
		Services: []core_v1.Service{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:      "reviews",
					Namespace: ambientNS,
				},
			},
		},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ambientNS: {data.CreateWorkload(ambientNS, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.DestinationRules, dr.Name, otherNS, cluster)
	validation, ok := vals[key]
	require.True(t, ok)
	codes := map[string]bool{}
	for _, check := range validation.Checks {
		codes[check.Code] = true
	}
	assert.True(t, codes["KIA0212"], "expected notinservicenamespace warning, got %#v", validation.Checks)
	assert.False(t, codes["KIA0211"], "namespace enrollment covers the service; only cross-ns warning expected")
	assert.Equal(t, "spec/host", validation.Checks[0].Path)
}

func TestAmbientPolicyChecker_VirtualServiceDestinationNotAmbient_NoWarning(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	identityDomain := config.ResolveIdentityDomain(conf.ExternalServices.Istio.IstioIdentityDomain, "")
	sidecarNS := "bookinfo"
	otherNS := "test"

	vs := &networking_v1.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-from-test", Namespace: otherNS},
		Spec: networking_v1_api.VirtualService{
			Hosts: []string{"reviews.bookinfo.svc.cluster.local"},
			Http:  []*networking_v1_api.HTTPRoute{{Name: "route"}},
		},
	}

	vals := AmbientPolicyChecker{
		Cluster:        cluster,
		IdentityDomain: identityDomain,
		Namespaces: models.Namespaces{
			{Name: sidecarNS, Cluster: cluster, IsAmbient: false},
			{Name: otherNS, Cluster: cluster, IsAmbient: false},
		},
		Services: []core_v1.Service{
			{ObjectMeta: meta_v1.ObjectMeta{Name: "reviews", Namespace: sidecarNS}},
		},
		VirtualServices: []*networking_v1.VirtualService{vs},
	}.Check()

	assert.Empty(t, vals, "no Ambient destination → no Ambient waypoint warning")
}

func TestAmbientPolicyChecker_WaypointWorkloadWithoutEnrollment_StillWarns(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	// Waypoint deployed but namespace NOT enrolled — L7 still ineffective
	ap := data.CreateAuthorizationPolicy([]string{"bookinfo"}, []string{"GET"}, []string{"reviews"}, map[string]string{"app": "reviews"})
	ap.Namespace = ns
	waypoint := data.CreateWorkload(ns, "waypoint", map[string]string{
		config.WaypointLabel: config.WaypointLabelValue,
	})

	vals := AmbientPolicyChecker{
		AuthorizationPolicies: []*security_v1.AuthorizationPolicy{ap},
		Cluster:               cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true, Labels: map[string]string{}},
		},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {waypoint, data.CreateWorkload(ns, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.AuthorizationPolicies, ap.Name, ns, cluster)
	_, ok := vals[key]
	assert.True(t, ok, "deploying a waypoint without enrollment must still warn")
}

func TestAmbientPolicyChecker_WasmPluginWithoutEnrollment(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	wp := &extensions_v1alpha1.WasmPlugin{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-wasm", Namespace: ns},
		Spec: extensions_v1alpha1_api.WasmPlugin{
			Selector: &api_v1beta1.WorkloadSelector{MatchLabels: map[string]string{"app": "reviews"}},
			Url:      "oci://invalid.example/wasm:latest",
		},
	}

	vals := AmbientPolicyChecker{
		Cluster: cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true},
		},
		WasmPlugins: []*extensions_v1alpha1.WasmPlugin{wp},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.WasmPlugins, wp.Name, ns, cluster)
	validation, ok := vals[key]
	require.True(t, ok)
	require.Len(t, validation.Checks, 2)
	assert.NoError(t, validations.ConfirmIstioCheckMessage("wasmplugin.ambient.l7notargetrefs", validation.Checks[0]))
	assert.NoError(t, validations.ConfirmIstioCheckMessage("wasmplugin.ambient.l7nowaypoint", validation.Checks[1]))
}

func TestAmbientPolicyChecker_WasmPluginMissingTargetRefs(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	wp := &extensions_v1alpha1.WasmPlugin{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-wasm", Namespace: ns},
		Spec: extensions_v1alpha1_api.WasmPlugin{
			Selector: &api_v1beta1.WorkloadSelector{MatchLabels: map[string]string{"app": "reviews"}},
			Url:      "oci://invalid.example/wasm:latest",
		},
	}

	vals := AmbientPolicyChecker{
		Cluster: cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true, Labels: map[string]string{
				config.WaypointUseLabel: "waypoint",
			}},
		},
		WasmPlugins: []*extensions_v1alpha1.WasmPlugin{wp},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.WasmPlugins, wp.Name, ns, cluster)
	validation, ok := vals[key]
	require.True(t, ok)
	require.Len(t, validation.Checks, 1)
	assert.False(t, validation.Valid)
	assert.NoError(t, validations.ConfirmIstioCheckMessage("wasmplugin.ambient.l7notargetrefs", validation.Checks[0]))
}

func TestAmbientPolicyChecker_WasmPluginWithEnrollment_NoWarning(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	wp := &extensions_v1alpha1.WasmPlugin{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-wasm", Namespace: ns},
		Spec: extensions_v1alpha1_api.WasmPlugin{
			TargetRefs: []*api_v1beta1.PolicyTargetReference{
				{Group: "", Kind: "Service", Name: "reviews"},
			},
			Url: "oci://invalid.example/wasm:latest",
		},
	}

	vals := AmbientPolicyChecker{
		Cluster: cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true, Labels: map[string]string{
				config.WaypointUseLabel: "waypoint",
			}},
		},
		WasmPlugins: []*extensions_v1alpha1.WasmPlugin{wp},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.WasmPlugins, wp.Name, ns, cluster)
	validation, ok := vals[key]
	require.True(t, ok)
	assert.True(t, validation.Valid)
	assert.Empty(t, validation.Checks)
}

func TestAmbientPolicyChecker_WasmPluginNonAmbient_NoValidation(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "sidecar-ns"

	wp := &extensions_v1alpha1.WasmPlugin{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-wasm", Namespace: ns},
		Spec: extensions_v1alpha1_api.WasmPlugin{
			Url: "oci://invalid.example/wasm:latest",
		},
	}

	vals := AmbientPolicyChecker{
		Cluster: cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: false},
		},
		WasmPlugins: []*extensions_v1alpha1.WasmPlugin{wp},
	}.Check()

	assert.Empty(t, vals)
}

func TestAmbientPolicyChecker_TelemetryL7WithoutEnrollment(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	tel := &telemetry_v1.Telemetry{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-tracing", Namespace: ns},
		Spec: telemetry_v1_api.Telemetry{
			Tracing: []*telemetry_v1_api.Tracing{{}},
		},
	}

	vals := AmbientPolicyChecker{
		Cluster: cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true},
		},
		Telemetries: []*telemetry_v1.Telemetry{tel},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.Telemetries, tel.Name, ns, cluster)
	validation, ok := vals[key]
	require.True(t, ok)
	require.Len(t, validation.Checks, 2)
	assert.NoError(t, validations.ConfirmIstioCheckMessage("telemetry.ambient.l7notargetrefs", validation.Checks[0]))
	assert.NoError(t, validations.ConfirmIstioCheckMessage("telemetry.ambient.l7nowaypoint", validation.Checks[1]))
}

func TestAmbientPolicyChecker_TelemetryL7WithEnrollment_NoWarning(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	tel := &telemetry_v1.Telemetry{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-tracing", Namespace: ns},
		Spec: telemetry_v1_api.Telemetry{
			TargetRefs: []*api_v1beta1.PolicyTargetReference{
				{Group: "", Kind: "Service", Name: "reviews"},
			},
			Tracing: []*telemetry_v1_api.Tracing{{}},
		},
	}

	vals := AmbientPolicyChecker{
		Cluster: cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true, Labels: map[string]string{
				config.WaypointUseLabel: "waypoint",
			}},
		},
		Telemetries: []*telemetry_v1.Telemetry{tel},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.Telemetries, tel.Name, ns, cluster)
	validation, ok := vals[key]
	require.True(t, ok)
	assert.True(t, validation.Valid)
	assert.Empty(t, validation.Checks)
}

func TestAmbientPolicyChecker_TelemetryL4_NoWarning(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "ambient-ns"

	tel := &telemetry_v1.Telemetry{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-tcp-metrics", Namespace: ns},
		Spec: telemetry_v1_api.Telemetry{
			Metrics: []*telemetry_v1_api.Metrics{{}},
		},
	}

	vals := AmbientPolicyChecker{
		Cluster: cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true},
		},
		Telemetries: []*telemetry_v1.Telemetry{tel},
		WorkloadsPerNamespace: map[string]models.Workloads{
			ns: {data.CreateWorkload(ns, "reviews-v1", map[string]string{"app": "reviews"})},
		},
	}.Check()

	key := models.BuildKey(kubernetes.Telemetries, tel.Name, ns, cluster)
	validation, ok := vals[key]
	require.True(t, ok)
	assert.True(t, validation.Valid)
	assert.Empty(t, validation.Checks)
}

func TestAmbientPolicyChecker_TelemetryNonAmbient_NoValidation(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "sidecar-ns"

	tel := &telemetry_v1.Telemetry{
		ObjectMeta: meta_v1.ObjectMeta{Name: "reviews-tracing", Namespace: ns},
		Spec: telemetry_v1_api.Telemetry{
			Tracing: []*telemetry_v1_api.Tracing{{}},
		},
	}

	vals := AmbientPolicyChecker{
		Cluster: cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: false},
		},
		Telemetries: []*telemetry_v1.Telemetry{tel},
	}.Check()

	assert.Empty(t, vals)
}

func TestAmbientPolicyChecker_TelemetryInControlPlane_NoValidation(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	ns := "istio-system"

	// Mesh-wide Telemetry in the root namespace is expected without targetRefs / enrollment.
	// Kiali marks control plane namespaces IsAmbient when Ambient is cluster-enabled.
	tel := &telemetry_v1.Telemetry{
		ObjectMeta: meta_v1.ObjectMeta{Name: "otel-tracing", Namespace: ns},
		Spec: telemetry_v1_api.Telemetry{
			Tracing: []*telemetry_v1_api.Tracing{{}},
		},
	}

	vals := AmbientPolicyChecker{
		Cluster: cluster,
		Namespaces: models.Namespaces{
			{Name: ns, Cluster: cluster, IsAmbient: true, IsControlPlane: true},
		},
		Telemetries: []*telemetry_v1.Telemetry{tel},
	}.Check()

	assert.Empty(t, vals)
}
