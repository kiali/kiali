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

func prepareTestForServiceEntry(ap *security_v1.AuthorizationPolicy, dr *networking_v1.DestinationRule, se *networking_v1.ServiceEntry, sc *networking_v1.Sidecar) models.IstioReferences {
	drReferences := ServiceEntryReferences{
		Namespace: "bookinfo",
		Namespaces: models.Namespaces{
			{Name: "bookinfo"},
			{Name: "bookinfo2"},
			{Name: "bookinfo3"},
		},
		AuthorizationPolicies: []*security_v1.AuthorizationPolicy{ap},
		ServiceEntries:        []*networking_v1.ServiceEntry{se},
		Sidecars:              []*networking_v1.Sidecar{sc},
		DestinationRules:      []*networking_v1.DestinationRule{dr},
		RegistryServices:      append(data.CreateFakeRegistryServices("foo-dev.bookinfo.svc.cluster.local", "bookinfo", "."), data.CreateFakeRegistryServices("foo-dev.istio-system.svc.cluster.local", "istio-system", "*")...),
	}
	return *drReferences.References()[models.IstioReferenceKey{ObjectType: kubernetes.ServiceEntries.String(), Namespace: se.Namespace, Name: se.Name}]
}

func TestServiceEntryReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForServiceEntry(getAuthPolicy(t), getAPDestinationRule(t), getAPServiceEntry(t), getSidecar(t))

	// Check Workload references empty
	assert.Empty(references.WorkloadReferences)

	// Check Service references
	assert.Len(references.ServiceReferences, 1)
	assert.Equal(references.ServiceReferences[0].Name, "foo-dev.istio-system.svc.cluster.local")
	assert.Equal(references.ServiceReferences[0].Namespace, "istio-system")

	// Check DR and AuthPolicy references
	assert.Len(references.ObjectReferences, 3)
	assert.Equal(references.ObjectReferences[0].Name, "foo-dev")
	assert.Equal(references.ObjectReferences[0].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[0].ObjectType, kubernetes.DestinationRules.String())

	assert.Equal(references.ObjectReferences[1].Name, "foo-sidecar")
	assert.Equal(references.ObjectReferences[1].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[1].ObjectType, kubernetes.Sidecars.String())

	assert.Equal(references.ObjectReferences[2].Name, "allow-foo")
	assert.Equal(references.ObjectReferences[2].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[2].ObjectType, kubernetes.AuthorizationPolicies.String())
}

func TestServiceEntryNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForServiceEntry(getAuthPolicy(t), getAPDestinationRule(t), fakeServiceEntry(), getSidecar(t))
	assert.Empty(references.ServiceReferences)
	assert.Empty(references.WorkloadReferences)
	assert.Empty(references.ObjectReferences)
}

func getAPDestinationRule(t *testing.T) *networking_v1.DestinationRule {
	loader := yamlFixtureLoader("auth-policy.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindDestinationRule("foo-dev", "istio-system")
}
