package k8sgateways

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestCorrectGatewayAPIClass(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validgateway", "test")
	k8sgwClasses := []config.GatewayAPIClass{
		{
			Name:      "Istio",
			ClassName: "istio",
		},
	}

	k8sgws := GatewayClassChecker{K8sGateway: k8sgwObject, GatewayClasses: k8sgwClasses}

	check, isValid := k8sgws.Check()

	assert.True(isValid)
	assert.Empty(check)
}

func TestIncorrectGatewayAPIClass(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validgateway", "test")
	k8sgwClasses := []config.GatewayAPIClass{
		{
			Name:      "istio",
			ClassName: "wrong",
		},
	}

	k8sgws := GatewayClassChecker{K8sGateway: k8sgwObject, GatewayClasses: k8sgwClasses}

	check, isValid := k8sgws.Check()

	assert.False(isValid)
	assert.NotEmpty(check)
	assert.Equal("Gateway API Class not found in Kiali configuration", check[0].Message)
	assert.Equal(models.ErrorSeverity, check[0].Severity)
}
