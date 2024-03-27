package tests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
)

func TestNamespaces(t *testing.T) {
	require := require.New(t)
	namespaces, code, err := kiali.Namespaces()

	require.NoError(err)
	require.Equal(200, code)
	require.NotEmpty(namespaces)
	require.Contains(namespaces.GetNames(), kiali.BOOKINFO)
}

func TestNamespaceHealthWorkload(t *testing.T) {
	name := "ratings-v1"
	require := require.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := kiali.NamespaceWorkloadHealth(kiali.BOOKINFO, params)

	require.NoError(err)
	require.Equal(200, code)
	require.NotNil(health)
	require.NotNil((*health)[name])
	require.NotNil((*health)[name].WorkloadStatus)
	require.NotNil((*health)[name].Requests)
}

func TestInvalidNamespaceHealth(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"rateInterval": "60s"}

	_, code, err := kiali.NamespaceWorkloadHealth("invalid", params)

	// namespace not found instead of internal server error
	require.Error(err)
	require.Contains(err.Error(), "namespaces \\\"invalid\\\" not found")
	require.NotEqual(200, code)
}

func TestNamespaceHealthApp(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	name := "details"
	require := require.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := kiali.NamespaceAppHealth(kiali.BOOKINFO, params)

	require.NoError(err)
	require.Equal(200, code)
	require.NotNil(health)
	require.NotNil((*health)[name])
	require.NotEmpty((*health)[name].WorkloadStatuses)
	require.NotNil((*health)[name].Requests)
}

func TestNamespaceHealthInvalidRate(t *testing.T) {
	require := require.New(t)
	params := map[string]string{"rateInterval": "invalid"}

	_, code, err := kiali.NamespaceAppHealth(kiali.BOOKINFO, params)

	// 500 and error message which is not failing in unmarshalling
	require.Error(err)
	require.Contains(err.Error(), "not a valid duration string: \"invalid\"")
	require.NotEqual(200, code)
}

func TestNamespaceHealthService(t *testing.T) {
	name := "details"
	require := require.New(t)
	params := map[string]string{"rateInterval": "60s"}

	health, code, err := kiali.NamespaceServiceHealth(kiali.BOOKINFO, params)

	require.NoError(err)
	require.Equal(200, code)
	require.NotNil(health)
	require.NotNil((*health)[name])
	require.NotNil((*health)[name].Requests)
}
