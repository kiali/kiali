package tests

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestAppDashboard(t *testing.T) {
	require := require.New(t)
	name := "details"
	requireDashboards("apps", utils.BOOKINFO, name, require)
}

func TestServiceDashboard(t *testing.T) {
	require := require.New(t)
	name := "details"
	requireDashboards("services", utils.BOOKINFO, name, require)
}

func TestWorkloadDashboard(t *testing.T) {
	require := require.New(t)
	name := "details-v1"
	requireDashboards("workloads", utils.BOOKINFO, name, require)
}

func requireDashboards(objectType, namespace, name string, require *require.Assertions) {
	dashboard, err := utils.ObjectDashboard(namespace, name, objectType)

	require.Nil(err)
	require.NotNil(dashboard)
	require.NotEmpty(dashboard.Charts)
	require.NotEmpty(dashboard.Aggregations)
}
