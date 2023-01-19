package tests

import (
	"os/exec"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/tests/integration/utils"
)

func init() {
	update_istio_api_enabled(false)
}

var ocCommand = utils.NewExecCommand()

//var ocCommand = "oc"

func update_istio_api_enabled(value bool) {
	
	original := !value
	cmdReplacecm := ocCommand + " get cm kiali -n istio-system -o yaml | sed -e 's|istio_api_enabled: " + strconv.FormatBool(original) + "|istio_api_enabled: " + strconv.FormatBool(value) + "|' | " + ocCommand + " apply -f -"
	_, err := exec.Command("bash", "-c", cmdReplacecm).Output()
	if err != nil {
		log.Errorf("Failed to execute command: %s", cmdReplacecm)
	} else {
		// Restart kiali pod
		// Get kiali pod name
		cmdGetPodName := ocCommand + " get pods -o name -n istio-system | egrep kiali | sed 's|pod/||'"
		kialiPodName, err2 := exec.Command("bash", "-c", cmdGetPodName).Output()
		podName := strings.Replace(string(kialiPodName), "\n", "", -1)

		if err2 == nil {
			// Restart
			cmd3 := ocCommand + " delete pod " + podName + " -n istio-system"
			_, err3 := exec.Command("bash", "-c", cmd3).Output()

			if err3 == nil {
				waitCmd := ocCommand + " wait --for=condition=ready pod -l app=kiali -n istio-system"
				_, err4 := exec.Command("bash", "-c", waitCmd).Output()

				//log.Debugf("Output: %s", output)

				if err4 != nil {
					log.Errorf("Error waiting for pod %s ", err4.Error())
				}
			}
		}
	}
}

func TestServicesListNoRegistryServices(t *testing.T) {
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
	rmSe := ocCommand + " delete -f ./assets/bookinfo-service-entry-external.yaml"
	_, err4 := exec.Command("bash", "-c", rmSe).Output()
	if err4 != nil {
		log.Errorf("Failed to execute command: %s", rmSe)
	}
}

func TestNoProxyStatus(t *testing.T) {
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
	t.Cleanup(Cleanup)
}

func TestIstioStatus(t *testing.T) {
	assert := assert.New(t)

	isEnabled, err := utils.IstioApiEnabled()
	assert.Nil(err)
	assert.False(isEnabled)
}

func TestNoValidations(t *testing.T) {
	assert := assert.New(t)

	configList, err := utils.IstioConfigsList(utils.BOOKINFO)
	assert.Nil(err)

	assert.NotNil(configList.Gateways)
	assert.Nil(configList.IstioValidations)

}

func Cleanup() {
	update_istio_api_enabled(true)
}
