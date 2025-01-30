package workloadgroups

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestPresentServiceAccount(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	validations, valid := ServiceAccountsChecker{
		Cluster:         config.DefaultClusterID,
		ServiceAccounts: map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}},
		WorkloadGroup:   data.CreateWorkloadGroupWithSA("default"),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestEmptyServiceAccount(t *testing.T) {
	assert := assert.New(t)

	validations, valid := ServiceAccountsChecker{
		Cluster:         config.DefaultClusterID,
		ServiceAccounts: map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}},
		WorkloadGroup:   data.CreateWorkloadGroupWithSA(""),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestNotPresentServiceAccount(t *testing.T) {
	assert := assert.New(t)

	vals, valid := ServiceAccountsChecker{
		Cluster:         config.DefaultClusterID,
		ServiceAccounts: map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}},
		WorkloadGroup:   data.CreateWorkloadGroupWithSA("wrong"),
	}.Check()

	// Wrong SA is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("workloadgroup.template.serviceaccount.notfound", vals[0]))
	assert.Equal("spec/template/serviceAccount", vals[0].Path)
}

func TestDifferentNameapaceServiceAccount(t *testing.T) {
	assert := assert.New(t)

	vals, valid := ServiceAccountsChecker{
		Cluster:         config.DefaultClusterID,
		ServiceAccounts: map[string][]string{config.DefaultClusterID: {"cluster.local/ns/default/sa/default", "cluster.local/ns/bookinfo/sa/test"}},
		WorkloadGroup:   data.CreateWorkloadGroupWithSA("default"),
	}.Check()

	// Wrong SA is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("workloadgroup.template.serviceaccount.notfound", vals[0]))
	assert.Equal("spec/template/serviceAccount", vals[0].Path)
}

func TestEmptyServiceAccounts(t *testing.T) {
	assert := assert.New(t)

	vals, valid := ServiceAccountsChecker{
		Cluster:         config.DefaultClusterID,
		ServiceAccounts: map[string][]string{},
		WorkloadGroup:   data.CreateWorkloadGroupWithSA("wrong"),
	}.Check()

	// Wrong SA is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("workloadgroup.template.serviceaccount.notfound", vals[0]))
	assert.Equal("spec/template/serviceAccount", vals[0].Path)
}
