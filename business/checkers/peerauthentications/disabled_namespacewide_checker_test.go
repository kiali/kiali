package peerauthentications

import (
	"fmt"
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/testutils/validations"
)

// This vals works only with AutoMTls disabled

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

// Context: PeerAuthn disabled at namespace
// Context: DR disabled at namespace
// Context: mTLS strict at mesh-level (PeerAuthn + DestRule)
// It doesn't return any validation
func TestPeerAuthnDisabledNamespaceMtlsMeshWideEnabled(t *testing.T) {
	testNoDisabledNsValidations("disabled_namespacewide_checker_6.yaml", t)
}

func disabledNamespacetestPrep(scenario string, t *testing.T) ([]*models.IstioCheck, bool) {
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor(scenario)
	err := loader.Load()

	vals, valid := DisabledNamespaceWideChecker{
		Conf:             config.Get(),
		PeerAuthn:        loader.GetResources().PeerAuthentications[0],
		DestinationRules: loader.GetResources().DestinationRules,
	}.Check()

	if err != nil {
		t.Error("Error loading test data.")
	}

	return vals, valid
}

func testNoDisabledNsValidations(scenario string, t *testing.T) {
	vals, valid := disabledNamespacetestPrep(scenario, t)

	tb := validations.IstioCheckTestAsserter{T: t, Validations: vals, Valid: valid}
	tb.AssertNoValidations()
}

func testWithDisabledNsValidations(scenario string, t *testing.T) {
	vals, valid := disabledNamespacetestPrep(scenario, t)

	tb := validations.IstioCheckTestAsserter{T: t, Validations: vals, Valid: valid}
	tb.AssertValidationsPresent(1, false)
	tb.AssertValidationAt(0, models.ErrorSeverity, "spec/mtls", "peerauthentications.mtls.disabledestinationrulemissing")
}

func yamlFixtureLoaderFor(file string) *validations.YamlFixtureLoader {
	path := fmt.Sprintf("../../../tests/data/validations/peerauthentications/%s", file)
	return &validations.YamlFixtureLoader{Filename: path}
}
