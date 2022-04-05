package tests

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestWorkloadsList(t *testing.T) {
	assert := assert.New(t)
	wlList, err := utils.WorkloadsList(utils.BOOKINFO)

	assert.Nil(err)
	assert.NotEmpty(wlList)
	for _, wl := range wlList.Workloads {
		assert.NotEmpty(wl.Name)
		assert.NotNil(wl.Health)
		assert.NotNil(wl.Labels)
		if !strings.Contains(wl.Name, "traffic-generator") {
			assert.True(wl.IstioSidecar)
			assert.NotNil(wl.IstioReferences)
		}
	}
	assert.NotNil(wlList.Validations)
	assert.Equal(utils.BOOKINFO, wlList.Namespace.Name)
}

func TestWorkloadDetails(t *testing.T) {
	name := "productpage-v1"
	assert := assert.New(t)
	wl, err := utils.WorkloadDetails(name, utils.BOOKINFO)

	assert.Nil(err)
	assert.NotNil(wl)
	assert.Equal(name, wl.Name)
	assert.NotEmpty(wl.Pods)
	for _, pod := range wl.Pods {
		assert.NotEmpty(pod.Status)
		assert.NotEmpty(pod.Name)

	}
	assert.NotEmpty(wl.Services)
	for _, wl := range wl.Services {
		assert.Equal(utils.BOOKINFO, wl.Namespace)
	}
	assert.NotEmpty(wl.Runtimes)
	assert.NotEmpty(wl.Validations)
	assert.NotEmpty(wl.Health)
}
