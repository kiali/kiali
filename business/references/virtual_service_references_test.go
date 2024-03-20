package references

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func prepareTestForVirtualService(vs *networking_v1beta1.VirtualService, dr *networking_v1beta1.DestinationRule, ap *security_v1beta.AuthorizationPolicy) models.IstioReferences {
	virtualServiceReferences := VirtualServiceReferences{
		Namespace: "bookinfo",
		Namespaces: models.Namespaces{
			models.Namespace{Name: "bookinfo"},
			models.Namespace{Name: "bookinfo2"},
			models.Namespace{Name: "bookinfo3"},
		},
		VirtualServices:       []*networking_v1beta1.VirtualService{vs},
		DestinationRules:      []*networking_v1beta1.DestinationRule{dr},
		AuthorizationPolicies: []*security_v1beta.AuthorizationPolicy{ap, data.CreateEmptyAuthorizationPolicy("test", "bookinfo")},
	}
	return *virtualServiceReferences.References()[models.IstioReferenceKey{ObjectType: "virtualservice", Namespace: vs.Namespace, Name: vs.Name}]
}

func TestVirtualServiceReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForVirtualService(fakeVirtualService(t), findDestinationRule(t), getVSAuthPolicy(t))
	assert.NotEmpty(references.ServiceReferences)

	// Check Service references
	assert.Len(references.ServiceReferences, 3)
	assert.Equal(references.ServiceReferences[0].Name, "reviews")
	assert.Equal(references.ServiceReferences[0].Namespace, "bookinfo")
	assert.Equal(references.ServiceReferences[1].Name, "reviews2")
	assert.Equal(references.ServiceReferences[1].Namespace, "bookinfo")
	assert.Equal(references.ServiceReferences[2].Name, "reviews3")
	assert.Equal(references.ServiceReferences[2].Namespace, "bookinfo3")

	assert.Len(references.ObjectReferences, 7)
	// Check Gateway references
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

	// Check DR references
	assert.Equal(references.ObjectReferences[5].Name, "reviews")
	assert.Equal(references.ObjectReferences[5].Namespace, "bookinfo")
	assert.Equal(references.ObjectReferences[5].ObjectType, "destinationrule")

	// Check AP references
	assert.Equal(references.ObjectReferences[6].Name, "allow-foo")
	assert.Equal(references.ObjectReferences[6].Namespace, "bookinfo")
	assert.Equal(references.ObjectReferences[6].ObjectType, "authorizationpolicy")
}

func TestVirtualServiceNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForVirtualService(data.CreateEmptyVirtualService("reviews-well", "bookinfo", []string{"reviews.prod.svc.cluster.local"}), findDestinationRule(t), getVSAuthPolicy(t))
	assert.Empty(references.ServiceReferences)
}

func yamlFixtureLoader(file string) *validations.YamlFixtureLoader {
	path := fmt.Sprintf("../../tests/data/references/%s", file)
	return &validations.YamlFixtureLoader{Filename: path}
}

func fakeVirtualService(t *testing.T) *networking_v1beta1.VirtualService {
	loader := yamlFixtureLoader("multiple-gateways.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindVirtualService("reviews-well", "bookinfo")
}

func findDestinationRule(t *testing.T) *networking_v1beta1.DestinationRule {
	loader := yamlFixtureLoader("multiple-gateways.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindDestinationRule("reviews", "bookinfo")
}

func getVSAuthPolicy(t *testing.T) *security_v1beta.AuthorizationPolicy {
	loader := yamlFixtureLoader("multiple-gateways.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	return loader.FindAuthorizationPolicy("allow-foo", "bookinfo")
}
