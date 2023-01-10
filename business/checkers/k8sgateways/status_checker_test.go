package k8sgateways

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestCorrectK8sGatewaysStatus(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validgateway", "test")

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.True(isValid)
	assert.Empty(check)
}

func TestIncorrectK8sGatewaysStatus(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwAddress := data.CreateGWAddress("IPAddress", "192.168.0.0")
	k8sgwObject := data.AddListenerToK8sGateway(data.CreateListener("test", "host.com.wrong", 11, "http"),
		data.CreateEmptyK8sGateway("validk8sgateway", "test"))
	k8sgwObject = data.AddGwAddressToK8sGateway(gwAddress, k8sgwObject)
	k8sgwObject = data.UpdateConditionWithError(k8sgwObject)

	k8sgws := StatusChecker{k8sgwObject}

	check, isValid := k8sgws.Check()

	assert.False(isValid)
	assert.NotEmpty(check)
	assert.Equal("Fake msg. GWAPI errors should be changed in the spec.", check[0].Message)
	assert.Equal(models.WarningSeverity, check[0].Severity)
}
