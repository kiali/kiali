package tests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestNamespaces(t *testing.T) {
	require := require.New(t)
	namespaces, code, err := utils.Namespaces()

	require.Nil(err)
	require.Equal(200, code)
	require.NotEmpty(namespaces)
	require.Contains(namespaces.GetNames(), utils.BOOKINFO)
}

func TestNamespaceHealthWorkload(t *testing.T) {
	name := "ratings-v1"
	require := require.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := utils.NamespaceWorkloadHealth(utils.BOOKINFO, params)

	require.Nil(err)
	require.Equal(200, code)
	require.NotNil(health)
	require.NotNil((*health)[name])
	require.NotNil((*health)[name].WorkloadStatus)
	require.NotNil((*health)[name].Requests)
}

func TestInvalidNamespaceHealth(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"rateInterval": "60s"}

	_, code, err := utils.NamespaceWorkloadHealth("invalid", params)

	require.NotNil(err)
	require.NotEqual(200, code)
}

func TestNamespaceHealthApp(t *testing.T) {
	name := "details"
	require := require.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := utils.NamespaceAppHealth(utils.BOOKINFO, params)

	require.Nil(err)
	require.Equal(200, code)
	require.NotNil(health)
	require.NotNil((*health)[name])
	require.NotEmpty((*health)[name].WorkloadStatuses)
	require.NotNil((*health)[name].Requests)
}

func TestNamespaceHealthInvalidRate(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"rateInterval": "invalid"}

	_, code, err := utils.NamespaceAppHealth(utils.BOOKINFO, params)

	require.NotNil(err)
	require.NotEqual(200, code)
}

func TestNamespaceHealthService(t *testing.T) {
	name := "details"
	require := require.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := utils.NamespaceServiceHealth(utils.BOOKINFO, params)

	require.Nil(err)
	require.Equal(200, code)
	require.NotNil(health)
	require.NotNil((*health)[name])
	require.NotNil((*health)[name].Requests)
}
