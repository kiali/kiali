package tests

import (
	"strings"
	"testing"
	"time"

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
	name := "details-v1"
	assert := assert.New(t)
	wl, err := utils.WorkloadDetails(name, utils.BOOKINFO)

	assert.Nil(err)
	assert.NotNil(wl)
	assert.Equal(name, wl.Name)
	assert.Equal("Deployment", wl.Type)
	assert.NotNil(wl.Pods)
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
	assert.NotEmpty(wl.Workload.Health)
	assert.NotNil(wl.Workload.Health)
	assert.NotNil(wl.Workload.Health.WorkloadStatus)
	assert.Contains(wl.Workload.Health.WorkloadStatus.Name, name)
	assert.NotNil(wl.Workload.Health.Requests)
	assert.NotNil(wl.Workload.Health.Requests.Outbound)
	assert.NotNil(wl.Workload.Health.Requests.Inbound)
}

func TestDiscoverWorkload(t *testing.T) {
	assert := assert.New(t)
	extraWorkloads := map[string]string{
		"details-v2": "Pod",
		"reviews-v4": "ReplicaSet",
	}

	defer utils.OCDelete(utils.WORKLOADS, utils.BOOKINFO)
	assert.True(utils.OCApply(utils.WORKLOADS, utils.BOOKINFO))
	found := false
	for i := 0; i < 60; i++ {
		wlList, err := utils.WorkloadsList(utils.BOOKINFO)

		assert.Nil(err)
		assert.NotNil(wlList)
		foundWorkloads := 0
		for _, wl := range wlList.Workloads {
			for k, v := range extraWorkloads {
				if k == wl.Name && v == wl.Type {
					foundWorkloads++
				}
			}
		}
		if len(extraWorkloads) == foundWorkloads {
			found = true
			break
		} else {
			time.Sleep(time.Second)
		}
	}
	assert.True(found)
}
