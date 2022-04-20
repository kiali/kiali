package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestTwoSidecarsWithSelector(t *testing.T) {
	assert := assert.New(t)

	validations := SidecarSelectorMultiMatchChecker(
		"sidecar",
		[]networking_v1beta1.Sidecar{
			*data.AddSelectorToSidecar(map[string]string{
				"app": "reviews",
			}, data.CreateSidecar("sidecar1", "bookinfo")),
			*data.AddSelectorToSidecar(map[string]string{
				"app": "details",
			}, data.CreateSidecar("sidecar2", "bookinfo")),
		},
		workloadList(),
	).Check()

	assert.Empty(validations)
}

func TestTwoSidecarsWithoutSelector(t *testing.T) {
	validations := SidecarSelectorMultiMatchChecker(
		"sidecar",
		[]networking_v1beta1.Sidecar{
			*data.CreateSidecar("sidecar1", "bookinfo"),
			*data.CreateSidecar("sidecar2", "bookinfo"),
		},
		workloadList(),
	).Check()

	assertMultimatchFailure(t, "generic.multimatch.selectorless", validations, "sidecar1", []string{"sidecar2"})
	assertMultimatchFailure(t, "generic.multimatch.selectorless", validations, "sidecar2", []string{"sidecar1"})
}

func TestTwoSidecarsTargetingOneDeployment(t *testing.T) {
	sidecars := []networking_v1beta1.Sidecar{
		*data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar1", "bookinfo")),
		*data.AddSelectorToSidecar(map[string]string{
			"app":     "reviews",
			"version": "v1",
		}, data.CreateSidecar("sidecar2", "bookinfo")),
		*data.AddSelectorToSidecar(map[string]string{
			"app": "details",
		}, data.CreateSidecar("sidecar3", "bookinfo")),
		*data.AddSelectorToSidecar(map[string]string{
			"version": "v1",
		}, data.CreateSidecar("sidecar4", "bookinfo")),
	}
	validations := SidecarSelectorMultiMatchChecker(
		"sidecar",
		sidecars,
		workloadList(),
	).Check()

	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar1", []string{"sidecar3", "sidecar4"})
	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar3", []string{"sidecar1", "sidecar4"})
	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar4", []string{"sidecar1", "sidecar3"})
}

func TestSidecarsCrossNamespaces(t *testing.T) {
	sidecars := []networking_v1beta1.Sidecar{
		*data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar1", "bookinfo")),
		*data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar2", "bookinfo")),
		*data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar3", "bookinfo2")),
		*data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar4", "bookinfo2")),
	}
	validations := SidecarSelectorMultiMatchChecker(
		"sidecar",
		sidecars,
		workloadList(),
	).Check()

	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar1", []string{"sidecar2"})
	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar2", []string{"sidecar1"})
}

func TestSidecarsDifferentNamespaces(t *testing.T) {
	assert := assert.New(t)

	sidecars := []networking_v1beta1.Sidecar{
		*data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar1", "bookinfo")),
		*data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar2", "bookinfo2")),
		*data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar3", "bookinfo3")),
		*data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar4", "bookinfo4")),
	}
	validations := SidecarSelectorMultiMatchChecker(
		"sidecar",
		sidecars,
		workloadList(),
	).Check()

	assert.Empty(validations)
}

func assertMultimatchFailure(t *testing.T, code string, vals models.IstioValidations, item string, references []string) {
	assert := assert.New(t)

	// Global assertion
	assert.NotEmpty(vals)

	// Assert specific's object validation
	validation, ok := vals[models.IstioValidationKey{ObjectType: "sidecar", Namespace: "bookinfo", Name: item}]
	assert.True(ok)
	assert.False(validation.Valid)

	// Assert object's checks
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.ErrorSeverity, validation.Checks[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage(code, validation.Checks[0]))

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

	return data.CreateWorkloadList("bookinfo", wli...)
}
