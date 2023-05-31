package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/kubernetes"
	kubeerrors "k8s.io/apimachinery/pkg/api/errors"

	k8s "github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/tests/integration/utils"
)

const kialiNamespace = "istio-system"

func update_istio_api_enabled(ctx context.Context, t *testing.T, value bool, kubeClientSet kubernetes.Interface, kialiCRDExists bool) {

	require := require.New(t)

	kialiPodName := utils.GetKialiPodName(ctx, kubeClientSet, kialiNamespace, t)

	config, cm := utils.GetKialiConfigMap(ctx, kubeClientSet, kialiNamespace, "kiali", t)
	config.ExternalServices.Istio.IstioAPIEnabled = value

	utils.UpdateKialiConfigMap(ctx, kubeClientSet, kialiNamespace, config, cm, t)

	// Restart Kiali pod to pick up the new config.
	if !kialiCRDExists {
		require.NoError(utils.DeleteKialiPod(ctx, kubeClientSet, kialiNamespace, kialiPodName))
	}
	require.NoError(utils.DeleteKialiPod(ctx, kubeClientSet, kialiNamespace, kialiPodName))
	require.NoError(utils.RestartKialiPod(ctx, kubeClientSet, kialiNamespace, kialiPodName))

}

func TestNoIstiod(t *testing.T) {
	kubeClientSet := utils.NewKubeClient(t)
	ctx := context.TODO()

	kialiCRDExists := false
	_, err := kubeClientSet.Discovery().RESTClient().Get().AbsPath("/apis/kiali.io").DoRaw(ctx)
	if !kubeerrors.IsNotFound(err) {
		kialiCRDExists = true
	}

	defer update_istio_api_enabled(ctx, t, true, kubeClientSet, kialiCRDExists)
	update_istio_api_enabled(ctx, t, false, kubeClientSet, kialiCRDExists)
	t.Run("ServicesListNoRegistryServices", servicesListNoRegistryServices)
	t.Run("NoProxyStatus", noProxyStatus)
	t.Run("istioStatus", istioStatus)
	t.Run("emptyValidations", emptyValidations)
}

func servicesListNoRegistryServices(t *testing.T) {
	assert := assert.New(t)
	serviceList, err := utils.ServicesList(utils.BOOKINFO)

	assert.Nil(err)
	assert.NotEmpty(serviceList)
	assert.True(len(serviceList.Services) >= 4)
	sl := len(serviceList.Services)

	// Deploy an external service entry
	applySe := utils.ApplyFile("../assets/bookinfo-service-entry-external.yaml", "bookinfo")
	require.True(t, applySe)

	// The service result should be the same
	serviceList2, err3 := utils.ServicesList(utils.BOOKINFO)
	require.NoError(t, err3)
	assert.True(len(serviceList2.Services) == sl)

	// Now, create a Service Entry (Part of th
	assert.NotNil(serviceList.Validations)
	assert.Equal(utils.BOOKINFO, serviceList.Namespace.Name)

	// Cleanup
	deleteSe := utils.DeleteFile("../assets/bookinfo-service-entry-external.yaml", "bookinfo")
	require.True(t, deleteSe)
}

func noProxyStatus(t *testing.T) {
	name := "details-v1"
	assert := assert.New(t)
	wl, _, err := utils.WorkloadDetails(name, utils.BOOKINFO)

	assert.Nil(err)
	assert.NotNil(wl)
	assert.Equal(name, wl.Name)
	assert.Equal("Deployment", wl.Type)
	assert.NotNil(wl.Pods)
	for _, pod := range wl.Pods {
		assert.NotEmpty(pod.Status)
		assert.NotEmpty(pod.Name)
		assert.Empty(pod.ProxyStatus)
	}
}

func emptyValidations(t *testing.T) {
	name := "bookinfo-gateway"
	assert := assert.New(t)

	config, err := getConfigForNamespace(utils.BOOKINFO, name, k8s.Gateways)

	assert.Nil(err)
	assert.NotNil(config)
	assert.Equal(k8s.Gateways, config.ObjectType)
	assert.Equal(utils.BOOKINFO, config.Namespace.Name)
	assert.NotNil(config.Gateway)
	assert.Equal(name, config.Gateway.Name)
	assert.Equal(utils.BOOKINFO, config.Gateway.Namespace)
	assert.Nil(config.IstioValidation)
	assert.Nil(config.IstioReferences)
}

func istioStatus(t *testing.T) {
	assert := assert.New(t)

	isEnabled, err := utils.IstioApiEnabled()
	assert.Nil(err)
	assert.False(isEnabled)
}
