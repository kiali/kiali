package tests

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestApplicationsList(t *testing.T) {
	assert := assert.New(t)
	appList, err := utils.ApplicationsList(utils.BOOKINFO)

	assert.Nil(err)
	assert.NotEmpty(appList)
	for _, app := range appList.Apps {
		assert.NotEmpty(app.Name)
		assert.NotNil(app.Health)
		assert.NotNil(app.Labels)
		if !strings.Contains(app.Name, "traffic-generator") {
			assert.True(app.IstioSidecar)
			assert.NotNil(app.IstioReferences)
		}
	}
	assert.Equal(utils.BOOKINFO, appList.Namespace.Name)
}

func TestApplicationDetails(t *testing.T) {
	name := "productpage"
	assert := assert.New(t)
	app, err := utils.ApplicationDetails(name, utils.BOOKINFO)

	assert.Nil(err)
	assert.NotNil(app)
	assert.Equal(utils.BOOKINFO, app.Namespace.Name)
	assert.Equal(name, app.Name)
	assert.NotEmpty(app.Workloads)
	for _, workload := range app.Workloads {
		assert.NotEmpty(workload.WorkloadName)
		if !strings.Contains(workload.WorkloadName, "traffic-generator") {
			assert.True(workload.IstioSidecar)
		}
	}
	assert.NotEmpty(app.ServiceNames)
	for _, serviceName := range app.ServiceNames {
		assert.Equal(name, serviceName)
	}
	assert.NotNil(app.Runtimes)
	assert.NotNil(app.Health)
	assert.NotNil(app.Health.Requests)
	assert.NotNil(app.Health.Requests.Inbound)
	assert.NotNil(app.Health.Requests.Outbound)
	assert.NotEmpty(app.Health.WorkloadStatuses)
	for _, wlStatus := range app.Health.WorkloadStatuses {
		assert.Contains(wlStatus.Name, name)
	}
}
