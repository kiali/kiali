package authorization

import (
	"fmt"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/tests/data"
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data/validations"
)

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: PeerAuthentication not found
// It doesn't return any validation
func TestAutoAuthzNoConfig(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_1.yaml", t)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: PeerAuthentication STRICT/PERMISSIVE
// It doesn't return any validation
func TestAutoAuthzPeerAuthnValid(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_2.yaml", t)
	testNoMtlsChecker("mtls_enabled_checker_3.yaml", t)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: PeerAuthentication STRICT/PERMISSIVE
// Context: DestinationRule ISTIO_MUTUAL
// It doesn't return any validation
func TestAutoAuthzPeerAuthnValidDestRuleValid(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_4.yaml", t)
	testNoMtlsChecker("mtls_enabled_checker_5.yaml", t)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: Peer Authn Not found
// Context: DestinationRule ISTIO_MUTUAL
// It doesn't return a validation
func TestPeerAuthnNotFoundDestRuleIstioMutual(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_6.yaml", t)
}

// Context: AutoMtls enabled/disabled
// Context: Authorization Policy found
// Context: PeerAuthentication DISABLE
// It returns a validation
func TestAutoAuthzPeerAuthnDisable(t *testing.T) {
	testMtlsCheckerPresent("mtls_enabled_checker_7.yaml", t)
}

// Context: AutoMtls enabled/disabled
// Context: Authorization Policy found
// Context: DestinationRule DISABLE
// It returns a validation
func TestAutoAuthzDestRuleDisable(t *testing.T) {
	testMtlsCheckerPresent("mtls_enabled_checker_8.yaml", t)
}

// Context: AutoMtls enabled/disabled
// Context: Authorization Policy found
// Context: Mesh-wide PeerAuthentication DISABLE
// It returns a validation
func TestAutoAuthzMeshPeerAuthnDisable(t *testing.T) {
	testMtlsCheckerPresent("mtls_enabled_checker_9.yaml", t)
}

// Context: AutoMtls enabled/disabled
// Context: Authorization Policy found
// Context: Mesh-wide DestinationRule DISABLE
// It returns a validation
func TestAutoAuthzMeshDestRuleDisable(t *testing.T) {
	testMtlsCheckerPresent("mtls_enabled_checker_10.yaml", t)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: Mesh-wide PeerAuthentication STRICT/PERMISSIVE
// It doesn't return any validation / AutoMtls=false It returns a validation
func TestAutoAuthzMeshPeerAuthnEnabled(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_11.yaml", t)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: Mesh-wide DestinationRule ISTIO_MUTUAL
// It doesn't return any validation / Auto=false It returns a validation
func TestAutoAuthzMeshDestRuleEnabled(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_12.yaml", t)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: Mesh-wide PeerAuthentication STRICT/PERMISSIVE
// Context: Mesh-wide DestinationRule ISTIO_MUTUAL
// It doesn't return any validation
func TestAutoAuthzMeshMTLSEnabled(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_13.yaml", t)
}

func mtlsCheckerTestPrep(scenario string, autoMtls bool, t *testing.T) models.IstioValidations {
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor(scenario)
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	validations := MtlsEnabledChecker{
		Namespace:             "bookinfo",
		AuthorizationPolicies: loader.GetResources("AuthorizationPolicy"),
		MtlsDetails: kubernetes.MTLSDetails{
			DestinationRules:        loader.GetResources("DestinationRule"),
			MeshPeerAuthentications: loader.GetResourcesIn("PeerAuthentication", "istio-system"),
			ServiceMeshPolicies:     loader.GetResources("ServiceMeshPolicy"),
			PeerAuthentications:     loader.GetResourcesNotIn("PeerAuthentication", "istio-system"),
			EnabledAutoMtls:         autoMtls,
		},
	}.Check()

	return validations
}

func testNoMtlsChecker(scenario string, t *testing.T) {
	vals := mtlsCheckerTestPrep(scenario, true, t)
	ta := validations.ValidationsTestAsserter{T: t, Validations: vals}
	ta.AssertNoValidations()
}

func testMtlsCheckerPresent(scenario string, t *testing.T) {
	vals := mtlsCheckerTestPrep(scenario, true, t)
	ta := validations.ValidationsTestAsserter{T: t, Validations: vals}
	ta.AssertValidationsPresent(1)
	ta.AssertValidationAt(models.IstioValidationKey{
		ObjectType: "authorizationpolicy",
		Name:       "policy",
		Namespace:  "bookinfo",
	}, models.ErrorSeverity, "metadata/name", "authorizationpolicy.mtls.needstobeenabled")
}

func yamlFixtureLoaderFor(file string) *data.YamlFixtureLoader {
	path := fmt.Sprintf("../../../tests/data/validations/authorization/%s", file)
	return &data.YamlFixtureLoader{Filename: path}
}
