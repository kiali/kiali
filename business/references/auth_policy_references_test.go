package references

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func prepareTestForAuthPolicy(ap *security_v1.AuthorizationPolicy, vs *networking_v1.VirtualService, se *networking_v1.ServiceEntry) models.IstioReferences {
	conf := config.Get()
	services := data.CreateFakeServicesWithSelector("foo-dev", "istio-system")
	rootNamespaces := map[string]string{
		config.IstioNamespaceDefault: config.IstioNamespaceDefault,
		"bookinfo":                   config.IstioNamespaceDefault,
		"bookinfo2":                  config.IstioNamespaceDefault,
		"bookinfo3":                  config.IstioNamespaceDefault,
	}
	drReferences := NewAuthorizationPolicyReferences(
		[]*security_v1.AuthorizationPolicy{ap},
		conf,
		config.ResolveIdentityDomain(conf.ExternalServices.Istio.IstioIdentityDomain, ""),
		config.DefaultClusterID,
		rootNamespaces,
		"bookinfo",
		[]string{"bookinfo", "bookinfo2", "bookinfo3"},
		[]*networking_v1.ServiceEntry{se},
		[]*networking_v1.VirtualService{vs},
		kubernetes.KubeServiceFQDNs(services, config.ResolveIdentityDomain(conf.ExternalServices.Istio.IstioIdentityDomain, "")),
		map[string]models.Workloads{
			"istio-system": {
				data.CreateWorkload("istio-system", "istiod", map[string]string{"app": "istio-ingressgateway"}),
			}},
	)
	return *drReferences.References()[models.IstioReferenceKey{ObjectGVK: kubernetes.AuthorizationPolicies, Namespace: ap.Namespace, Name: ap.Name}]
}

func TestAuthPolicyReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForAuthPolicy(getAuthPolicy(t), getAPVirtualService(t), getAPServiceEntry(t))
	assert.Empty(references.ServiceReferences)

	// Check Workload references
	assert.Len(references.WorkloadReferences, 1)
	assert.Equal(references.WorkloadReferences[0].Name, "istiod")
	assert.Equal(references.WorkloadReferences[0].Namespace, "istio-system")

	// Check VS and SE references
	assert.Len(references.ObjectReferences, 2)
	assert.Equal(references.ObjectReferences[0].Name, "foo-dev")
	assert.Equal(references.ObjectReferences[0].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.VirtualServices.String())

	assert.Equal(references.ObjectReferences[1].Name, "foo-dev")
	assert.Equal(references.ObjectReferences[1].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[1].ObjectGVK.String(), kubernetes.ServiceEntries.String())
}

func TestAuthPolicyServiceReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForAuthPolicy(getAuthPolicy(t), fakeVirtualService(t), fakeServiceEntry())
	assert.Empty(references.ObjectReferences)

	// Check Service references
	assert.Len(references.ServiceReferences, 1)
	assert.Equal(references.ServiceReferences[0].Name, "foo-dev")
	assert.Equal(references.ServiceReferences[0].Namespace, "istio-system")

	// Check Workload references
	assert.Len(references.WorkloadReferences, 1)
	assert.Equal(references.WorkloadReferences[0].Name, "istiod")
	assert.Equal(references.WorkloadReferences[0].Namespace, "istio-system")
}

func TestAuthPolicyNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForAuthPolicy(data.CreateEmptyAuthorizationPolicy("foo-dev", "istio-system"), getAPVirtualService(t), getAPServiceEntry(t))
	assert.Empty(references.ServiceReferences)
	assert.Empty(references.WorkloadReferences)
	assert.Empty(references.ObjectReferences)
}

func TestAuthPolicyWorkloadReferencesMultiCP(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Mesh-wide AP in CP1's root namespace with a selector
	ap := data.CreateAuthorizationPolicyWithMetaAndSelector("mesh-wide", "istio-system-1",
		map[string]string{"app": "reviews"})

	rootNamespaces := map[string]string{
		"istio-system-1": "istio-system-1",
		"istio-system-2": "istio-system-2",
		"app-ns-1":       "istio-system-1",
		"app-ns-2":       "istio-system-2",
	}

	refs := NewAuthorizationPolicyReferences(
		[]*security_v1.AuthorizationPolicy{ap},
		conf,
		config.ResolveIdentityDomain(conf.ExternalServices.Istio.IstioIdentityDomain, ""),
		config.DefaultClusterID,
		rootNamespaces,
		"app-ns-1",
		[]string{"app-ns-1", "app-ns-2"},
		[]*networking_v1.ServiceEntry{},
		[]*networking_v1.VirtualService{},
		kubernetes.KubeServiceFQDNs(nil, config.ResolveIdentityDomain(conf.ExternalServices.Istio.IstioIdentityDomain, "")),
		map[string]models.Workloads{
			"app-ns-1": {
				data.CreateWorkload("app-ns-1", "wl-1", map[string]string{"app": "reviews"}),
			},
			"app-ns-2": {
				data.CreateWorkload("app-ns-2", "wl-2", map[string]string{"app": "reviews"}),
			},
		},
	)

	result := refs.References()
	key := models.IstioReferenceKey{ObjectGVK: kubernetes.AuthorizationPolicies, Namespace: "istio-system-1", Name: "mesh-wide"}
	references := result[key]

	// wl-1 is in app-ns-1 whose root is istio-system-1 (same as the AP) -> referenced
	// wl-2 is in app-ns-2 whose root is istio-system-2 (different CP) -> NOT referenced
	assert.Len(references.WorkloadReferences, 1)
	assert.Equal("wl-1", references.WorkloadReferences[0].Name)
	assert.Equal("app-ns-1", references.WorkloadReferences[0].Namespace)
}

func getAuthPolicy(t *testing.T) *security_v1.AuthorizationPolicy {
	loader := yamlFixtureLoader("auth-policy.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindAuthorizationPolicy("allow-foo", "istio-system")
}

func getAPVirtualService(t *testing.T) *networking_v1.VirtualService {
	loader := yamlFixtureLoader("auth-policy.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindVirtualService("foo-dev", "istio-system")
}

func getAPServiceEntry(t *testing.T) *networking_v1.ServiceEntry {
	loader := yamlFixtureLoader("auth-policy.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindServiceEntry("foo-dev", "istio-system")
}

func fakeServiceEntry() *networking_v1.ServiceEntry {
	serviceEntry := networking_v1.ServiceEntry{}
	serviceEntry.Name = "googleapis"
	serviceEntry.Namespace = "test"
	serviceEntry.Spec.Hosts = []string{
		"*.googleapis.com",
	}
	return &serviceEntry
}
