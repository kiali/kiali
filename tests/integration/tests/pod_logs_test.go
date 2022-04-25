package tests

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/tests/integration/utils"
)

func TestLogsContainerIstioProxy(t *testing.T) {
	assert := assert.New(t)
	workloadName := "details-v1"
	lines := 50
	podName, err := utils.FirstPodName(workloadName, utils.BOOKINFO)
	assert.Nil(err)
	assert.NotEmpty(podName)
	params := map[string]string{"container": "istio-proxy", "tailLines": fmt.Sprintf("%d", lines)}
	logs, err := utils.PodLogs(podName, utils.BOOKINFO, params)
	assertLogs(logs, lines, err, assert)
}

func TestLogsContainerDetails(t *testing.T) {
	assert := assert.New(t)
	workloadName := "details-v1"
	lines := 25
	podName, err := utils.FirstPodName(workloadName, utils.BOOKINFO)
	assert.Nil(err)
	assert.NotEmpty(podName)
	params := map[string]string{"container": "details", "tailLines": fmt.Sprintf("%d", lines)}
	logs, err := utils.PodLogs(podName, utils.BOOKINFO, params)
	assertLogs(logs, lines, err, assert)
}

func TestLogsInvalidContainer(t *testing.T) {
	assert := assert.New(t)
	workloadName := "details-v1"
	lines := 25
	podName, err := utils.FirstPodName(workloadName, utils.BOOKINFO)
	assert.Nil(err)
	assert.NotEmpty(podName)
	params := map[string]string{"container": "invalid", "tailLines": fmt.Sprintf("%d", lines)}
	logs, err := utils.PodLogs(podName, utils.BOOKINFO, params)
	assertEmptyLogs(logs, err, assert)
}

func TestLogsInvalidLineCount(t *testing.T) {
	assert := assert.New(t)
	workloadName := "details-v1"
	podName, err := utils.FirstPodName(workloadName, utils.BOOKINFO)
	assert.Nil(err)
	assert.NotEmpty(podName)
	params := map[string]string{"container": "details", "tailLines": "*50"}
	logs, err := utils.PodLogs(podName, utils.BOOKINFO, params)
	assertEmptyLogs(logs, err, assert)
}

func assertEmptyLogs(logs *business.PodLog, err error, assert *assert.Assertions) {
	assert.Nil(err)
	assert.NotNil(logs)
	assert.Empty(logs.Entries)
}

func assertLogs(logs *business.PodLog, lines int, err error, assert *assert.Assertions) {
	assert.Nil(err)
	assert.NotNil(logs)
	assert.True(len(logs.Entries) <= lines)
	for _, entry := range logs.Entries {
		assert.NotNil(entry.Message)
		assert.NotNil(entry.Severity)
		assert.NotNil(entry.Timestamp)
	}
}
