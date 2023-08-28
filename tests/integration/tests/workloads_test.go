package tests

import (
	"path"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tools/cmd"
)

func TestWorkloadsList(t *testing.T) {
	require := require.New(t)
	wlList, err := utils.WorkloadsList(utils.BOOKINFO)

	require.Nil(err)
	require.NotEmpty(wlList)
	for _, wl := range wlList.Workloads {
		require.NotEmpty(wl.Name)
		require.NotNil(wl.Health)
		require.NotNil(wl.Labels)
		if !strings.Contains(wl.Name, "traffic-generator") {
			require.True(wl.IstioSidecar)
			require.NotNil(wl.IstioReferences)
		}
	}
	require.NotNil(wlList.Validations)
	require.Equal(utils.BOOKINFO, wlList.Namespace.Name)
}

func TestWorkloadDetails(t *testing.T) {
	name := "details-v1"
	require := require.New(t)
	wl, _, err := utils.WorkloadDetails(name, utils.BOOKINFO)

	require.Nil(err)
	require.NotNil(wl)
	require.Equal(name, wl.Name)
	require.Equal("Deployment", wl.Type)
	require.NotNil(wl.Pods)
	for _, pod := range wl.Pods {
		require.NotEmpty(pod.Status)
		require.NotEmpty(pod.Name)

	}
	require.NotEmpty(wl.Services)
	for _, wl := range wl.Services {
		require.Equal(utils.BOOKINFO, wl.Namespace)
	}
	require.NotEmpty(wl.Runtimes)
	require.NotEmpty(wl.Validations)
	require.NotEmpty(wl.Workload.Health)
	require.NotNil(wl.Workload.Health)
	require.NotNil(wl.Workload.Health.WorkloadStatus)
	require.Contains(wl.Workload.Health.WorkloadStatus.Name, name)
	require.NotNil(wl.Workload.Health.Requests)
	require.NotNil(wl.Workload.Health.Requests.Outbound)
	require.NotNil(wl.Workload.Health.Requests.Inbound)
}

func TestWorkloadDetailsInvalidName(t *testing.T) {
	name := "invalid"
	require := require.New(t)
	app, code, _ := utils.WorkloadDetails(name, utils.BOOKINFO)
	require.NotEqual(200, code)
	require.Empty(app)
}

func TestDiscoverWorkload(t *testing.T) {
	require := require.New(t)
	workloadsPath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/bookinfo-workloads.yaml")
	extraWorkloads := map[string]string{
		"details-v2": "Pod",
		"reviews-v4": "ReplicaSet",
	}

	defer utils.DeleteFile(workloadsPath, utils.BOOKINFO)
	require.True(utils.ApplyFile(workloadsPath, utils.BOOKINFO))
	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		wlList, err := utils.WorkloadsList(utils.BOOKINFO)
		require.Nil(err)
		require.NotNil(wlList)
		foundWorkloads := 0
		for _, wl := range wlList.Workloads {
			for k, v := range extraWorkloads {
				if k == wl.Name && v == wl.Type {
					foundWorkloads++
				}
			}
		}
		if len(extraWorkloads) == foundWorkloads {
			return true, nil
		}
		return false, nil
	})
	require.Nil(pollErr)
}
