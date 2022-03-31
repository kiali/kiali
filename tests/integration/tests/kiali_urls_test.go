package tests

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestKialiStatus(t *testing.T) {
	assert := assert.New(t)
	response, statusCode, err := utils.KialiStatus()

	assert.Nil(err)
	assert.True(response)
	assert.Equal(200, statusCode)
}
