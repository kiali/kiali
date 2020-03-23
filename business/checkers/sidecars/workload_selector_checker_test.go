package sidecars

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestPresentWorkloads(t *testing.T) {
	assert := assert.New(t)

	validations, valid := WorkloadSelectorChecker{
		WorkloadList: workloadList(),
		Sidecar: workloadSelectorSidecar("sidecar", map[string]interface{}{
			"app":     "details",
			"version": "v1",
		}),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)

	validations, valid = WorkloadSelectorChecker{
		WorkloadList: workloadList(),
		Sidecar: workloadSelectorSidecar("sidecar", map[string]interface{}{
			"app": "details",
		}),
	}.Check()

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

func workloadSelectorSidecar(name string, selector map[string]interface{}) kubernetes.IstioObject {
	workloadSelector := map[string]interface{}{"labels": selector}
	return data.AddSelectorToSidecar(workloadSelector, data.CreateSidecar(name, "bookinfo"))
}

func testFailureWithWorkloadList(assert *assert.Assertions, selector map[string]interface{}) {
	testFailure(assert, selector, workloadList(), "sidecar.selector.workloadnotfound")
}

func testFailureWithEmptyWorkloadList(assert *assert.Assertions, selector map[string]interface{}) {
	testFailure(assert, selector, data.CreateWorkloadList("test", models.WorkloadListItem{}), "sidecar.selector.workloadnotfound")
}

func testFailure(assert *assert.Assertions, selector map[string]interface{}, wl models.WorkloadList, code string) {
	validations, valid := WorkloadSelectorChecker{
		WorkloadList: wl,
		Sidecar:      workloadSelectorSidecar("sidecar", selector),
	}.Check()

	assert.True(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(validations[0].Message, models.CheckMessage(code))
	assert.Equal(validations[0].Severity, models.WarningSeverity)
	assert.Equal(validations[0].Path, "spec/workloadSelector/labels")
}

func workloadList() models.WorkloadList {
	wli := []models.WorkloadListItem{
		data.CreateWorkloadListItem("details-v1", map[string]string{"app": "details", "version": "v1"}),
		data.CreateWorkloadListItem("details-v2", map[string]string{"app": "details", "version": "v2"}),
		data.CreateWorkloadListItem("details-v3", map[string]string{"app": "details", "version": "v3"}),
	}

	return data.CreateWorkloadList("test", wli...)
}
