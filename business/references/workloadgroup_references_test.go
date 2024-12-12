package references

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"

	"github.com/stretchr/testify/assert"
)

func prepareTestForWorkloadGroup(name string) models.IstioReferences {
	wgReferences := WorkloadGroupReferences{
		WorkloadGroups:  data.CreateWorkloadGroups(*config.NewConfig()),
		WorkloadEntries: data.CreateWorkloadEntries(*config.NewConfig()),
		WorkloadsPerNamespace: map[string]models.WorkloadList{
			"Namespace": data.CreateWorkloadList("Namespace",
				data.CreateWorkloadListItem("ratings-vm", map[string]string{"app": "ratings-vm", "class": "vm", "version": "v3"}),
				data.CreateWorkloadListItem("ratings-vm2", map[string]string{"app": "ratings-vm2", "class": "vm2", "version": "v4"}),
				data.CreateWorkloadListItem("ratings-vm-no-entry", map[string]string{"app": "ratings-vm-no-entry", "class": "vm3"}),
				data.CreateWorkloadListItem("ratings-vm-no-labels", map[string]string{})),
		},
	}
	return *wgReferences.References()[models.IstioReferenceKey{ObjectGVK: kubernetes.WorkloadGroups, Namespace: "Namespace", Name: name}]
}

func TestWorkloadGroupReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForWorkloadGroup("ratings-vm")

	// Check Workload references
	assert.Len(references.WorkloadReferences, 1)
	assert.Equal(references.WorkloadReferences[0].Name, "ratings-vm")
	assert.Equal(references.WorkloadReferences[0].Namespace, "Namespace")

	// Check WE references
	assert.Len(references.ObjectReferences, 1)
	assert.Equal(references.ObjectReferences[0].Name, "ratings-vm")
	assert.Equal(references.ObjectReferences[0].Namespace, "Namespace")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.WorkloadEntries.String())
}
