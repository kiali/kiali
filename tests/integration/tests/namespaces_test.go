package tests

import (
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
)

func TestNamespaces(t *testing.T) {
	assert := assert.New(t)
	namespaces, code, err := kiali.Namespaces()

	assert.Nil(err)
	assert.Equal(200, code)
	assert.NotEmpty(namespaces)
	assert.Contains(namespaces.GetNames(), kiali.BOOKINFO)
}

func TestNamespaceHealthWorkload(t *testing.T) {
	name := "ratings-v1"
	assert := assert.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := kiali.NamespaceWorkloadHealth(kiali.BOOKINFO, params)

	assert.Nil(err)
	assert.Equal(200, code)
	assert.NotNil(health)
	assert.NotNil((*health)[name])
	assert.NotNil((*health)[name].WorkloadStatus)
	assert.NotNil((*health)[name].Requests)
}

func TestInvalidNamespaceHealth(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"rateInterval": "60s"}

	_, code, err := kiali.NamespaceWorkloadHealth("invalid", params)

	assert.NotNil(err)
	assert.NotEqual(200, code)
}

func TestNamespaceHealthApp(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	name := "details"
	assert := assert.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := kiali.NamespaceAppHealth(kiali.BOOKINFO, params)

	assert.Nil(err)
	assert.Equal(200, code)
	assert.NotNil(health)
	assert.NotNil((*health)[name])
	assert.NotEmpty((*health)[name].WorkloadStatuses)
	assert.NotNil((*health)[name].Requests)
}

func TestNamespaceHealthInvalidRate(t *testing.T) {
	assert := assert.New(t)
	params := map[string]string{"rateInterval": "invalid"}

	_, code, err := kiali.NamespaceAppHealth(kiali.BOOKINFO, params)

	assert.NotNil(err)
	assert.NotEqual(200, code)
}

func TestNamespaceHealthService(t *testing.T) {
	name := "details"
	assert := assert.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := kiali.NamespaceServiceHealth(kiali.BOOKINFO, params)

	assert.Nil(err)
	assert.Equal(200, code)
	assert.NotNil(health)
	assert.NotNil((*health)[name])
	assert.NotNil((*health)[name].Requests)
}
