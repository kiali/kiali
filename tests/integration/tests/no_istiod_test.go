package tests

import (
	"os/exec"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tests/integration/utils"
)

var ocCommand = utils.NewExecCommand()

func update_istio_api_enabled(value bool) {
	original := !value

	cmdGetProp := ocCommand + " get cm kiali -n istio-system -o yaml | grep 'istio_api_enabled'"
	getPropOutput, _ := exec.Command("bash", "-c", cmdGetProp).Output()

	if len(string(getPropOutput)) == 0 {
		// Is the property is not there, we should add it, instead of replacing
		cmdReplacecm3 := ocCommand + " get cm kiali -n istio-system -o yaml | sed -e 's|root_namespace: istio-system|root_namespace: istio-system'\r'        istio_api_enabled: " + strconv.FormatBool(value) + "|' | " + ocCommand + " apply -f -"
		_, err := exec.Command("bash", "-c", cmdReplacecm3).Output()
		if err != nil {
			log.Errorf("Error updating config map: %s", err.Error())
		}

	} else {
		cmdReplacecm := ocCommand + " get cm kiali -n istio-system -o yaml | sed -e 's|istio_api_enabled: " + strconv.FormatBool(original) + "|istio_api_enabled: " + strconv.FormatBool(value) + "|' | " + ocCommand + " apply -f -"
		_, err := exec.Command("bash", "-c", cmdReplacecm).Output()
		if err != nil {
			log.Errorf("Error updating config map: %s", err.Error())
		}
	}

	// Restart kiali pod
	// Get kiali pod name
	cmdGetPodName := ocCommand + " get pods -o name -n istio-system | egrep kiali | sed 's|pod/||'"
	kialiPodName, err2 := exec.Command("bash", "-c", cmdGetPodName).Output()
	podName := strings.Replace(string(kialiPodName), "\n", "", -1)
	log.Debugf("Kiali pod name: %s", podName)

	if err2 == nil {
		// Restart
		cmd3 := ocCommand + " delete pod " + podName + " -n istio-system"
		_, err3 := exec.Command("bash", "-c", cmd3).Output()
		log.Debugf("Delete pod command: %s", cmd3)

		if err3 == nil {
			waitCmd := ocCommand + " wait --for=condition=ready pod -l app=kiali -n istio-system"
			out, err4 := exec.Command("bash", "-c", waitCmd).Output()

			log.Debugf("Waiting for condition to met %s", out)

			if err4 != nil {
				log.Errorf("Error waiting for pod %s ", err4.Error())
			}
		}
	}
}

func TestNoIstiod(t *testing.T) {
	defer update_istio_api_enabled(true)
	update_istio_api_enabled(false)
	time.Sleep(10 * time.Second)
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

func emptyValidations(t *testing.T) {
	name := "bookinfo-gateway"
	assert := assert.New(t)

	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.Gateways, true, assert)

	assert.Nil(err)
	assert.Nil(config)

	/* Validations not available
		assert.NotNil(config)
		assert.Equal(kubernetes.Gateways, config.ObjectType)
		assert.Equal(utils.BOOKINFO, config.Namespace.Name)
		assert.NotNil(config.Gateway)
		assert.Equal(name, config.Gateway.Name)
		assert.Equal(utils.BOOKINFO, config.Gateway.Namespace)
		assert.Equal(len(config.IstioValidation.Checks), 0)
		assert.Equal(len(config.IstioValidation.References), 0)
	*/
}

func istioStatus(t *testing.T) {
	assert := assert.New(t)

	isEnabled, err := utils.IstioApiEnabled()
	assert.Nil(err)
	assert.False(isEnabled)
}
