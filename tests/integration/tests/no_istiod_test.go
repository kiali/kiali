package tests

import (
	"context"
	"os/exec"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/kubernetes"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tests/integration/utils"
)

const kialiNamespace = "istio-system"

var ocCommand = utils.NewExecCommand()

func update_istio_api_enabled(t *testing.T, value bool, kubeClientSet kubernetes.Interface, ctx context.Context) {
	original := !value
	require := require.New(t)

	// Restart kiali pod
	// Get kiali pod name
	cmdGetPodName := ocCommand + " get pods -o name -n " + kialiNamespace + " | egrep kiali | sed 's|pod/||'"
	kialiPodName, err2 := exec.Command("bash", "-c", cmdGetPodName).Output()
	require.NoError(err2)

	podName := strings.Replace(string(kialiPodName), "\n", "", -1)
	log.Debugf("Kiali pod name: %s", podName)

	cmdGetProp := ocCommand + " get cm kiali -n " + kialiNamespace + " -o yaml | grep 'istio_api_enabled'"
	getPropOutput, _ := exec.Command("bash", "-c", cmdGetProp).Output()

	if len(string(getPropOutput)) == 0 {
		// Is the property is not there, we should add it, instead of replacing
		cmdReplacecm3 := ocCommand + " get cm kiali -n istio-system -o yaml | sed -e 's|root_namespace: istio-system|root_namespace: istio-system'\r'        istio_api_enabled: " + strconv.FormatBool(value) + "|' | " + ocCommand + " apply -f -"
		_, err := exec.Command("bash", "-c", cmdReplacecm3).Output()
		require.NoError(err)

	} else {
		cmdReplacecm := ocCommand + " get cm kiali -n " + kialiNamespace + " -o yaml | sed -e 's|istio_api_enabled: " + strconv.FormatBool(original) + "|istio_api_enabled: " + strconv.FormatBool(value) + "|' | " + ocCommand + " apply -f -"
		_, err := exec.Command("bash", "-c", cmdReplacecm).Output()
		require.NoError(err)
	}

	// Restart Kiali pod to pick up the new config.
	require.NoError(restartKialiPod(ctx, kubeClientSet, kialiNamespace, false, podName))

}

func TestNoIstiod(t *testing.T) {
	kubeClientSet := kubeClient(t)
	ctx := context.TODO()

	defer update_istio_api_enabled(t, true, kubeClientSet, ctx)
	update_istio_api_enabled(t, false, kubeClientSet, ctx)
	t.Run("ServicesListNoRegistryServices", servicesListNoRegistryServices)
	t.Run("NoProxyStatus", noProxyStatus)
	t.Run("istioStatus", istioStatus)
	//t.Run("emptyValidations", emptyValidations)
}

func servicesListNoRegistryServices(t *testing.T) {
	assert := assert.New(t)
	serviceList, err := utils.ServicesList(utils.BOOKINFO)

	assert.Nil(err)
	assert.NotEmpty(serviceList)
	assert.True(len(serviceList.Services) >= 4)
	sl := len(serviceList.Services)

	// Deploy an external service entry
	applySe := ocCommand + " apply -f ../assets/bookinfo-service-entry-external.yaml"
	_, err2 := exec.Command("bash", "-c", applySe).Output()
	if err2 != nil {
		log.Errorf("Failed to execute command: %s", applySe)
	}

	// The service result should be the same
	serviceList2, err3 := utils.ServicesList(utils.BOOKINFO)
	assert.True(len(serviceList2.Services) == sl)
	if err3 != nil {
		log.Errorf("Failed to execute command: %s", applySe)
	}

	// Now, create a Service Entry (Part of th
	assert.NotNil(serviceList.Validations)
	assert.Equal(utils.BOOKINFO, serviceList.Namespace.Name)

	// Cleanup
	rmSe := ocCommand + " delete -f ../assets/bookinfo-service-entry-external.yaml"
	_, err4 := exec.Command("bash", "-c", rmSe).Output()
	if err4 != nil {
		log.Errorf("Failed to execute command: %s", rmSe)
	}
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

/*
func emptyValidations(t *testing.T) {
	name := "bookinfo-gateway"
	assert := assert.New(t)

	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.Gateways, true, assert)

	assert.Nil(err)
	assert.NotNil(config)
	assert.Equal(kubernetes.Gateways, config.ObjectType)
	assert.Equal(utils.BOOKINFO, config.Namespace.Name)
	assert.NotNil(config.Gateway)
	assert.Equal(name, config.Gateway.Name)
	assert.Equal(utils.BOOKINFO, config.Gateway.Namespace)
	assert.Equal(len(config.IstioValidation.Checks), 0)
	assert.Equal(len(config.IstioValidation.References), 0)
}
*/

func istioStatus(t *testing.T) {
	assert := assert.New(t)

	isEnabled, err := utils.IstioApiEnabled()
	assert.Nil(err)
	assert.False(isEnabled)
}
