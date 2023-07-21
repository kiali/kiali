package tests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/tests/integration/utils/kiali"
)

func TestAppDashboard(t *testing.T) {
	require := require.New(t)
	name := "details"
	assertDashboards("apps", kiali.BOOKINFO, name, require)
}

func TestServiceDashboard(t *testing.T) {
	require := require.New(t)
	name := "details"
	assertDashboards("services", kiali.BOOKINFO, name, require)
}

func TestWorkloadDashboard(t *testing.T) {
	require := require.New(t)
	name := "details-v1"
	assertDashboards("workloads", kiali.BOOKINFO, name, require)
}

func assertDashboards(objectType, namespace, name string, require *require.Assertions) {
	dashboard, err := kiali.ObjectDashboard(namespace, name, objectType)

	require.NoError(err)
	require.NotNil(dashboard)
	require.NotEmpty(dashboard.Charts)
	require.NotEmpty(dashboard.Aggregations)
}
