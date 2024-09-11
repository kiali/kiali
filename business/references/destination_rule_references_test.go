package references

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func prepareTestForDestinationRule(dr *networking_v1.DestinationRule, vs *networking_v1.VirtualService) models.IstioReferences {
	drReferences := DestinationRuleReferences{
		Namespace: "bookinfo",
		Namespaces: models.Namespaces{
			{Name: "bookinfo"},
			{Name: "bookinfo2"},
			{Name: "bookinfo3"},
		},
		DestinationRules: []*networking_v1.DestinationRule{dr},
		VirtualServices:  []*networking_v1.VirtualService{vs},
		WorkloadsPerNamespace: map[string]models.WorkloadList{
			"test-namespace": data.CreateWorkloadList("test-namespace",
				data.CreateWorkloadListItem("reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkloadListItem("reviewsv2", appVersionLabel("reviews", "v2")),
				data.CreateWorkloadListItem("reviewsv3", appVersionLabel("reviews", "v3")),
				data.CreateWorkloadListItem("reviewsv4", appVersionLabel("reviews", "v4"))),
		},
		ServiceEntries:   []*networking_v1.ServiceEntry{fakeServiceEntry()},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
	}
	return *drReferences.References()[models.IstioReferenceKey{ObjectType: kubernetes.DestinationRules.String(), Namespace: dr.Namespace, Name: dr.Name}]
}

func TestDestinationRuleReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForDestinationRule(fakeDestinationRule(t), getVirtualService(t))
	assert.NotEmpty(references.ServiceReferences)

	// Check Service references
	assert.Len(references.ServiceReferences, 1)
	assert.Equal(references.ServiceReferences[0].Name, "reviews")
	assert.Equal(references.ServiceReferences[0].Namespace, "test-namespace")

	// Check Workload references
	assert.Len(references.WorkloadReferences, 3)
	assert.Equal(references.WorkloadReferences[0].Name, "reviewsv1")
	assert.Equal(references.WorkloadReferences[0].Namespace, "test-namespace")
	assert.Equal(references.WorkloadReferences[1].Name, "reviewsv2")
	assert.Equal(references.WorkloadReferences[1].Namespace, "test-namespace")
	assert.Equal(references.WorkloadReferences[2].Name, "reviewsv3")
	assert.Equal(references.WorkloadReferences[2].Namespace, "test-namespace")

	// Check VS references
	assert.Len(references.ObjectReferences, 1)
	assert.Equal(references.ObjectReferences[0].Name, "reviews")
	assert.Equal(references.ObjectReferences[0].Namespace, "test-namespace")
	assert.Equal(references.ObjectReferences[0].ObjectType, "virtualservice")
}

func TestDestinationRuleNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForDestinationRule(data.CreateEmptyDestinationRule("reviews", "bookinfo", "reviews.bookinfo.svc.cluster.local"), getVirtualService(t))
	assert.Empty(references.ServiceReferences)
	assert.Empty(references.WorkloadReferences)
}

func fakeDestinationRule(t *testing.T) *networking_v1.DestinationRule {
	loader := yamlFixtureLoader("destination-rule.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindDestinationRule("reviews", "test-namespace")
}

func getVirtualService(t *testing.T) *networking_v1.VirtualService {
	loader := yamlFixtureLoader("destination-rule.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindVirtualService("reviews", "test-namespace")
}

func appVersionLabel(app, version string) map[string]string {
	return map[string]string{
		"app":     app,
		"version": version,
	}
}
