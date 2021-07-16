package common

import (
	"fmt"
	"github.com/kiali/kiali/config"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestDRNamespaceExist(t *testing.T) {
	assertIstioObjectValid("dr_exportto_valid.yaml", "DestinationRule", t)
}

func TestDRNamespaceNotFound(t *testing.T) {
	assertIstioObjectInvalidNamespace("dr_exportto_invalid.yaml", "DestinationRule", 2, t)
}

func TestVSNamespaceExist(t *testing.T) {
	assertIstioObjectValid("vs_exportto_valid.yaml", "VirtualService", t)
}

func TestVSNamespaceNotFound(t *testing.T) {
	assertIstioObjectInvalidNamespace("vs_exportto_invalid.yaml", "VirtualService", 2, t)
}

func TestSENamespaceExist(t *testing.T) {
	assertIstioObjectValid("se_exportto_valid.yaml", "ServiceEntry", t)
}

func TestSENamespaceNotFound(t *testing.T) {
	assertIstioObjectInvalidNamespace("se_exportto_invalid.yaml", "ServiceEntry", 2, t)
}

func assertIstioObjectValid(scenario string, objectType string, t *testing.T) {
	assert := assert.New(t)

	validations, valid := validateIstioObject(scenario, objectType, t)

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func assertIstioObjectInvalidNamespace(scenario string, objectType string, errorNumbers int, t *testing.T) {
	assert := assert.New(t)

	validations, valid := validateIstioObject("dr_exportto_invalid.yaml", "DestinationRule", t)

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, errorNumbers)
	for i := 0; i < errorNumbers; i++ {
		assert.Equal(validations[i].Message, models.CheckMessage("generic.exportto.namespacenotfound"))
		assert.Equal(validations[i].Severity, models.ErrorSeverity)
		assert.Equal(validations[i].Path, fmt.Sprintf("spec/exportTo[%d]", i))
	}
}

func validateIstioObject(scenario string, objectType string, t *testing.T) ([]*models.IstioCheck, bool) {
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor(scenario)
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}
	validations, valid := ExportToNamespaceChecker{
		IstioObject: loader.GetFirstResource(objectType),
		Namespaces: models.Namespaces{
			models.Namespace{Name: "bookinfo"},
			models.Namespace{Name: "bookinfo2"},
			models.Namespace{Name: "default"},
		},
	}.Check()

	return validations, valid
}

func yamlFixtureLoaderFor(file string) *data.YamlFixtureLoader {
	path := fmt.Sprintf("../../../tests/data/validations/exportto/%s", file)
	return &data.YamlFixtureLoader{Filename: path}
}
