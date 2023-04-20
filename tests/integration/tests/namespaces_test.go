package tests

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestNamespaces(t *testing.T) {
	assert := assert.New(t)
	namespaces, code, err := utils.Namespaces()

	assert.Nil(err)
	assert.Equal(200, code)
	assert.NotEmpty(namespaces)
	assert.Contains(namespaces.GetNames(), utils.BOOKINFO)
}

func TestNamespaceHealthWorkload(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := utils.NamespaceWorkloadHealth(utils.BOOKINFO, params)

	assert.Nil(err)
	assert.Equal(200, code)
	assert.NotNil(health)
	// Checking for the first app in the list
	assert.NotNil((*health)[0])
	assert.NotNil((*health)[0].Health.WorkloadStatus)
	assert.NotNil((*health)[0].Health.Requests)
}

func TestInvalidNamespaceHealth(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"rateInterval": "60s"}

	_, code, err := utils.NamespaceWorkloadHealth("invalid", params)

	assert.NotNil(err)
	assert.NotEqual(200, code)
}

func TestNamespaceHealthApp(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := utils.NamespaceAppsHealth(utils.BOOKINFO, params)

	assert.Nil(err)
	assert.Equal(200, code)
	assert.NotNil(health)
	// Checking for the first app in the list
	assert.NotNil((*health)[0])
	assert.NotEmpty((*health)[0].Health.WorkloadStatuses)
	assert.NotNil((*health)[0].Health.Requests)
}

func TestNamespaceHealthInvalidRate(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"rateInterval": "invalid"}

	_, code, err := utils.NamespaceAppsHealth(utils.BOOKINFO, params)

	assert.NotNil(err)
	assert.NotEqual(200, code)
}

func TestNamespaceHealthService(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := utils.NamespaceServiceHealth(utils.BOOKINFO, params)

	assert.Nil(err)
	assert.Equal(200, code)
	// Checking for the first app in the list
	assert.NotNil(health)
	assert.NotNil((*health)[0])
	assert.NotNil((*health)[0].Health.Requests)
}
