package destinationrules

import (
	"fmt"
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

// Context: DestinationRule at mesh-level disabling mTLS
// Context: PeerAuthn at mesh-level disabling mTLS
// It doesn't return any validation
func TestDestRuleDisabledPeerAuthnDisabled(t *testing.T) {
	testNoDestRuleDisabledValidations("disabled_meshwide_checker_1.yaml", t)
}

// Context: DestinationRule at mesh-level disabling mTLS
// Context: PeerAuthn at mesh-level with permissive mTLS
// It doesn't return any validation
func TestDestRuleDisabledPeerAuthnPermissive(t *testing.T) {
	testNoDestRuleDisabledValidations("disabled_meshwide_checker_4.yaml", t)
}

// Context: DestinationRule at mesh-level disabling mTLS
// Context: No PeerAuthentication at mesh-level
// It doesn't return any validation
func TestDestRuleDisabledNoPeerAuthn(t *testing.T) {
	testNoDestRuleDisabledValidations("disabled_meshwide_checker_3.yaml", t)
}

// Context: DestinationRule at mesh-level disabling mTLS
// Context: PeerAuthn at mesh-level with STRICT mTLS
// It returns a validation
func TestDestRuleDisabledPeerAuthnEnabled(t *testing.T) {
	testWithDestRuleDisabledValidations("disabled_meshwide_checker_2.yaml", t)
}

func disabledMeshDestRuleTestPrep(scenario string) ([]*models.IstioCheck, bool, error) {
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor(scenario)
	err := loader.Load()

	validations, valid := DisabledMeshWideMTLSChecker{
		DestinationRule: loader.GetResource("DestinationRule"),
		MeshPeerAuthns:  loader.GetResources("PeerAuthentication"),
	}.Check()

	return validations, valid, err
}

func testNoDestRuleDisabledValidations(scenario string, t *testing.T) {
	assert := assert.New(t)

	validations, valid, error := disabledMeshDestRuleTestPrep(scenario)

	assert.NoError(error)
	assert.Empty(validations)
	assert.True(valid)
}

func testWithDestRuleDisabledValidations(scenario string, t *testing.T) {
	assert := assert.New(t)

	validations, valid, error := disabledMeshDestRuleTestPrep(scenario)

	assert.NoError(error)
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)

	validation := validations[0]
	assert.NotNil(validation)
	assert.Equal(models.ErrorSeverity, validation.Severity)
	assert.Equal("spec/trafficPolicy/tls/mode", validation.Path)
	assert.Equal(models.CheckMessage("destinationrules.mtls.meshpolicymtlsenabled"), validation.Message)
}

func yamlFixtureLoaderFor(file string) *data.YamlFixtureLoader {
	path := fmt.Sprintf("../../../tests/data/validations/destinationrules/%s", file)
	return &data.YamlFixtureLoader{Filename: path}
}
