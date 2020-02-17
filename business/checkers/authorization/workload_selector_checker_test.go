package authorization

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
		AuthorizationPolicy: workloadSelectorAuthPolicy(map[string]interface{}{
			"app":     "details",
			"version": "v1",
		}),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)

	validations, valid = WorkloadSelectorChecker{
		WorkloadList: workloadList(),
		AuthorizationPolicy: workloadSelectorAuthPolicy(map[string]interface{}{
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

func workloadSelectorAuthPolicy(selector map[string]interface{}) kubernetes.IstioObject {
	methods := []interface{}{"GET", "PUT", "PATCH"}
	nss := []interface{}{"bookinfo"}
	return data.CreateAuthorizationPolicy(nss, methods, selector)
}

func testFailureWithWorkloadList(assert *assert.Assertions, selector map[string]interface{}) {
	testFailure(assert, selector, workloadList())
}

func testFailureWithEmptyWorkloadList(assert *assert.Assertions, selector map[string]interface{}) {
	testFailure(assert, selector, data.CreateWorkloadList("test", models.WorkloadListItem{}))
}

func testFailure(assert *assert.Assertions, selector map[string]interface{}, wl models.WorkloadList) {
	validations, valid := WorkloadSelectorChecker{
		WorkloadList:        wl,
		AuthorizationPolicy: workloadSelectorAuthPolicy(selector),
	}.Check()

	assert.True(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(validations[0].Message, models.CheckMessage("authorizationpolicy.selector.workloadnotfound"))
	assert.Equal(validations[0].Severity, models.WarningSeverity)
	assert.Equal(validations[0].Path, "spec/selector")
}

func workloadList() models.WorkloadList {
	return data.CreateWorkloadList("test", data.CreateWorkloadListItem("details", map[string]string{"app": "details", "version": "v1"}))
}
