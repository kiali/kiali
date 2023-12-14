package k8shttproutes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestMissingK8sGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		K8sHTTPRoute: data.CreateHTTPRoute("route", "bookinfo", "gatewayapi", []string{"bookinfo"}),
		GatewayNames: make(map[string]struct{}),
	}

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8shttproutes.nok8sgateway", vals[0]))
}

func TestMissingK8sGateways(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		K8sHTTPRoute: data.AddParentRefToHTTPRoute("gateway2", "bookinfo2",
			data.CreateHTTPRoute("route", "bookinfo", "gatewayapi", []string{"bookinfo"})),
		GatewayNames: make(map[string]struct{}),
	}

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8shttproutes.nok8sgateway", vals[0]))
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8shttproutes.nok8sgateway", vals[1]))
}

func TestValidAndMissingK8sGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var empty struct{}

	checker := NoK8sGatewayChecker{
		K8sHTTPRoute: data.AddParentRefToHTTPRoute("correctgw", "bookinfo2",
			data.CreateHTTPRoute("route", "bookinfo", "gatewayapi", []string{"bookinfo"})),
		GatewayNames: map[string]struct{}{"correctgw": empty},
	}

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8shttproutes.nok8sgateway", vals[0]))
}

func TestFoundK8sGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		K8sHTTPRoute: data.CreateHTTPRoute("route", "bookinfo", "my-gateway", []string{"bookinfo"}),
		GatewayNames: kubernetes.K8sGatewayNames([]*k8s_networking_v1.Gateway{
			data.CreateEmptyK8sGateway("my-gateway", "bookinfo"),
		}),
	}

	vals, valid := checker.Check()
	assert.True(valid)
	assert.Empty(vals)
}
