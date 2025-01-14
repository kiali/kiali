package workloadgroups

import (
	"testing"

	"github.com/stretchr/testify/assert"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestValidLabels(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	validations := DuplicateLabelsChecker{
		Cluster:        config.DefaultClusterID,
		WorkloadGroups: data.CreateWorkloadGroups(*conf),
	}.Check()

	// Well configured objects
	assert.Empty(validations)
}

func TestDuplicateLabels(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	validations := DuplicateLabelsChecker{
		Cluster: config.DefaultClusterID,
		WorkloadGroups: []*networking_v1.WorkloadGroup{
			data.CreateWorkloadGroupWithLabels("bookinfo1", "vm1", map[string]string{"app": "web"}),
			data.CreateWorkloadGroupWithLabels("bookinfo1", "vm2", map[string]string{"app": "web"}),
			data.CreateWorkloadGroupWithLabels("bookinfo1", "vm3", map[string]string{"app": "web3"}),
			data.CreateWorkloadGroupWithLabels("bookinfo2", "vm1", map[string]string{"app": "web"}),
			data.CreateWorkloadGroupWithLabels("bookinfo2", "vm2", map[string]string{"app": "web"}),
			data.CreateWorkloadGroupWithLabels("bookinfo2", "vm3", map[string]string{"app": "web3"}),
		},
	}.Check()

	// 4 duplicated objects
	assert.NotEmpty(validations)
	assert.Equal(4, len(validations))

	assertMultimatchFailure(t, "workloadgroup.labels.duplicate", validations, "bookinfo1", "vm1", []string{"vm2"})
	assertMultimatchFailure(t, "workloadgroup.labels.duplicate", validations, "bookinfo1", "vm2", []string{"vm1"})
	assertMultimatchFailure(t, "workloadgroup.labels.duplicate", validations, "bookinfo2", "vm1", []string{"vm2"})
	assertMultimatchFailure(t, "workloadgroup.labels.duplicate", validations, "bookinfo2", "vm2", []string{"vm1"})
}

func assertMultimatchFailure(t *testing.T, code string, vals models.IstioValidations, namespace, name string, references []string) {
	assert := assert.New(t)

	// Global assertion
	assert.NotEmpty(vals)

	// Assert specific's object validation
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.WorkloadGroups, Name: name, Namespace: namespace, Cluster: config.DefaultClusterID}]
	assert.True(ok)
	assert.False(validation.Valid)

	// Assert object's checks
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage(code, validation.Checks[0]))

	// Assert referenced objects
	assert.Len(validation.References, len(references))
	for i, ref := range references {
		assert.Equal(ref, validation.References[i].Name)
		assert.Equal(kubernetes.WorkloadGroups.String(), validation.References[i].ObjectGVK.String())
	}
}
