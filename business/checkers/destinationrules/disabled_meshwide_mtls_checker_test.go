package destinationrules

import (
	"fmt"
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/data/validations"
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

func disabledMeshDestRuleTestPrep(scenario string, t *testing.T) ([]*models.IstioCheck, bool) {
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor(scenario)
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	validations, valid := DisabledMeshWideMTLSChecker{
		DestinationRule: loader.GetResource("DestinationRule"),
		MeshPeerAuthns:  loader.GetResources("PeerAuthentication"),
	}.Check()

	return validations, valid
}

func testNoDestRuleDisabledValidations(scenario string, t *testing.T) {
	vals, valid := disabledMeshDestRuleTestPrep(scenario, t)

	tb := validations.IstioCheckTestAsserter{T: t, Validations: vals, Valid: valid}
	tb.AssertNoValidations()
}

func testWithDestRuleDisabledValidations(scenario string, t *testing.T) {
	vals, valid := disabledMeshDestRuleTestPrep(scenario, t)

	tb := validations.IstioCheckTestAsserter{T: t, Validations: vals, Valid: valid}
	tb.AssertValidationsPresent(1, false)
	tb.AssertValidationAt(0, models.ErrorSeverity, "spec/trafficPolicy/tls/mode", "destinationrules.mtls.meshpolicymtlsenabled")
}

func yamlFixtureLoaderFor(file string) *data.YamlFixtureLoader {
	path := fmt.Sprintf("../../../tests/data/validations/destinationrules/%s", file)
	return &data.YamlFixtureLoader{Filename: path}
}
