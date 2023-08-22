package tests

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestApplicationsList(t *testing.T) {
	require := require.New(t)
	appList, err := utils.ApplicationsList(utils.BOOKINFO)

	require.Nil(err)
	require.NotEmpty(appList)
	for _, app := range appList.Apps {
		require.NotEmpty(app.Name)
		require.NotNil(app.Health)
		require.NotNil(app.Labels)
		if !strings.Contains(app.Name, "traffic-generator") {
			require.True(app.IstioSidecar)
			require.NotNil(app.IstioReferences)
		}
	}
	require.Equal(utils.BOOKINFO, appList.Namespace.Name)
}

func TestApplicationDetails(t *testing.T) {
	name := "productpage"
	require := require.New(t)
	app, _, err := utils.ApplicationDetails(name, utils.BOOKINFO)

	require.Nil(err)
	require.NotNil(app)
	require.Equal(utils.BOOKINFO, app.Namespace.Name)
	require.Equal(name, app.Name)
	require.NotEmpty(app.Workloads)
	for _, workload := range app.Workloads {
		require.NotEmpty(workload.WorkloadName)
		if !strings.Contains(workload.WorkloadName, "traffic-generator") {
			require.True(workload.IstioSidecar)
		}
	}
	require.NotEmpty(app.ServiceNames)
	for _, serviceName := range app.ServiceNames {
		require.Equal(name, serviceName)
	}
	require.NotNil(app.Runtimes)
	require.NotNil(app.Health)
	require.NotNil(app.Health.Requests)
	require.NotNil(app.Health.Requests.Inbound)
	require.NotNil(app.Health.Requests.Outbound)
	require.NotEmpty(app.Health.WorkloadStatuses)
	for _, wlStatus := range app.Health.WorkloadStatuses {
		require.Contains(wlStatus.Name, name)
	}
}

func TestAppDetailsInvalidName(t *testing.T) {
	name := "invalid"
	require := require.New(t)
	app, code, _ := utils.ApplicationDetails(name, utils.BOOKINFO)
	require.NotEqual(200, code)
	require.Empty(app)
}
