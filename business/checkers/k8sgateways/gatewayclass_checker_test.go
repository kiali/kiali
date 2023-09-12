package k8sgateways

import (
	"testing"

	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestCorrectK8sGatewayClass(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validgateway", "test")
	k8sgwClasses := []*k8s_networking_v1beta1.GatewayClass{data.CreateEmptyK8sGatewayClass("istio", "default")}

	k8sgws := GatewayClassChecker{K8sGateway: k8sgwObject, GatewayClasses: k8sgwClasses}

	check, isValid := k8sgws.Check()

	assert.True(isValid)
	assert.Empty(check)
}

func TestIncorrectK8sGatewayClass(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	k8sgwObject := data.CreateEmptyK8sGateway("validgateway", "test")
	k8sgwClasses := []*k8s_networking_v1beta1.GatewayClass{data.CreateEmptyK8sGatewayClass("another", "default")}

	k8sgws := GatewayClassChecker{K8sGateway: k8sgwObject, GatewayClasses: k8sgwClasses}

	check, isValid := k8sgws.Check()

	assert.False(isValid)
	assert.NotEmpty(check)
	assert.Equal("K8s GatewayClass not found", check[0].Message)
	assert.Equal(models.ErrorSeverity, check[0].Severity)
}
