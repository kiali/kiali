package integration

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/util"
)

func TestKialiStatus(t *testing.T) {
	assert := assert.New(t)
	response, statusCode, err := util.KialiStatus()

	assert.Nil(err)
	assert.True(response)
	assert.Equal(200, statusCode)
}
