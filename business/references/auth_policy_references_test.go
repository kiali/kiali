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
	drReferences := AuthorizationPolicyReferences{
		Conf:                  config.Get(),
		Namespace:             "bookinfo",
		Namespaces:            []string{"bookinfo", "bookinfo2", "bookinfo3"},
		AuthorizationPolicies: []*security_v1.AuthorizationPolicy{ap},
		ServiceEntries:        []*networking_v1.ServiceEntry{se},
		VirtualServices:       []*networking_v1.VirtualService{vs},
		WorkloadsPerNamespace: map[string]models.Workloads{
			"istio-system": {
				data.CreateWorkload("istiod", map[string]string{"app": "istio-ingressgateway"}),
			}},
		RegistryServices: data.CreateFakeRegistryServicesLabels("foo-dev", "istio-system"),
	}
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
