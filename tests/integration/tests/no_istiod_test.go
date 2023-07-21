package tests

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	kubeerrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"

	k8s "github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tests/integration/utils/kube"
)

const kialiNamespace = "istio-system"

func update_istio_api_enabled(ctx context.Context, t *testing.T, value bool, kubeClientSet kubernetes.Interface, dynamicClient dynamic.Interface, kialiCRDExists bool) {
	require := require.New(t)

	kialiPodName := kube.GetKialiPodName(ctx, kubeClientSet, kialiNamespace, t)

	if kialiCRDExists {
		registryPatch := []byte(fmt.Sprintf(`{"spec": {"external_services": {"istio": {"istio_api_enabled": %t}}}}`, value))
		kube.UpdateKialiCR(ctx, dynamicClient, kubeClientSet, kialiNamespace, "istio_api_enabled", registryPatch, t)
	} else {
		config, cm := kube.GetKialiConfigMap(ctx, kubeClientSet, kialiNamespace, "kiali", t)
		config.ExternalServices.Istio.IstioAPIEnabled = value
		kube.UpdateKialiConfigMap(ctx, kubeClientSet, kialiNamespace, config, cm, t)
	}

	// Restart Kiali pod to pick up the new config.
	if !kialiCRDExists {
		require.NoError(kube.DeleteKialiPod(ctx, kubeClientSet, kialiNamespace, kialiPodName))
	}
	require.NoError(kube.DeleteKialiPod(ctx, kubeClientSet, kialiNamespace, kialiPodName))
	require.NoError(kube.RestartKialiPod(ctx, kubeClientSet, kialiNamespace, kialiPodName))
}

func TestNoIstiod(t *testing.T) {
	kubeClientSet := kube.NewKubeClient(t)
	dynamicClient := kube.NewDynamicClient(t)
	ctx := context.TODO()

	kialiCRDExists := false
	_, err := kubeClientSet.Discovery().RESTClient().Get().AbsPath("/apis/kiali.io").DoRaw(ctx)
	if !kubeerrors.IsNotFound(err) {
		kialiCRDExists = true
	}

	defer update_istio_api_enabled(ctx, t, true, kubeClientSet, dynamicClient, kialiCRDExists)
	update_istio_api_enabled(ctx, t, false, kubeClientSet, dynamicClient, kialiCRDExists)
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
	require.Equal(kiali.BOOKINFO, serviceList.Namespace.Name)

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
	name := "bookinfo-gateway"
	require := require.New(t)

	config, err := getConfigForNamespace(kiali.BOOKINFO, name, k8s.Gateways)

	require.NoError(err)
	require.NotNil(config)
	require.Equal(k8s.Gateways, config.ObjectType)
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
