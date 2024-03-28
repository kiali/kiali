package tests

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
)

func TestLogsContainerIstioProxy(t *testing.T) {
	require := require.New(t)
	workloadName := "details-v1"
	lines := 50
	podName, err := kiali.FirstPodName(workloadName, kiali.BOOKINFO)
	require.NoError(err)
	require.NotEmpty(podName)
	params := map[string]string{"container": "istio-proxy", "maxLines": fmt.Sprintf("%d", lines)}
	logs, err := kiali.PodLogs(podName, kiali.BOOKINFO, params)
	assertLogs(logs, lines, err, require)
}

func TestLogsContainerDetails(t *testing.T) {
	require := require.New(t)
	workloadName := "details-v1"
	lines := 25
	podName, err := kiali.FirstPodName(workloadName, kiali.BOOKINFO)
	require.NoError(err)
	require.NotEmpty(podName)
	params := map[string]string{"container": "details", "maxLines": fmt.Sprintf("%d", lines)}
	logs, err := kiali.PodLogs(podName, kiali.BOOKINFO, params)
	assertLogs(logs, lines, err, require)
}

func TestLogsInvalidContainer(t *testing.T) {
	require := require.New(t)
	workloadName := "details-v1"
	lines := 25
	podName, err := kiali.FirstPodName(workloadName, kiali.BOOKINFO)
	require.NoError(err)
	require.NotEmpty(podName)
	params := map[string]string{"container": "invalid", "maxLines": fmt.Sprintf("%d", lines)}
	logs, err := kiali.PodLogs(podName, kiali.BOOKINFO, params)
	assertEmptyLogs(logs, err, require)
}

func TestLogsInvalidLineCount(t *testing.T) {
	require := require.New(t)
	workloadName := "details-v1"
	podName, err := kiali.FirstPodName(workloadName, kiali.BOOKINFO)
	require.NoError(err)
	require.NotEmpty(podName)
	params := map[string]string{"container": "details", "maxLines": "*50"}
	logs, err := kiali.PodLogs(podName, kiali.BOOKINFO, params)
	assertEmptyLogs(logs, err, require)
}

func assertEmptyLogs(logs *business.PodLog, err error, require *require.Assertions) {
	require.NoError(err)
	require.NotNil(logs)
	require.Empty(logs.Entries)
}

func assertLogs(logs *business.PodLog, lines int, err error, require *require.Assertions) {
	require.NoError(err)
	require.NotNil(logs)
	require.LessOrEqual(len(logs.Entries), lines)
	for _, entry := range logs.Entries {
		require.NotNil(entry.Message)
		require.NotNil(entry.Severity)
		require.NotNil(entry.Timestamp)
	}
}
