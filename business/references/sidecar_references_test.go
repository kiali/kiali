package references

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func prepareTestForSidecar(sc *networking_v1.Sidecar, vs *networking_v1.VirtualService, se *networking_v1.ServiceEntry) models.IstioReferences {
	drReferences := SidecarReferences{
		Namespace: "istio-system",
		Namespaces: models.Namespaces{
			{Name: "istio-system"},
		},
		Sidecars:       []*networking_v1.Sidecar{sc},
		ServiceEntries: []*networking_v1.ServiceEntry{se},
		WorkloadsPerNamespace: map[string]models.WorkloadList{
			"istio-system": data.CreateWorkloadList("istio-system",
				data.CreateWorkloadListItem("istiod", map[string]string{"app": "istio-ingressgateway"}),
			),
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("foo-service", "istio-system"),
	}
	return *drReferences.References()[models.IstioReferenceKey{ObjectType: "sidecar", Namespace: sc.Namespace, Name: sc.Name}]
}

func TestSidecarReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForSidecar(getSidecar(t), getAPVirtualService(t), getAPServiceEntry(t))
	// Check Service references
	assert.Len(references.ServiceReferences, 1)
	assert.Equal(references.ServiceReferences[0].Name, "foo-service")
	assert.Equal(references.ServiceReferences[0].Namespace, "istio-system")

	// Check Workload references
	assert.Len(references.WorkloadReferences, 1)
	assert.Equal(references.WorkloadReferences[0].Name, "istiod")
	assert.Equal(references.WorkloadReferences[0].Namespace, "istio-system")

	// Check SE references
	assert.Len(references.ObjectReferences, 1)
	assert.Equal(references.ObjectReferences[0].Name, "foo-dev")
	assert.Equal(references.ObjectReferences[0].Namespace, "istio-system")
	assert.Equal(references.ObjectReferences[0].ObjectType, "serviceentry")
}

func TestSidecarServiceReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForSidecar(getSidecar(t), fakeVirtualService(t), fakeServiceEntry())
	assert.Empty(references.ObjectReferences)

	// Check Service references
	assert.Len(references.ServiceReferences, 1)
	assert.Equal(references.ServiceReferences[0].Name, "foo-service")
	assert.Equal(references.ServiceReferences[0].Namespace, "istio-system")

	// Check Workload references
	assert.Len(references.WorkloadReferences, 1)
	assert.Equal(references.WorkloadReferences[0].Name, "istiod")
	assert.Equal(references.WorkloadReferences[0].Namespace, "istio-system")
}

func TestSidecarNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForSidecar(data.CreateSidecar("foo-dev", "istio-system"), getAPVirtualService(t), getAPServiceEntry(t))
	assert.Empty(references.ServiceReferences)
	assert.Empty(references.WorkloadReferences)
	assert.Empty(references.ObjectReferences)
}

func getSidecar(t *testing.T) *networking_v1.Sidecar {
	loader := yamlFixtureLoader("auth-policy.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindSidecar("foo-sidecar", "istio-system")
}
