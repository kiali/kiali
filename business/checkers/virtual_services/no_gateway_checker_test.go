package virtual_services

import (
	"testing"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

func TestMissingGateway(t *testing.T) {
	assert := assert.New(t)

	virtualService := data.AddGatewaysToVirtualService([]string{"my-gateway", "mesh"}, data.CreateVirtualService())
	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   make(map[string]struct{}, 0),
	}

	validations, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
}

func TestFoundGateway(t *testing.T) {
	assert := assert.New(t)

	virtualService := data.AddGatewaysToVirtualService([]string{"my-gateway", "mesh"}, data.CreateVirtualService())
	gatewayNames := kubernetes.GatewayNames([]kubernetes.IstioObject{data.CreateEmptyGateway("my-gateway", make(map[string]string))})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	validations, valid := checker.Check()
	assert.True(valid)
	assert.Empty(validations)
}
