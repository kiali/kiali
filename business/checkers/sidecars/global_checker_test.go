package sidecars

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestSidecarWithoutSelectorOutOfControlPlane(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	validations, valid := GlobalChecker{
		Sidecar: data.CreateSidecar("sidecar1", "bookinfo"),
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}

func TestSidecarWithoutSelectorInControlPlane(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	validations, valid := GlobalChecker{
		Sidecar: data.CreateSidecar("sidecar1", conf.IstioNamespace),
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}

func TestSidecarWithSelectorOutOfControlPlane(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	validations, valid := GlobalChecker{
		Sidecar: data.AddSelectorToSidecar(map[string]interface{}{
			"labels": map[string]interface{}{
				"app": "reviews",
			},
		}, data.CreateSidecar("sidecar1", "bookinfo")),
	}.Check()

	assert.Empty(validations)
	assert.True(valid)
}

func TestSidecarWithSelectorInControlPlane(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	validations, valid := GlobalChecker{
		Sidecar: data.AddSelectorToSidecar(map[string]interface{}{
			"labels": map[string]interface{}{
				"app": "reviews",
			},
		}, data.CreateSidecar("sidecar1", conf.IstioNamespace)),
	}.Check()

	assert.NotEmpty(validations)
	assert.True(valid)

	assert.Len(validations, 1)
	assert.Equal(models.WarningSeverity, validations[0].Severity)
	assert.Equal(models.CheckMessage("sidecar.global.selector"), validations[0].Message)
}
