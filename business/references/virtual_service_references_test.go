package references

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func prepareTestForVirtualService(vs *networking_v1alpha3.VirtualService) models.IstioReferences {
	virtualServiceReferences := VirtualServiceReferences{
		Namespace: "bookinfo",
		Namespaces: models.Namespaces{
			{Name: "bookinfo"},
			{Name: "bookinfo2"},
			{Name: "bookinfo3"},
		},
		VirtualService: *vs,
	}
	return virtualServiceReferences.References()
}

func TestVirtualServiceReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForVirtualService(fakeVirtualService(t))
	assert.NotEmpty(references.ServiceReferences)

	// Check Service references
	assert.Len(references.ServiceReferences, 3)
	assert.Equal(references.ServiceReferences[0].Name, "reviews")
	assert.Equal(references.ServiceReferences[0].Namespace, "bookinfo")
	assert.Equal(references.ServiceReferences[1].Name, "reviews2")
	assert.Equal(references.ServiceReferences[1].Namespace, "bookinfo")
	assert.Equal(references.ServiceReferences[2].Name, "reviews3")
	assert.Equal(references.ServiceReferences[2].Namespace, "bookinfo3")

	// Check Gateway references
	assert.Len(references.ObjectReferences, 5)
	assert.Equal(references.ObjectReferences[0].Name, "gateway1")
	assert.Equal(references.ObjectReferences[0].Namespace, "bookinfo")
	assert.Equal(references.ObjectReferences[0].ObjectType, "gateway")
	assert.Equal(references.ObjectReferences[1].Name, "gateway2")
	assert.Equal(references.ObjectReferences[1].Namespace, "bookinfo2")
	assert.Equal(references.ObjectReferences[1].ObjectType, "gateway")
	assert.Equal(references.ObjectReferences[2].Name, "mesh")
	assert.Equal(references.ObjectReferences[2].Namespace, "")
	assert.Equal(references.ObjectReferences[2].ObjectType, "gateway")
	assert.Equal(references.ObjectReferences[3].Name, "valid-gateway")
	assert.Equal(references.ObjectReferences[3].Namespace, "bookinfo")
	assert.Equal(references.ObjectReferences[3].ObjectType, "gateway")
	assert.Equal(references.ObjectReferences[4].Name, "valid-gateway2")
	assert.Equal(references.ObjectReferences[4].Namespace, "bookinfo")
	assert.Equal(references.ObjectReferences[4].ObjectType, "gateway")
}

func TestVirtualServiceNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForVirtualService(data.CreateEmptyVirtualService("reviews-well", "bookinfo", []string{"reviews.prod.svc.cluster.local"}))
	assert.Empty(references.ServiceReferences)
}

func yamlFixtureLoader(file string) *validations.YamlFixtureLoader {
	path := fmt.Sprintf("../../tests/data/references/virtualservices/%s", file)
	return &validations.YamlFixtureLoader{Filename: path}
}

func fakeVirtualService(t *testing.T) *networking_v1alpha3.VirtualService {
	loader := yamlFixtureLoader("multiple-gateways.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindVirtualService("reviews-well", "bookinfo")
}
