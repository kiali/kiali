package tests

import (
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
)

func TestKialiStatus(t *testing.T) {
	require := require.New(t)
	response, statusCode, err := kiali.KialiStatus()

	require.NoError(err)
	require.True(response)
	require.Equal(200, statusCode)
}

func TestKialiConfig(t *testing.T) {
	require := require.New(t)
	response, statusCode, err := kiali.KialiConfig()

	require.NoError(err)
	require.Equal(200, statusCode)
	require.NotEmpty(response)
}

func TestIstioPermissions(t *testing.T) {
	require := require.New(t)
	response, statusCode, err := kiali.IstioPermissions()

	require.NoError(err)
	require.Equal(200, statusCode)
	require.NotNil(response)
}

func TestJaeger(t *testing.T) {
	if os.Getenv("LPINTEROP") == "true" {
		t.Skip("This test is not supported in LPINTEROP, skipping test...")
	}
	require := require.New(t)
	response, statusCode, err := kiali.Jaeger()

	if statusCode == 200 {
		require.NoError(err)
		require.NotNil(response)
		require.True(response.Enabled)
		require.True(response.Integration)
		require.NotEmpty(response.URL)
	} else {
		require.Fail(fmt.Sprintf("Status code should be '200' but was: %d and error: %s", statusCode, err.Error()))
	}
}

func TestGrafana(t *testing.T) {
	require := require.New(t)
	response, statusCode, err := kiali.Grafana()

	if statusCode == 200 {
		require.NoError(err)
		require.NotNil(response)
		require.NotEmpty(response.ExternalLinks)
		for _, extLink := range response.ExternalLinks {
			require.NotEmpty(extLink.Name)
			require.NotEmpty(extLink.URL)
		}
	} else {
		require.Fail(fmt.Sprintf("Status code should be '200' but was: %d and error: %s", statusCode, err))
	}
}

func TestMeshTls(t *testing.T) {
	require := require.New(t)
	response, statusCode, err := kiali.MeshTls()

	require.NoError(err)
	require.Equal(200, statusCode)
	require.NotNil(response)
	require.NotNil(response.Status)
	require.True(MTLSCorrect(response.Status))
}

func TestNamespaceTls(t *testing.T) {
	require := require.New(t)
	response, statusCode, err := kiali.NamespaceTls(kiali.BOOKINFO)

	require.NoError(err)
	require.Equal(200, statusCode)
	require.NotNil(response)
	require.NotNil(response.Status)
	require.True(MTLSCorrect(response.Status))
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
