package common

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestPresentWorkloads(t *testing.T) {
	assert := assert.New(t)

	validations, valid := WorkloadSelectorNoWorkloadFoundChecker(
		"sidecar",
		workloadSelectorSidecar("sidecar", map[string]interface{}{
			"app":     "details",
			"version": "v1",
		}),
		workloadList(),
	).Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)

	validations, valid = WorkloadSelectorNoWorkloadFoundChecker(
		"sidecar",
		workloadSelectorSidecar("sidecar", map[string]interface{}{
			"app": "details",
		}),
		workloadList(),
	).Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestWorkloadNotFound(t *testing.T) {
	assert := assert.New(t)
	testFailureWithWorkloadList(assert, map[string]interface{}{"app": "wrong", "version": "v1"})
	testFailureWithWorkloadList(assert, map[string]interface{}{"app": "details", "version": "wrong"})
	testFailureWithWorkloadList(assert, map[string]interface{}{"app": "wrong"})
	testFailureWithEmptyWorkloadList(assert, map[string]interface{}{"app": "wrong", "version": "v1"})
	testFailureWithEmptyWorkloadList(assert, map[string]interface{}{"app": "details", "version": "wrong"})
	testFailureWithEmptyWorkloadList(assert, map[string]interface{}{"app": "wrong"})
}

func testFailureWithWorkloadList(assert *assert.Assertions, selector map[string]interface{}) {
	testFailure(assert, selector, workloadList(), "generic.selector.workloadnotfound")
}

func testFailureWithEmptyWorkloadList(assert *assert.Assertions, selector map[string]interface{}) {
	testFailure(assert, selector, data.CreateWorkloadList("test", models.WorkloadListItem{}), "generic.selector.workloadnotfound")
}

func testFailure(assert *assert.Assertions, selector map[string]interface{}, wl models.WorkloadList, code string) {
	vals, valid := WorkloadSelectorNoWorkloadFoundChecker(
		"sidecar",
		workloadSelectorSidecar("sidecar", selector),
		wl,
	).Check()

	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.NoError(validations.ConfirmIstioCheckMessage(code, vals[0]))
	assert.Equal(vals[0].Severity, models.WarningSeverity)
	assert.Equal(vals[0].Path, "spec/workloadSelector/labels")
}
