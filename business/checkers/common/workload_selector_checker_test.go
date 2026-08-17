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
		"bookinfo",
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
		"bookinfo",
		map[string]string{
			"app": "details",
		},
		workloads(),
	).Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestWorkloadNotFoundIgnoresOtherNamespaces(t *testing.T) {
	assert := assert.New(t)
	// details exists only in bookinfo2; policy namespace bookinfo should still warn.
	wl := map[string]models.Workloads{
		"bookinfo": models.Workloads{},
		"bookinfo2": models.Workloads{
			data.CreateWorkload("bookinfo2", "details-v1", map[string]string{"app": "details", "version": "v1"}),
		},
	}
	vals, valid := WorkloadSelectorNoWorkloadFoundChecker(
		kubernetes.Sidecars,
		"bookinfo",
		map[string]string{"app": "details"},
		wl,
	).Check()

	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
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
	testFailure(assert, selector, workloads(), "generic.selector.workloadnotfound", "bookinfo")
}

func testFailureWithEmptyWorkloadList(assert *assert.Assertions, selector map[string]string) {
	testFailure(assert, selector, data.CreateWorkloadsPerNamespace([]string{"test"}, models.Workloads{}), "generic.selector.workloadnotfound", "test")
}

func testFailure(assert *assert.Assertions, selector map[string]string, wl map[string]models.Workloads, code, namespace string) {
	vals, valid := WorkloadSelectorNoWorkloadFoundChecker(
		kubernetes.Sidecars,
		namespace,
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
