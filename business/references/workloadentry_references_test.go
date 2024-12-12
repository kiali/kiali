package references

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"

	"github.com/stretchr/testify/assert"
)

func prepareTestForWorkloadEntry(name string) models.IstioReferences {
	weReferences := WorkloadEntryReferences{
		WorkloadGroups:  data.CreateWorkloadGroups(*config.NewConfig()),
		WorkloadEntries: data.CreateWorkloadEntries(*config.NewConfig()),
	}
	return *weReferences.References()[models.IstioReferenceKey{ObjectGVK: kubernetes.WorkloadEntries, Namespace: "Namespace", Name: name}]
}

func TestWorkloadEntryReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForWorkloadEntry("ratings-vm")

	// Check WG references
	assert.Len(references.ObjectReferences, 1)
	assert.Equal(references.ObjectReferences[0].Name, "ratings-vm")
	assert.Equal(references.ObjectReferences[0].Namespace, "Namespace")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.WorkloadGroups.String())
}
