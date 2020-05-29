package peerauthentications

import (
	"fmt"
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

// This validations works only with AutoMTls disabled

// Context: PeerAuthn disabled
// Context: DestinationRule tls mode disabled
// It doesn't return any validation
func TestPeerAuthnDisabledDestRuleDisabled(t *testing.T) {
	testNoDisabledNsValidations("disabled_namespacewide_checker_1.yaml", t)
}

// Context: PeerAuthn disabled
// Context: DestinationRule tls mode ISTIO_MUTUAL
// It returns a validation
func TestPeerAuthnDisabledDestRuleEnabled(t *testing.T) {
	testWithDisabledNsValidations("disabled_namespacewide_checker_2.yaml", t)
}

// Context: PeerAuthn disabled
// Context: Mesh-wide DestinationRule tls mode disabled
// It doesn't return a validation
func TestPeerAuthnDisabledMeshWideDestRuleDisabled(t *testing.T) {
	testNoDisabledNsValidations("disabled_namespacewide_checker_3.yaml", t)
}

// Context: PeerAuthn disabled
// Context: Mesh-wide DestinationRule tls mode ISTIO_MUTUAL
// It returns a validation
func TestPeerAuthnDisabledMeshWideDestRuleEnabled(t *testing.T) {
	testWithDisabledNsValidations("disabled_namespacewide_checker_4.yaml", t)
}

// Context: PeerAuthn disabled
// Context: No Destination Rule at any level
// It doesn't return any validation
func TestPeerAuthnDisabledNoDestRule(t *testing.T) {
	testNoDisabledNsValidations("disabled_namespacewide_checker_5.yaml", t)
}

func disabledNamespacetestPrep(scenario string) ([]*models.IstioCheck, bool, error) {
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor(scenario)
	err := loader.Load()

	validations, valid := DisabledNamespaceWideChecker{
		PeerAuthn:        loader.GetResource("PeerAuthentication"),
		DestinationRules: loader.GetResources("DestinationRule"),
	}.Check()

	return validations, valid, err
}

func testNoDisabledNsValidations(scenario string, t *testing.T) {
	assert := assert.New(t)

	validations, valid, error := disabledNamespacetestPrep(scenario)

	assert.NoError(error)
	assert.Empty(validations)
	assert.True(valid)
}

func testWithDisabledNsValidations(scenario string, t *testing.T) {
	assert := assert.New(t)

	validations, valid, error := disabledNamespacetestPrep(scenario)

	assert.NoError(error)
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)

	validation := validations[0]
	assert.NotNil(validation)
	assert.Equal(models.ErrorSeverity, validation.Severity)
	assert.Equal("spec/mtls", validation.Path)
	assert.Equal(models.CheckMessage("peerauthentications.mtls.disabledestinationrulemissing"), validation.Message)
}

func yamlFixtureLoaderFor(file string) *data.YamlFixtureLoader {
	path := fmt.Sprintf("../../../tests/data/validations/peerauthentications/%s", file)
	return &data.YamlFixtureLoader{Filename: path}
}
