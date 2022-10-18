package tests

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/tests/integration/utils"
)

func TestKialiStatus(t *testing.T) {
	assert := assert.New(t)
	response, statusCode, err := utils.KialiStatus()

	assert.Nil(err)
	assert.True(response)
	assert.Equal(200, statusCode)
}

func TestKialiConfig(t *testing.T) {
	assert := assert.New(t)
	response, statusCode, err := utils.KialiConfig()

	assert.Nil(err)
	assert.Equal(200, statusCode)
	assert.NotEmpty(response)
}

func TestIstioPermissions(t *testing.T) {
	assert := assert.New(t)
	response, statusCode, err := utils.IstioPermissions()

	assert.Nil(err)
	assert.Equal(200, statusCode)
	assert.NotNil(response)
}

func TestJaeger(t *testing.T) {
	assert := assert.New(t)
	response, statusCode, err := utils.Jaeger()

	if statusCode == 200 {
		assert.Nil(err)
		assert.NotNil(response)
		assert.True(response.Enabled)
		assert.True(response.Integration)
		assert.NotEmpty(response.URL)
	} else {
		assert.Fail(fmt.Sprintf("Status code should be '200' but was: %d and error: %s", statusCode, err.Error()))
	}
}

func TestGrafana(t *testing.T) {
	assert := assert.New(t)
	response, statusCode, err := utils.Grafana()

	if statusCode == 200 {
		assert.Nil(err)
		assert.NotNil(response)
		assert.NotEmpty(response.ExternalLinks)
		for _, extLink := range response.ExternalLinks {
			assert.NotEmpty(extLink.Name)
			assert.NotEmpty(extLink.URL)
		}
	} else {
		assert.Fail(fmt.Sprintf("Status code should be '200' but was: %d and error: %s", statusCode, err))
	}
}

func TestMeshTls(t *testing.T) {
	assert := assert.New(t)
	response, statusCode, err := utils.MeshTls()

	assert.Nil(err)
	assert.Equal(200, statusCode)
	assert.NotNil(response)
	assert.NotNil(response.Status)
	assert.True(MTLSCorrect(response.Status))
}

func TestNamespaceTls(t *testing.T) {
	assert := assert.New(t)
	response, statusCode, err := utils.NamespaceTls(utils.BOOKINFO)

	assert.Nil(err)
	assert.Equal(200, statusCode)
	assert.NotNil(response)
	assert.NotNil(response.Status)
	assert.True(MTLSCorrect(response.Status))
}

func MTLSCorrect(status string) bool {
	switch status {
	case
		business.MTLSEnabled, business.MTLSNotEnabled, business.MTLSPartiallyEnabled, business.MTLSDisabled:
		return true
	default:
		return false
	}
}
