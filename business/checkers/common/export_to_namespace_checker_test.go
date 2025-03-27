package common

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestDRNamespaceExist(t *testing.T) {
	assertIstioObjectValid("dr_exportto_valid.yaml", "DestinationRule", t)
}

func TestDRNamespaceNotFound(t *testing.T) {
	assertIstioObjectInvalidNamespace("dr_exportto_invalid.yaml", "DestinationRule", 2, t)
}

func TestDRAllNamespaces(t *testing.T) {
	assertIstioObjectValid("dr_exportto_all_valid.yaml", "DestinationRule", t)
}

func TestVSNamespaceExist(t *testing.T) {
	assertIstioObjectValid("vs_exportto_valid.yaml", "VirtualService", t)
}

func TestVSAllExist(t *testing.T) {
	assertIstioObjectValid("vs_exportto_all_valid.yaml", "VirtualService", t)
}

func TestVSNamespaceNotFound(t *testing.T) {
	assertIstioObjectInvalidNamespace("vs_exportto_invalid.yaml", "VirtualService", 2, t)
}

func TestVSAllNamespaces(t *testing.T) {
	assertIstioObjectValid("vs_exportto_all_valid.yaml", "VirtualService", t)
}

func TestSENamespaceExist(t *testing.T) {
	assertIstioObjectValid("se_exportto_valid.yaml", "ServiceEntry", t)
}

func TestSENamespaceNotFound(t *testing.T) {
	assertIstioObjectInvalidNamespace("se_exportto_invalid.yaml", "ServiceEntry", 2, t)
}

func TestSEAllNamespaces(t *testing.T) {
	assertIstioObjectValid("se_exportto_all_valid.yaml", "ServiceEntry", t)
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

	vals, valid := validateIstioObject("dr_exportto_invalid.yaml", "DestinationRule", t)

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, errorNumbers)
	for i := 0; i < errorNumbers; i++ {
		assert.NoError(validations.ConfirmIstioCheckMessage("generic.exportto.namespacenotfound", vals[i]))
		assert.Equal(vals[i].Severity, models.ErrorSeverity)
		assert.Equal(vals[i].Path, fmt.Sprintf("spec/exportTo[%d]", i))
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

	exportTo := []string{}
	switch objectType {
	case "DestinationRule":
		dr := loader.GetResources().DestinationRules
		if len(dr) > 0 {
			exportTo = dr[0].Spec.ExportTo
		}
	case "VirtualService":
		vs := loader.GetResources().VirtualServices
		if len(vs) > 0 {
			exportTo = vs[0].Spec.ExportTo
		}
	case "ServiceEntry":
		se := loader.GetResources().ServiceEntries
		if len(se) > 0 {
			exportTo = se[0].Spec.ExportTo
		}
	}

	validations, valid := ExportToNamespaceChecker{
		ExportTo:   exportTo,
		Namespaces: []string{"bookinfo", "bookinfo2", "default"},
	}.Check()

	return validations, valid
}

func yamlFixtureLoaderFor(file string) *validations.YamlFixtureLoader {
	path := fmt.Sprintf("../../../tests/data/validations/exportto/%s", file)
	return &validations.YamlFixtureLoader{Filename: path}
}
