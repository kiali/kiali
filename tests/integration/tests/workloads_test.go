package tests

import (
	"context"
	"path"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tools/cmd"
)

func TestWorkloadsList(t *testing.T) {
	require := require.New(t)
	wlList, err := kiali.WorkloadsList(kiali.BOOKINFO)

	require.NoError(err)
	require.NotEmpty(wlList)
	for _, wl := range wlList.Workloads {
		require.NotEmpty(wl.Name)
		require.NotNil(wl.Health)
		require.NotNil(wl.Labels)
		require.Equal(kiali.BOOKINFO, wl.Namespace)
		if !strings.Contains(wl.Name, "traffic-generator") && !strings.Contains(wl.Name, "gateway") {
			require.True(wl.IstioSidecar)
			require.NotNil(wl.IstioReferences)
		}
	}
	require.NotNil(wlList.Validations)
}

func TestWorkloadDetails(t *testing.T) {
	name := "details-v1"
	require := require.New(t)
	wl, _, err := kiali.WorkloadDetails(name, kiali.BOOKINFO)

	require.NoError(err)
	require.NotNil(wl)
	require.Equal(name, wl.Name)
	require.Equal("Deployment", wl.WorkloadGVK.Kind)
	require.NotNil(wl.Pods)
	for _, pod := range wl.Pods {
		require.NotEmpty(pod.Status)
		require.NotEmpty(pod.Name)
		// @TODO fails on CI
		// require.NotNil(pod.ProxyStatus)
	}
	require.NotEmpty(wl.Services)
	for _, wl := range wl.Services {
		require.Equal(kiali.BOOKINFO, wl.Namespace)
	}
	require.NotEmpty(wl.Runtimes)
	require.NotEmpty(wl.Validations)
	require.NotEmpty(wl.Health)
	require.NotNil(wl.Health)
	require.NotNil(wl.Health.WorkloadStatus)
	require.Contains(wl.Health.WorkloadStatus.Name, name)
	require.NotNil(wl.Health.Requests)
	require.NotNil(wl.Health.Requests.Outbound)
	require.NotNil(wl.Health.Requests.Inbound)
}

func TestWorkloadIstioIngressEmptyProxyStatus(t *testing.T) {
	name := "bookinfo-gateway-istio"
	require := require.New(t)
	wl, _, err := kiali.WorkloadDetails(name, "bookinfo")

	require.NoError(err)
	require.NotNil(wl)
	require.Equal(name, wl.Name)
	require.Equal("Deployment", wl.WorkloadGVK.Kind)
	require.NotNil(wl.Pods)
	for _, pod := range wl.Pods {
		require.NotEmpty(pod.Status)
		require.NotEmpty(pod.Name)
		require.Nil(pod.ProxyStatus)
	}
}

func TestWorkloadDetailsInvalidName(t *testing.T) {
	name := "invalid"
	require := require.New(t)
	app, code, _ := kiali.WorkloadDetails(name, kiali.BOOKINFO)
	require.NotEqual(200, code)
	require.Empty(app)
}

func TestDiscoverWorkload(t *testing.T) {
	require := require.New(t)
	workloadsPath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-workloads.yaml")
	extraWorkloads := map[string]string{
		"details-v2": "Pod",
		"reviews-v4": "ReplicaSet",
	}

	defer utils.DeleteFile(workloadsPath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(workloadsPath, kiali.BOOKINFO))
	ctx := context.TODO()

	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		wlList, err := kiali.WorkloadsList(kiali.BOOKINFO)
		require.NoError(err)
		require.NotNil(wlList)
		foundWorkloads := 0
		for _, wl := range wlList.Workloads {
			for k, v := range extraWorkloads {
				if k == wl.Name && v == wl.WorkloadGVK.Kind {
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

func TestDiscoverWorkloadGroups(t *testing.T) {
	require := require.New(t)
	workloadsPath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-workload-groups.yaml")
	extraWorkloads := map[string]string{
		"ratings-vm":           "WorkloadGroup",
		"ratings-vm2":          "WorkloadGroup",
		"ratings-vm-no-entry":  "WorkloadGroup",
		"ratings-vm-no-entry2": "WorkloadGroup",
	}

	defer utils.DeleteFile(workloadsPath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(workloadsPath, kiali.BOOKINFO))
	ctx := context.TODO()

	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute, false, func(ctx context.Context) (bool, error) {
		wlList, err := kiali.WorkloadsList(kiali.BOOKINFO)
		require.NoError(err)
		require.NotNil(wlList)
		foundWorkloads := 0
		for _, wl := range wlList.Workloads {
			for k, v := range extraWorkloads {
				if k == wl.Name && v == wl.WorkloadGVK.Kind {
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
