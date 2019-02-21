package gateways

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

func TestValidPortDefinition(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gw := data.AddServerToGateway(
		data.CreateServer([]string{"localhost"}, uint32(80), "http", "http"),
		data.CreateEmptyGateway("valid-gw", "test", map[string]string{"istio": "ingressgateway"}),
	)
	pc := PortChecker{Gateway: gw}
	validations, valid := pc.Check()
	assert.True(valid)
	assert.Empty(validations)
}

func TestInvalidPortDefinition(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gw := data.AddServerToGateway(
		data.CreateServer([]string{"localhost"}, uint32(80), "http", "http2"),
		data.CreateEmptyGateway("notvalid-gw", "test", map[string]string{"istio": "ingressgateway"}),
	)
	pc := PortChecker{Gateway: gw}
	validations, valid := pc.Check()
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.Equal(models.CheckMessage("port.name.mismatch"), validations[0].Message)
	assert.Equal("spec/servers[0]/port/name", validations[0].Path)
}
