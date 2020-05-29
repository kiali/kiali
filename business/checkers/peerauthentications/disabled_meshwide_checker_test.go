package peerauthentications

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/stretchr/testify/assert"
)

// This validations works only with AutoMTls disabled

// Context: MeshPeerAuthn disabled
// Context: DestinationRule tls mode disabled
// It doesn't return any validation
func TestMeshPeerAuthnDisabledDestRuleDisabled(t *testing.T) {
	testNoDisabledMeshValidations("disabled_meshwide_checker_1.yaml", t)
}

// Context: MeshPeerAuthn disabled
// Context: DestinationRule tls mode ISTIO_MUTUAL
// It returns a validation
func TestMeshPeerAuthnDisabledDestRuleEnabled(t *testing.T) {
	testWithDisabledMeshValidations("disabled_meshwide_checker_2.yaml", t)
}

// Context: MeshPeerAuthn disabled
// Context: No Destination Rule at mesh-wide
// It doesn't return any validation
func TestMeshPeerAuthnNoDestRule(t *testing.T) {
	testNoDisabledMeshValidations("disabled_meshwide_checker_3.yaml", t)
}

func disabledMeshTestPrep(scenario string) ([]*models.IstioCheck, bool, error) {
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor(scenario)
	err := loader.Load()

	validations, valid := DisabledMeshWideChecker{
		PeerAuthn:        loader.GetResource("PeerAuthentication"),
		DestinationRules: loader.GetResources("DestinationRule"),
	}.Check()

	return validations, valid, err
}

func testNoDisabledMeshValidations(scenario string, t *testing.T) {
	assert := assert.New(t)

	validations, valid, error := disabledMeshTestPrep(scenario)

	assert.NoError(error)
	assert.Empty(validations)
	assert.True(valid)
}

func testWithDisabledMeshValidations(scenario string, t *testing.T) {
	assert := assert.New(t)

	validations, valid, error := disabledMeshTestPrep(scenario)

	assert.NoError(error)
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)

	validation := validations[0]
	assert.NotNil(validation)
	assert.Equal(models.ErrorSeverity, validation.Severity)
	assert.Equal("spec/mtls", validation.Path)
	assert.Equal(models.CheckMessage("peerauthentications.mtls.disablemeshdestinationrulemissing"), validation.Message)
}
