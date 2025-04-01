package common

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestPresentWorkloads(t *testing.T) {
	assert := assert.New(t)

	validations, valid := WorkloadSelectorNoWorkloadFoundChecker(
		kubernetes.Sidecars,
		map[string]string{
			"app":     "details",
			"version": "v1",
		},
		workloads(),
	).Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)

	validations, valid = WorkloadSelectorNoWorkloadFoundChecker(
		kubernetes.Sidecars,
		map[string]string{
			"app": "details",
		},
		workloads(),
	).Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestWorkloadNotFound(t *testing.T) {
	assert := assert.New(t)
	testFailureWithWorkloadList(assert, map[string]string{"app": "wrong", "version": "v1"})
	testFailureWithWorkloadList(assert, map[string]string{"app": "details", "version": "wrong"})
	testFailureWithWorkloadList(assert, map[string]string{"app": "wrong"})
	testFailureWithEmptyWorkloadList(assert, map[string]string{"app": "wrong", "version": "v1"})
	testFailureWithEmptyWorkloadList(assert, map[string]string{"app": "details", "version": "wrong"})
	testFailureWithEmptyWorkloadList(assert, map[string]string{"app": "wrong"})
}

func testFailureWithWorkloadList(assert *assert.Assertions, selector map[string]string) {
	testFailure(assert, selector, workloads(), "generic.selector.workloadnotfound")
}

func testFailureWithEmptyWorkloadList(assert *assert.Assertions, selector map[string]string) {
	testFailure(assert, selector, data.CreateWorkloadsPerNamespace([]string{"test"}, models.Workloads{}), "generic.selector.workloadnotfound")
}

func testFailure(assert *assert.Assertions, selector map[string]string, wl map[string]models.Workloads, code string) {
	vals, valid := WorkloadSelectorNoWorkloadFoundChecker(
		kubernetes.Sidecars,
		selector,
		wl,
	).Check()

	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.NoError(validations.ConfirmIstioCheckMessage(code, vals[0]))
	assert.Equal(vals[0].Severity, models.WarningSeverity)
	assert.Equal(vals[0].Path, "spec/workloadSelector/labels")
}
