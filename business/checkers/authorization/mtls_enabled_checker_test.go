package authorization

import (
	"fmt"
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: PeerAuthentication not found
// It doesn't return any validation
func TestAutoAuthzNoConfig(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_1.yaml", t, true)
	testMtlsCheckerPresent("mtls_enabled_checker_1.yaml", t, false)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: PeerAuthentication STRICT/PERMISSIVE
// It doesn't return any validation
func TestAutoAuthzPeerAuthnValid(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_2.yaml", t, true)
	testNoMtlsChecker("mtls_enabled_checker_3.yaml", t, true)
	testMtlsCheckerPresent("mtls_enabled_checker_2.yaml", t, false)
	testMtlsCheckerPresent("mtls_enabled_checker_3.yaml", t, false)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: PeerAuthentication STRICT/PERMISSIVE
// Context: DestinationRule ISTIO_MUTUAL
// It doesn't return any validation
func TestAutoAuthzPeerAuthnValidDestRuleValid(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_4.yaml", t, true)
	testNoMtlsChecker("mtls_enabled_checker_5.yaml", t, true)
	testNoMtlsChecker("mtls_enabled_checker_4.yaml", t, false)
	testNoMtlsChecker("mtls_enabled_checker_5.yaml", t, false)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: Peer Authn Not found
// Context: DestinationRule ISTIO_MUTUAL
// It doesn't return a validation
func TestPeerAuthnNotFoundDestRuleIstioMutual(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_6.yaml", t, true)
	testMtlsCheckerPresent("mtls_enabled_checker_6.yaml", t, false)
}

// Context: AutoMtls enabled/disabled
// Context: Authorization Policy found
// Context: PeerAuthentication DISABLE
// It returns a validation
func TestAutoAuthzPeerAuthnDisable(t *testing.T) {
	testMtlsCheckerPresent("mtls_enabled_checker_7.yaml", t, true)
	// If the AP doesn't have principals
	testNoMtlsChecker("mtls_enabled_checker_71.yaml", t, true)

	testMtlsCheckerPresent("mtls_enabled_checker_7.yaml", t, false)
	testNoMtlsChecker("mtls_enabled_checker_71.yaml", t, false)
}

// Context: AutoMtls enabled/disabled
// Context: Authorization Policy found
// Context: DestinationRule DISABLE
// It returns a validation
func TestAutoAuthzDestRuleDisable(t *testing.T) {
	testMtlsCheckerPresent("mtls_enabled_checker_8.yaml", t, true)
	testMtlsCheckerPresent("mtls_enabled_checker_8.yaml", t, false)
}

// Context: AutoMtls enabled/disabled
// Context: Authorization Policy found
// Context: Mesh-wide PeerAuthentication DISABLE
// It returns a validation
func TestAutoAuthzMeshPeerAuthnDisable(t *testing.T) {
	testMtlsCheckerPresent("mtls_enabled_checker_9.yaml", t, true)
	testMtlsCheckerPresent("mtls_enabled_checker_9.yaml", t, false)
}

// Context: AutoMtls enabled/disabled
// Context: Authorization Policy found
// Context: Mesh-wide DestinationRule DISABLE
// It returns a validation
func TestAutoAuthzMeshDestRuleDisable(t *testing.T) {
	testMtlsCheckerPresent("mtls_enabled_checker_10.yaml", t, true)
	// If the AP doesn't have principals
	testNoMtlsChecker("mtls_enabled_checker_101.yaml", t, true)

	testMtlsCheckerPresent("mtls_enabled_checker_10.yaml", t, false)
	testNoMtlsChecker("mtls_enabled_checker_101.yaml", t, false)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: Mesh-wide PeerAuthentication STRICT/PERMISSIVE
// It doesn't return any validation / AutoMtls=false It returns a validation
func TestAutoAuthzMeshPeerAuthnEnabled(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_11.yaml", t, true)
	testMtlsCheckerPresent("mtls_enabled_checker_11.yaml", t, false)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: Mesh-wide DestinationRule ISTIO_MUTUAL
// It doesn't return any validation / Auto=false It returns a validation
func TestAutoAuthzMeshDestRuleEnabled(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_12.yaml", t, true)
	testMtlsCheckerPresent("mtls_enabled_checker_12.yaml", t, false)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: Mesh-wide PeerAuthentication STRICT/PERMISSIVE
// Context: Mesh-wide DestinationRule ISTIO_MUTUAL
// It doesn't return any validation
func TestAutoAuthzMeshMTLSEnabled(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_13.yaml", t, true)
	testNoMtlsChecker("mtls_enabled_checker_14.yaml", t, true)

	testNoMtlsChecker("mtls_enabled_checker_13.yaml", t, false)
	testNoMtlsChecker("mtls_enabled_checker_14.yaml", t, false)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: Mesh-wide mTLS enabled
// Context: Namespace-wide mTLS disabled
// It returns a validation
func TestAuthozDisabled(t *testing.T) {
	testMtlsCheckerPresent("mtls_enabled_checker_15.yaml", t, true)
	testMtlsCheckerPresent("mtls_enabled_checker_16.yaml", t, true)
	testMtlsCheckerPresent("mtls_enabled_checker_17.yaml", t, true)

	testMtlsCheckerPresent("mtls_enabled_checker_15.yaml", t, false)
	testMtlsCheckerPresent("mtls_enabled_checker_16.yaml", t, false)
	testMtlsCheckerPresent("mtls_enabled_checker_17.yaml", t, false)
}

// Context: AutoMtls enabled
// Context: Authorization Policy found
// Context: Namespace-level mtls permissive
// Context: Workload-level mtls strict
// It doesn't return any validation
func TestMTLSEnabledWorkloadLevel(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_18.yaml", t, true)
	testNoMtlsChecker("mtls_enabled_checker_18.yaml", t, false)
}

// Context: AutoMtls enabled/disabled
// Context: Authorization Policy found
// Context: Namespace-level mtls STRICT
// Context: Workload-level mtls DISABLE
// It returns a validation
func TestMTLSDisabledWorkloadLevel(t *testing.T) {
	testMtlsCheckerPresent("mtls_enabled_checker_19.yaml", t, false)
	testMtlsCheckerPresent("mtls_enabled_checker_20.yaml", t, true)
}

// Context: AutoMtls enabled/disabled
// Context: Authorization Policy found
// Context: Namespace-level mtls STRICT
// Context: Workload-level mtls PERMISSIVE/ENABLED
// It doesn't return a validation
func TestMTLSPermissiveWorkloadLevel(t *testing.T) {
	testNoMtlsChecker("mtls_enabled_checker_21.yaml", t, true)
	testNoMtlsChecker("mtls_enabled_checker_21.yaml", t, false)
}

// Context: AutoMtls enabled/disabled
// Context: Authorization Policy found
// Context: Namespace-level mtls STRICT
// Context: Workload-level mtls PERMISSIVE/DISABLE
// It returns a validation
func TestMTLSPermissiveDisabledWorkloadLevel(t *testing.T) {
	testMtlsCheckerPresent("mtls_enabled_checker_22.yaml", t, true)
	testMtlsCheckerPresent("mtls_enabled_checker_22.yaml", t, false)
}

func TestNeedsIdentities(t *testing.T) {
	loader := yamlFixtureLoaderFor("authz_policy_requires_mtls.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	var tests = []struct {
		name   string
		result bool
		paths  []string
	}{
		{"policy-0", true, []string{"spec/rules[0]/from[0]/source/principals"}},
		{"policy-1", true, []string{"spec/rules[0]/from[0]/source/notPrincipals"}},
		{"policy-2", false, []string{""}},
		{"policy-3", true, []string{"spec/rules[0]/when[0]"}},
		{"policy-4", true, []string{"spec/rules[0]/when[0]"}},
		{"policy-5", true, []string{"spec/rules[0]/when[0]"}},
		{"policy-6", false, []string{""}},
		{"policy-7", false, []string{""}},
		{"policy-8", true, []string{"spec/rules[0]/from[o]/source/namespaces"}},
		{"policy-9", true, []string{"spec/rules[0]/from[o]/source/notNamespaces"}},
		{"policy-10", false, []string{""}},
	}

	for _, test := range tests {
		ap := loader.FindAuthorizationPolicy(test.name, "bookinfo")
		needs, paths := needsMtls(ap)
		if needs != test.result {
			t.Errorf("%s needs identities: %t. Expected to be %t", test.name, needs, test.result)

			for _, tp := range test.paths {
				contains := false
				for _, rp := range paths {
					contains = contains || tp != rp
				}
				if !contains {
					t.Errorf("%s doesn't include PATH: %s", test.name, tp)
				}
			}

			if len(test.paths) != len(paths) {
				t.Errorf("%s doesn't contain all the PATH", test.name)
			}
		}
	}
}

func mtlsCheckerTestPrep(scenario string, autoMtls bool, t *testing.T) models.IstioValidations {
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor(scenario)
	err := loader.Load()
	if err != nil {
		t.Errorf("Error loading scenario [%s] test data. Error: [%s]", scenario, err)
	}

	validations := MtlsEnabledChecker{
		Conf:                  config.Get(),
		AuthorizationPolicies: loader.GetResources().AuthorizationPolicies,
		RegistryServices:      data.CreateFakeRegistryServicesLabels("ratings", "bookinfo"),
		MtlsDetails: kubernetes.MTLSDetails{
			DestinationRules:        loader.GetResources().DestinationRules,
			MeshPeerAuthentications: loader.FindPeerAuthenticationIn("istio-system"),
			PeerAuthentications:     loader.FindPeerAuthenticationNotIn("istio-system"),
			EnabledAutoMtls:         autoMtls,
		},
	}.Check()

	return validations
}

func testNoMtlsChecker(scenario string, t *testing.T, autoMtls bool) {
	vals := mtlsCheckerTestPrep(scenario, autoMtls, t)
	ta := validations.ValidationsTestAsserter{T: t, Validations: vals}
	ta.AssertNoValidations()
}

func testMtlsCheckerPresent(scenario string, t *testing.T, autoMtls bool) {
	vals := mtlsCheckerTestPrep(scenario, autoMtls, t)
	ta := validations.ValidationsTestAsserter{T: t, Validations: vals}
	ta.AssertValidationsPresent(1)
	ta.AssertValidationAt(models.IstioValidationKey{
		ObjectGVK: kubernetes.AuthorizationPolicies,
		Name:      "policy",
		Namespace: "bookinfo",
	}, models.ErrorSeverity, "spec/rules[0]/from[0]/source/principals", "authorizationpolicy.mtls.needstobeenabled")
}

func yamlFixtureLoaderFor(file string) *validations.YamlFixtureLoader {
	path := fmt.Sprintf("../../../tests/data/validations/authorization/%s", file)
	return &validations.YamlFixtureLoader{Filename: path}
}
