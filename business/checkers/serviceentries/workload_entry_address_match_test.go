package serviceentries

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/testutils/validations"
)

// ServiceEntry points to ratings.internal.cloud
// and has workloadSelector: app=ratings
// WorkloadEntry points to ratings.internal.cloud
// and has labels app=ratings,version=v1
func TestServiceEntryAddressMatch(t *testing.T) {
	noValidationsShown(t, "ratings", "bookinfo")
}

// ServiceEntry points to an external host
// and its location is MESH_EXTERNAL
func TestExternalServiceEntry(t *testing.T) {
	noValidationsShown(t, "ratings-external", "bookinfo")
}

// ServiceEntry hasn't got any workload matching
func TestServiceEntryUnmatchingAddress(t *testing.T) {
	noValidationsShown(t, "ratings-wrong-labels", "bookinfo")
}

// ServiceEntry points to ADDR1
// and has workloadSelector: app=ratings-unmatching
// WorkloadEntry points to ADDR2 (!= ADDR1)
// and has labels app=ratings-unmatching,version=v1
func TestServiceEntryWithNoMatchingWorkloads(t *testing.T) {
	validationsShown(t, "ratings-unmatching-address", "bookinfo")
}

// ServiceEntry only has one address
// There are two WorkloadEntries pointing to 2 different addresses
func TestServiceEntryMissesWorkloadAddress(t *testing.T) {
	validationsShown(t, "ratings-missing", "bookinfo")
}

// ServiceEntry points to 2 addresses
// There is one WorkloadEntry. It's IP is in the ServiceEntry addresses list
func TestServiceEntryMoreAddresses(t *testing.T) {
	noValidationsShown(t, "ratings-surplus", "bookinfo")
}

func noValidationsShown(t *testing.T, serviceEntryName, namespace string) {
	asserter := assert.New(t)
	checks, valid := checksFor(serviceEntryName, namespace, t)
	asserter.Empty(checks)
	asserter.True(valid)
}

func validationsShown(t *testing.T, serviceEntryName, namespace string) {
	asserter := assert.New(t)
	checks, valid := checksFor(serviceEntryName, namespace, t)

	asserter.NotEmpty(checks)
	asserter.True(valid)
	asserter.Equal(models.WarningSeverity, checks[0].Severity)
	asserter.NoError(validations.ConfirmIstioCheckMessage("serviceentries.workloadentries.addressmatch", checks[0]))
	asserter.Equal("spec/addresses", checks[0].Path)
}

func checksFor(serviceEntryName, namespace string, t *testing.T) ([]*models.IstioCheck, bool) {
	loader := yamlFixtureLoaderFor("workload_entry_address_match.yaml")
	if err := loader.Load(); err != nil {
		t.Fatalf("Error loading tests manifests")
	}

	serviceEntry := loader.FindServiceEntry(serviceEntryName, namespace)
	if serviceEntry == nil {
		t.Fatalf("ServieEntry not found: %s/%s", serviceEntryName, namespace)
		return []*models.IstioCheck{}, true
	}

	return HasMatchingWorkloadEntryAddress{
		ServiceEntry:    serviceEntry,
		WorkloadEntries: GroupWorkloadEntriesByLabels(loader.GetResources().WorkloadEntries),
	}.Check()
}

func yamlFixtureLoaderFor(file string) *validations.YamlFixtureLoader {
	path := fmt.Sprintf("../../../tests/data/validations/serviceentries/%s", file)
	return &validations.YamlFixtureLoader{Filename: path}
}
