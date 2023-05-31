package tests

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils/kiali"
)

func TestAppDashboard(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	assertDashboards("apps", kiali.BOOKINFO, name, assert)
}

func TestServiceDashboard(t *testing.T) {
	assert := assert.New(t)
	name := "details"
	assertDashboards("services", kiali.BOOKINFO, name, assert)
}

func TestWorkloadDashboard(t *testing.T) {
	assert := assert.New(t)
	name := "details-v1"
	assertDashboards("workloads", kiali.BOOKINFO, name, assert)
}

func assertDashboards(objectType, namespace, name string, assert *assert.Assertions) {
	dashboard, err := kiali.ObjectDashboard(namespace, name, objectType)

	assert.Nil(err)
	assert.NotNil(dashboard)
	assert.NotEmpty(dashboard.Charts)
	assert.NotEmpty(dashboard.Aggregations)
}
