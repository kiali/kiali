package peerauthentications

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data/validations"
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

func disabledMeshTestPrep(scenario string, t *testing.T) ([]*models.IstioCheck, bool) {
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor(scenario)
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	validations, valid := DisabledMeshWideChecker{
		PeerAuthn:        loader.GetResource("PeerAuthentication"),
		DestinationRules: loader.GetResources("DestinationRule"),
	}.Check()

	return validations, valid
}

func testNoDisabledMeshValidations(scenario string, t *testing.T) {
	vals, valid := disabledMeshTestPrep(scenario, t)
	tb := validations.ValidationTestAsserter{T: t, Validations: vals, Valid: valid}
	tb.AssertNoValidations()
}

func testWithDisabledMeshValidations(scenario string, t *testing.T) {
	vals, valid := disabledMeshTestPrep(scenario, t)
	tb := validations.ValidationTestAsserter{T: t, Validations: vals, Valid: valid}
	tb.AssertValidationsPresent(1, false)
	tb.AssertValidationAt(0, models.ErrorSeverity, "spec/mtls", "peerauthentications.mtls.disablemeshdestinationrulemissing")
}
