package sidecars

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestTwoSidecarsWithSelector(t *testing.T) {
	assert := assert.New(t)

	validations := MultiMatchChecker{
		Sidecars: []kubernetes.IstioObject{
			data.AddSelectorToSidecar(map[string]interface{}{
				"labels": map[string]interface{}{
					"app": "reviews",
				},
			}, data.CreateSidecar("sidecar1")),
			data.AddSelectorToSidecar(map[string]interface{}{
				"labels": map[string]interface{}{
					"app": "details",
				},
			}, data.CreateSidecar("sidecar2")),
		},
	}.Check()

	assert.Empty(validations)
}

func TestTwoSidecarsWithoutSelector(t *testing.T) {
	validations := MultiMatchChecker{
		Sidecars: []kubernetes.IstioObject{
			data.CreateSidecar("sidecar1"),
			data.CreateSidecar("sidecar2"),
		},
	}.Check()

	assertMultimatchFailure(t, validations, "sidecar1", "sidecar2")
	assertMultimatchFailure(t, validations, "sidecar2", "sidecar1")
}

func assertMultimatchFailure(t *testing.T, validations models.IstioValidations, item, reference string) {
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
	assert.Equal(models.CheckMessage("sidecar.multimatch"), validation.Checks[0].Message)

	// Assert referenced objects
	assert.Len(validation.References, 1)
	assert.Equal(reference, validation.References[0].Name)
}
