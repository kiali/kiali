package tests

import (
	"path"
	"testing"

	"github.com/stretchr/testify/require"

	k8s "github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tests/integration/utils/kube"
	"github.com/kiali/kiali/tools/cmd"
)

func TestNoIstiod(t *testing.T) {
	require := require.New(t)
	kubeClientSet := kube.NewKubeClient(t)
	dynamicClient := kube.NewDynamicClient(t)

	ctx := contextWithTestingDeadline(t)

	instance, err := kiali.NewInstance(ctx, kubeClientSet, dynamicClient)
	require.NoError(err)

	cfg, err := instance.GetConfig(ctx)
	require.NoError(err)

	defer func() {
		cfg.ExternalServices.Istio.IstioAPIEnabled = true
		require.NoError(instance.UpdateConfig(ctx, cfg))
		require.NoError(instance.Restart(ctx))
	}()

	// Disable Istio API
	cfg.ExternalServices.Istio.IstioAPIEnabled = false
	require.NoError(instance.UpdateConfig(ctx, cfg))
	require.NoError(instance.Restart(ctx))

	t.Run("ServicesListNoRegistryServices", servicesListNoRegistryServices)
	t.Run("NoProxyStatus", noProxyStatus)
	t.Run("istioStatus", istioStatus)
	t.Run("emptyValidations", emptyValidations)
}

func servicesListNoRegistryServices(t *testing.T) {
	require := require.New(t)
	serviceList, err := kiali.ServicesList(kiali.BOOKINFO)

	require.NoError(err)
	require.NotEmpty(serviceList)
	require.True(len(serviceList.Services) >= 4)
	sl := len(serviceList.Services)

	// Deploy an external service entry
	applySe := utils.ApplyFile("../assets/bookinfo-service-entry-external.yaml", "bookinfo")
	require.True(applySe)

	// The service result should be the same
	serviceList2, err3 := kiali.ServicesList(kiali.BOOKINFO)
	require.NoError(err3)
	require.True(len(serviceList2.Services) == sl)

	// Now, create a Service Entry (Part of th
	require.NotNil(serviceList.Validations)
	require.Equal(kiali.BOOKINFO, serviceList.Services[0].Namespace)

	// Cleanup
	deleteSe := utils.DeleteFile("../assets/bookinfo-service-entry-external.yaml", "bookinfo")
	require.True(deleteSe)
}

func noProxyStatus(t *testing.T) {
	name := "details-v1"
	require := require.New(t)
	wl, _, err := kiali.WorkloadDetails(name, kiali.BOOKINFO)

	require.NoError(err)
	require.NotNil(wl)
	require.Equal(name, wl.Name)
	require.Equal("Deployment", wl.Type)
	require.NotNil(wl.Pods)
	for _, pod := range wl.Pods {
		require.NotEmpty(pod.Status)
		require.NotEmpty(pod.Name)
		require.Empty(pod.ProxyStatus)
	}
}

func emptyValidations(t *testing.T) {
	name := "ingress-app"
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-simple-gateway.yaml")
	t.Cleanup(func() { utils.DeleteFile(filePath, kiali.BOOKINFO) })
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	config, err := getConfigForNamespace(kiali.BOOKINFO, name, k8s.Gateways)

	require.NoError(err)
	require.NotNil(config)
	require.Equal(k8s.Gateways.String(), config.ObjectGVK.String())
	require.Equal(kiali.BOOKINFO, config.Namespace.Name)
	require.NotNil(config.Gateway)
	require.Equal(name, config.Gateway.Name)
	require.Equal(kiali.BOOKINFO, config.Gateway.Namespace)
	require.Nil(config.IstioValidation)
	require.Nil(config.IstioReferences)
}

func istioStatus(t *testing.T) {
	require := require.New(t)

	isEnabled, err := kiali.IstioApiEnabled()
	require.NoError(err)
	require.False(isEnabled)
}
