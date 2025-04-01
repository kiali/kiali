package virtualservices

import (
	"fmt"
	"testing"

	core_v1 "k8s.io/api/core/v1"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestCheckerWithSubsetMatching(t *testing.T) {
	testNoSubsetPresenceValidationsFound("subset-presence-matching-subsets-1.yaml", t)
}

func TestCheckerWithExportSubsetMatching(t *testing.T) {
	testNoSubsetPresenceValidationsFound("subset-presence-export-subset.yaml", t)
}

func TestCheckerWithExportSubsetNotMatching(t *testing.T) {
	vals, valid := subsetPresenceCheckerPrep("subset-presence-no-matching-export-subset.yaml", t)

	tb := validations.IstioCheckTestAsserter{T: t, Validations: vals, Valid: valid}
	tb.AssertValidationsPresent(2, true)
	tb.AssertValidationAt(0, models.WarningSeverity, "spec/http[0]/route[0]/destination", "virtualservices.subsetpresent.subsetnotfound")
	tb.AssertValidationAt(1, models.WarningSeverity, "spec/http[0]/route[1]/destination", "virtualservices.subsetpresent.subsetnotfound")
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
	nsNames := namespaceNames(loader.GetNamespaces())

	vals, valid := SubsetPresenceChecker{
		Conf:           config.Get(),
		Namespaces:     nsNames,
		DRSubsets:      prepareSubsetMap(append(loader.FindDestinationRuleIn("bookinfo"), loader.FindDestinationRuleNotIn("bookinfo")...), nsNames, conf),
		VirtualService: loader.GetResources().VirtualServices[0],
	}.Check()

	if err != nil {
		t.Error("Error loading test data.")
	}

	return vals, valid
}

func namespaceNames(nss []core_v1.Namespace) []string {
	namespaces := make([]string, 0)
	for _, ns := range nss {
		namespaces = append(namespaces, ns.Name)
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

func prepareSubsetMap(destinationRules []*networking_v1.DestinationRule, namespaces []string, conf *config.Config) models.DestinationRuleSubsets {
	subsetMap := make(models.DestinationRuleSubsets)

	for _, dr := range destinationRules {
		host := dr.Spec.Host
		drHost := kubernetes.GetHost(host, dr.Namespace, namespaces, conf)

		if _, exists := subsetMap[drHost.String()]; !exists {
			subsetMap[drHost.String()] = make(map[string]kubernetes.Host)
		}

		for _, subset := range dr.Spec.Subsets {
			if subset != nil {
				subsetMap[drHost.String()][subset.Name] = drHost
			}
		}
	}

	return subsetMap
}
