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
				"labels": map[string] interface{}{
					"app": "reviews",
				},
			}, data.CreateSidecar("sidecar1")),
			data.AddSelectorToSidecar(map[string]interface{}{
				"labels": map[string] interface{}{
					"app": "details",
				},
			}, data.CreateSidecar("sidecar2")),
		},
	}.Check()

	assert.Empty(validations)
}

func TestTwoSidecarsWithoutSelector(t *testing.T) {
	assert := assert.New(t)

	validations := MultiMatchChecker{
		Sidecars: []kubernetes.IstioObject{
			data.CreateSidecar("sidecar1"),
			data.CreateSidecar("sidecar2"),
		},
	}.Check()

	assert.NotEmpty(validations)
	items := []string{"sidecar1", "sidecar2"}
	for _, item := range items {
		validation, ok := validations[models.IstioValidationKey{ObjectType: "sidecar", Namespace: "bookinfo", Name: item}]
		assert.True(ok)
		assert.False(validation.Valid)
		assert.NotEmpty(validation.Checks)
		assert.Equal(models.ErrorSeverity, validation.Checks[0].Severity)
		assert.Equal(models.CheckMessage("sidecar.multimatch"), validation.Checks[0].Message)
		assert.Len(validation.References, 1)
	}
}
