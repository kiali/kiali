package virtualservices

import (
	"fmt"
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestCheckerWithSubsetMatching(t *testing.T) {
	testNoSubsetPresenceValidationsFound("subset-presence-matching-subsets-1.yaml", t)
}

func TestCheckerWithSubsetsMatchingShortHostname(t *testing.T) {
	testNoSubsetPresenceValidationsFound("subset-presence-matching-subsets-2.yaml", t)
}

func TestCheckerWithSubsetsMatchingShortHostnameDiffNs(t *testing.T) {
	testSubsetPresenceValidationsFound("subset-presence-matching-subsets-diff-ns.yaml", t)
}

func TestDestRuleDifferentNamespaceFQDNName(t *testing.T) {
	testNoSubsetPresenceValidationsFound("subset-presence-matching-subsets-diff-ns-fqdn.yaml", t)
}

func TestDestRuleDifferentNamespaceHalfFQDNName(t *testing.T) {
	testNoSubsetPresenceValidationsFound("subset-presence-matching-subsets-diff-ns-half-fqdn.yaml", t)
}

func TestCheckerWithSubsetsMatchingSVCNSHostname(t *testing.T) {
	testNoSubsetPresenceValidationsFound("subset-presence-matching-subsets-half-fqdn.yaml", t)
}

func TestSubsetsNotFound(t *testing.T) {
	testSubsetPresenceValidationsFound("subset-presence-no-matching-subsets-1.yaml", t)
}

func TestSubsetsNotFoundSVCNS(t *testing.T) {
	testSubsetPresenceValidationsFound("subset-presence-no-matching-subsets-2.yaml", t)
}

func TestWrongDestinationRule(t *testing.T) {
	testSubsetPresenceValidationsFound("subset-presence-no-matching-subsets-3.yaml", t)
}

func TestCorrectServiceEntry(t *testing.T) {
	testNoSubsetPresenceValidationsFound("subset-presence-service-entry.yaml", t)
}

func TestInvalidServiceEntry(t *testing.T) {
	vals, valid := subsetPresenceCheckerPrep("subset-presence-service-entry-invalid.yaml", t)

	tb := validations.IstioCheckTestAsserter{T: t, Validations: vals, Valid: valid}
	tb.AssertValidationsPresent(2, true)
	tb.AssertValidationAt(0, models.WarningSeverity, "spec/http[1]/route[0]/destination", "virtualservices.subsetpresent.subsetnotfound")
	tb.AssertValidationAt(1, models.WarningSeverity, "spec/tls[1]/route[0]/destination", "virtualservices.subsetpresent.subsetnotfound")
}

func subsetPresenceCheckerPrep(scenario string, t *testing.T) ([]*models.IstioCheck, bool) {
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor(scenario)
	err := loader.Load()

	vals, valid := SubsetPresenceChecker{
		Namespace:        "bookinfo",
		Namespaces:       namespaceNames(loader.GetResources("Namespace")),
		DestinationRules: loader.GetResources("DestinationRule"),
		VirtualService:   loader.GetFirstResource("VirtualService"),
	}.Check()

	if err != nil {
		t.Error("Error loading test data.")
	}

	return vals, valid
}

func namespaceNames(nss []kubernetes.IstioObject) []string {
	namespaces := make([]string, 0)
	for _, ns := range nss {
		namespaces = append(namespaces, ns.GetObjectMeta().Name)
	}
	return namespaces
}

func yamlFixtureLoaderFor(file string) *validations.YamlFixtureLoader {
	path := fmt.Sprintf("../../../tests/data/validations/virtualservices/%s", file)
	return &validations.YamlFixtureLoader{Filename: path}
}

func testNoSubsetPresenceValidationsFound(scenario string, t *testing.T) {
	vals, valid := subsetPresenceCheckerPrep(scenario, t)
	tb := validations.IstioCheckTestAsserter{T: t, Validations: vals, Valid: valid}
	tb.AssertNoValidations()
}

func testSubsetPresenceValidationsFound(scenario string, t *testing.T) {
	vals, valid := subsetPresenceCheckerPrep(scenario, t)

	tb := validations.IstioCheckTestAsserter{T: t, Validations: vals, Valid: valid}
	tb.AssertValidationsPresent(2, true)
	tb.AssertValidationAt(0, models.WarningSeverity, "spec/http[0]/route[0]/destination", "virtualservices.subsetpresent.subsetnotfound")
	tb.AssertValidationAt(1, models.WarningSeverity, "spec/http[1]/route[0]/destination", "virtualservices.subsetpresent.subsetnotfound")
}
