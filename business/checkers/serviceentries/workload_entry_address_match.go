package serviceentries

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/models"
)

type HasMatchingWorkloadEntryAddress struct {
	ServiceEntry    *networking_v1.ServiceEntry
	WorkloadEntries map[string][]string
}

const MeshInternal = 1

func (in HasMatchingWorkloadEntryAddress) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	if in.ServiceEntry.Spec.Location != MeshInternal {
		return validations, true
	}

	if in.ServiceEntry.Spec.WorkloadSelector == nil {
		return validations, true
	}

	var targetAddresses []string
	seSelector := labels.Set(in.ServiceEntry.Spec.WorkloadSelector.Labels).AsSelector()

	for labelsMap, weAddressMap := range in.WorkloadEntries {
		workloadLabelsSet, err := labels.ConvertSelectorToLabelsMap(labelsMap)
		if err != nil {
			continue
		}

		if seSelector.Matches(workloadLabelsSet) {
			targetAddresses = append(targetAddresses, weAddressMap...)
		}
	}

	if targetAddresses == nil {
		return validations, true
	}

	seAddresses := in.ServiceEntryAddressMap()

	for _, weAddress := range targetAddresses {
		if _, found := seAddresses[weAddress]; !found {
			// Add validation: WorkloadEntry.Address should be part of the Service Entry Addresses list
			validation := models.Build("serviceentries.workloadentries.addressmatch", "spec/addresses")
			validations = append(validations, &validation)
		}
	}

	return validations, true
}

func GroupWorkloadEntriesByLabels(workloads []*networking_v1.WorkloadEntry) map[string][]string {
	workloadEntriesMap := map[string][]string{}
	for _, we := range workloads {
		selector := labels.Set(we.Spec.Labels).String()
		workloadEntriesMap[selector] = append(workloadEntriesMap[selector], we.Spec.Address)
	}
	return workloadEntriesMap
}

func (in HasMatchingWorkloadEntryAddress) ServiceEntryAddressMap() map[string]bool {
	addrMap := map[string]bool{}
	for _, addr := range in.ServiceEntry.Spec.Addresses {
		addrMap[addr] = false
	}
	return addrMap
}
