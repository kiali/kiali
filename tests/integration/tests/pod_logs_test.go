package tests

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/tests/integration/utils"
)

func TestLogsContainerIstioProxy(t *testing.T) {
	require := require.New(t)
	workloadName := "details-v1"
	lines := 50
	podName, err := utils.FirstPodName(workloadName, utils.BOOKINFO)
	require.Nil(err)
	require.NotEmpty(podName)
	params := map[string]string{"container": "istio-proxy", "maxLines": fmt.Sprintf("%d", lines)}
	logs, err := utils.PodLogs(podName, utils.BOOKINFO, params)
	requireLogs(logs, lines, err, require)
}

func TestLogsContainerDetails(t *testing.T) {
	require := require.New(t)
	workloadName := "details-v1"
	lines := 25
	podName, err := utils.FirstPodName(workloadName, utils.BOOKINFO)
	require.Nil(err)
	require.NotEmpty(podName)
	params := map[string]string{"container": "details", "maxLines": fmt.Sprintf("%d", lines)}
	logs, err := utils.PodLogs(podName, utils.BOOKINFO, params)
	requireLogs(logs, lines, err, require)
}

func TestLogsInvalidContainer(t *testing.T) {
	require := require.New(t)
	workloadName := "details-v1"
	lines := 25
	podName, err := utils.FirstPodName(workloadName, utils.BOOKINFO)
	require.Nil(err)
	require.NotEmpty(podName)
	params := map[string]string{"container": "invalid", "maxLines": fmt.Sprintf("%d", lines)}
	logs, err := utils.PodLogs(podName, utils.BOOKINFO, params)
	requireEmptyLogs(logs, err, require)
}

func TestLogsInvalidLineCount(t *testing.T) {
	require := require.New(t)
	workloadName := "details-v1"
	podName, err := utils.FirstPodName(workloadName, utils.BOOKINFO)
	require.Nil(err)
	require.NotEmpty(podName)
	params := map[string]string{"container": "details", "maxLines": "*50"}
	logs, err := utils.PodLogs(podName, utils.BOOKINFO, params)
	requireEmptyLogs(logs, err, require)
}

func requireEmptyLogs(logs *business.PodLog, err error, require *require.Assertions) {
	require.Nil(err)
	require.NotNil(logs)
	require.Empty(logs.Entries)
}

func requireLogs(logs *business.PodLog, lines int, err error, require *require.Assertions) {
	require.Nil(err)
	require.NotNil(logs)
	require.LessOrEqual(len(logs.Entries), lines)
	for _, entry := range logs.Entries {
		require.NotNil(entry.Message)
		require.NotNil(entry.Severity)
		require.NotNil(entry.Timestamp)
	}
}
