package common

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestTwoSidecarsWithSelector(t *testing.T) {
	assert := assert.New(t)

	validations := WorkloadSelectorMultiMatchChecker(
		"sidecar",
		[]kubernetes.IstioObject{
			data.AddSelectorToSidecar(map[string]interface{}{
				"labels": map[string]interface{}{
					"app": "reviews",
				},
			}, data.CreateSidecar("sidecar1", "bookinfo")),
			data.AddSelectorToSidecar(map[string]interface{}{
				"labels": map[string]interface{}{
					"app": "details",
				},
			}, data.CreateSidecar("sidecar2", "bookinfo")),
		},
		workloadList(),
	).Check()

	assert.Empty(validations)
}

func TestTwoSidecarsWithoutSelector(t *testing.T) {
	validations := WorkloadSelectorMultiMatchChecker(
		"sidecar",
		[]kubernetes.IstioObject{
			data.CreateSidecar("sidecar1", "bookinfo"),
			data.CreateSidecar("sidecar2", "bookinfo"),
		},
		workloadList(),
	).Check()

	assertMultimatchFailure(t, "generic.multimatch.selectorless", validations, "sidecar1", []string{"sidecar2"})
	assertMultimatchFailure(t, "generic.multimatch.selectorless", validations, "sidecar2", []string{"sidecar1"})
}

func TestTwoSidecarsTargetingOneDeployment(t *testing.T) {
	validations := GenericMultiMatchChecker{
		SubjectType: "sidecar",
		Subjects: []kubernetes.IstioObject{
			workloadSelectorSidecar("sidecar1", map[string]interface{}{"app": "details", "version": "v1"}),
			workloadSelectorSidecar("sidecar2", map[string]interface{}{"app": "reviews", "version": "v1"}),
			workloadSelectorSidecar("sidecar3", map[string]interface{}{"app": "details"}),
			workloadSelectorSidecar("sidecar4", map[string]interface{}{"version": "v1"}),
		},
		WorkloadList:      workloadList(),
		HasSelector:       HasWorkloadSelector,
		GetSelectorLabels: GetWorkloadSelectorLabels,
		Path:              "spec/workloadSelector",
	}.Check()

	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar1", []string{"sidecar3", "sidecar4"})
	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar3", []string{"sidecar1", "sidecar4"})
	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar4", []string{"sidecar1", "sidecar3"})
}

func assertMultimatchFailure(t *testing.T, code string, validations models.IstioValidations, item string, references []string) {
	assert := assert.New(t)

	// Global assertion
	assert.NotEmpty(validations)

	// Assert specific's object validation
	validation, ok := validations[models.IstioValidationKey{ObjectType: "sidecar", Namespace: "bookinfo", Name: item}]
	assert.True(ok)
	assert.False(validation.Valid)

	// Assert object's checks
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.ErrorSeverity, validation.Checks[0].Severity)
	assert.NoError(ConfirmIstioCheckMessage(code, validation.Checks[0]))

	// Assert referenced objects
	assert.Len(validation.References, len(references))
	for i, ref := range references {
		assert.Equal(ref, validation.References[i].Name)
		assert.Equal("sidecar", validation.References[i].ObjectType)
	}
}

func workloadList() models.WorkloadList {
	wli := []models.WorkloadListItem{
		data.CreateWorkloadListItem("details-v1", map[string]string{"app": "details", "version": "v1"}),
		data.CreateWorkloadListItem("details-v2", map[string]string{"app": "details", "version": "v2"}),
		data.CreateWorkloadListItem("details-v3", map[string]string{"app": "details", "version": "v3"}),
	}

	return data.CreateWorkloadList("test", wli...)
}

func workloadSelectorSidecar(name string, selector map[string]interface{}) kubernetes.IstioObject {
	workloadSelector := map[string]interface{}{"labels": selector}
	return data.AddSelectorToSidecar(workloadSelector, data.CreateSidecar(name, "bookinfo"))
}
