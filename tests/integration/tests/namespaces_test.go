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

	health, code, err := kiali.NamespaceWorkloadHealth("invalid", params)

	// API returns empty health map for invalid/inaccessible namespaces instead of error
	require.NoError(err)
	require.Equal(200, code)
	require.NotNil(health)
	require.Empty(*health)
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

	health, code, err := kiali.NamespaceAppHealth(kiali.BOOKINFO, params)

	// With health cache enabled, invalid rateInterval is ignored and cached data is returned.
	// The parameter is not validated when serving from cache.
	require.NoError(err)
	require.Equal(200, code)
	require.NotNil(health)
	// Health may contain cached data for bookinfo namespace - no assertion on contents
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
