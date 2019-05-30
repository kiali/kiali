package virtual_services

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

func TestMissingGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	virtualService := data.AddGatewaysToVirtualService([]string{"my-gateway", "mesh"}, data.CreateVirtualService())
	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   make(map[string]struct{}),
	}

	validations, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.Equal(models.CheckMessage("virtualservices.nogateway"), validations[0].Message)
}

func TestValidAndMissingGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var empty struct{}

	virtualService := data.AddGatewaysToVirtualService([]string{"correctgw", "my-gateway", "mesh"}, data.CreateVirtualService())
	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   map[string]struct{}{"correctgw": empty},
	}

	validations, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.Equal(models.CheckMessage("virtualservices.nogateway"), validations[0].Message)
}

func TestFoundGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	virtualService := data.AddGatewaysToVirtualService([]string{"my-gateway", "mesh"}, data.CreateVirtualService())
	gatewayNames := kubernetes.GatewayNames([][]kubernetes.IstioObject{
		[]kubernetes.IstioObject{
			data.CreateEmptyGateway("my-gateway", "test", make(map[string]string)),
		},
	})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	validations, valid := checker.Check()
	assert.True(valid)
	assert.Empty(validations)
}

func TestFQDNFoundGateway(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	virtualService := data.AddGatewaysToVirtualService([]string{"my-gateway.test.svc.cluster.local", "mesh"}, data.CreateVirtualService())
	gatewayNames := kubernetes.GatewayNames([][]kubernetes.IstioObject{
		[]kubernetes.IstioObject{
			data.CreateEmptyGateway("my-gateway", "test", make(map[string]string)),
		},
	})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	validations, valid := checker.Check()
	assert.True(valid)
	assert.Empty(validations)
}

func TestFQDNFoundOtherNamespaceGateway(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	// virtualService is in "test" namespace
	virtualService := data.AddGatewaysToVirtualService([]string{"my-gateway.istio-system.svc.cluster.local", "mesh"}, data.CreateVirtualService())
	gatewayNames := kubernetes.GatewayNames([][]kubernetes.IstioObject{
		[]kubernetes.IstioObject{
			data.CreateEmptyGateway("my-gateway", "istio-system", make(map[string]string)),
		},
	})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	validations, valid := checker.Check()
	assert.True(valid)
	assert.Empty(validations)
}

func TestNewIstioGatewayNameFormat(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	// virtualService is in "test" namespace
	virtualService := data.AddGatewaysToVirtualService([]string{"istio-system/my-gateway"}, data.CreateVirtualService())
	gatewayNames := kubernetes.GatewayNames([][]kubernetes.IstioObject{
		[]kubernetes.IstioObject{
			data.CreateEmptyGateway("my-gateway", "istio-system", make(map[string]string)),
		},
	})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	validations, valid := checker.Check()
	assert.True(valid)
	assert.Empty(validations)
}
