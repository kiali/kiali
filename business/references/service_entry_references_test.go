package references

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

func prepareTestForServiceEntry(ap *security_v1.AuthorizationPolicy, dr *networking_v1.DestinationRule, se *networking_v1.ServiceEntry, sc *networking_v1.Sidecar) models.IstioReferences {
	drReferences := ServiceEntryReferences{
		AuthorizationPolicies: []*security_v1.AuthorizationPolicy{ap},
		Conf:                  config.Get(),
		DestinationRules:      []*networking_v1.DestinationRule{dr},
		Namespace:             "bookinfo",
		Namespaces:            []string{"bookinfo", "bookinfo2", "bookinfo3"},
		ServiceEntries:        []*networking_v1.ServiceEntry{se},
		Sidecars:              []*networking_v1.Sidecar{sc},
	}
	return *drReferences.References()[models.IstioReferenceKey{ObjectGVK: kubernetes.ServiceEntries, Namespace: se.Namespace, Name: se.Name}]
}

func TestServiceEntryReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForServiceEntry(getAuthPolicy(t), getAPDestinationRule(t), getAPServiceEntry(t), getSidecar(t))

	// Check Workload references empty
	assert.Empty(references.WorkloadReferences)

	// Check Service references (built from se.Spec.Hosts)
	assert.Len(references.ServiceReferences, 2)
	assert.Contains([]string{references.ServiceReferences[0].Name, references.ServiceReferences[1].Name}, "foo-dev.istio-system.svc.cluster.local")
	assert.Contains([]string{references.ServiceReferences[0].Name, references.ServiceReferences[1].Name}, "foo-dev.bookinfo.svc.cluster.local")

	// Check DR and AuthPolicy references
	assert.Len(references.ObjectReferences, 3)
	assert.Equal(references.ObjectReferences[0].Name, "foo-dev")
	assert.Equal(references.ObjectReferences[0].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.DestinationRules.String())

	assert.Equal(references.ObjectReferences[1].Name, "foo-sidecar")
	assert.Equal(references.ObjectReferences[1].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[1].ObjectGVK.String(), kubernetes.Sidecars.String())

	assert.Equal(references.ObjectReferences[2].Name, "allow-foo")
	assert.Equal(references.ObjectReferences[2].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[2].ObjectGVK.String(), kubernetes.AuthorizationPolicies.String())
}

func TestServiceEntryNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks - fakeServiceEntry has hosts ["*.googleapis.com"], so we get 1 ServiceReference from hosts
	references := prepareTestForServiceEntry(getAuthPolicy(t), getAPDestinationRule(t), fakeServiceEntry(), getSidecar(t))
	assert.Len(references.ServiceReferences, 1)
	assert.Equal("*.googleapis.com", references.ServiceReferences[0].Name)
	assert.Equal("test", references.ServiceReferences[0].Namespace)
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
