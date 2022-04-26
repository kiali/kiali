package tests

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestNamespaceHealthWorkload(t *testing.T) {
	//name := "ratings-v1"
	assert := assert.New(t)
	params := map[string]string{"type": "workload", "rateInterval":"60s"}

	health, _, err := utils.NamespaceHealth(utils.BOOKINFO, params)

	assert.Nil(err)
	assert.NotNil(health)
}
