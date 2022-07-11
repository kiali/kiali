package gateways

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
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
	vals, valid := pc.Check()
	assert.True(valid)
	assert.Empty(vals)
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
	vals, valid := pc.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("port.name.mismatch", vals[0]))
	assert.Equal("spec/servers[0]/port/name", vals[0].Path)
}
