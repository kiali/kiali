package virtualservices

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
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

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nogateway", vals[0]))
}

func TestMissingGateways(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	virtualService := data.AddGatewaysToVirtualService([]string{"my-gateway", "my-gateway2", "mesh"}, data.CreateVirtualService())
	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   make(map[string]struct{}),
	}

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nogateway", vals[0]))
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nogateway", vals[1]))
}

func TestMissingGatewayInHTTPMatch(t *testing.T) {
	cases := []struct {
		name     string
		fileName string
	}{
		{name: "gw-format", fileName: "non-existent-gateway-in-match.yaml"},
		{name: "ns-gw-format", fileName: "non-existent-ns-gateway-in-match.yaml"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			assert := assert.New(t)
			conf := config.NewConfig()
			config.Set(conf)

			path := fmt.Sprintf("../../../tests/data/validations/virtualservices/%s", "non-existent-gateway-in-match.yaml")
			loader := &validations.YamlFixtureLoader{Filename: path}
			err := loader.Load()
			if err != nil {
				t.Error("Error loading test data.")
			}

			virtualService := loader.FindVirtualService("test", "default")
			checker := NoGatewayChecker{
				VirtualService: virtualService,
				GatewayNames:   map[string]struct{}{"valid-gateway": {}},
			}

			vals, valid := checker.Check()

			assert.False(valid)
			assert.NotEmpty(vals)
			assert.Equal(models.ErrorSeverity, vals[0].Severity)
			assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nogateway", vals[0]))
		})
	}
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

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nogateway", vals[0]))
}

func TestFoundGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	virtualService := data.AddGatewaysToVirtualService([]string{"my-gateway", "mesh"}, data.CreateVirtualService())
	gatewayNames := kubernetes.GatewayNames([]*networking_v1beta1.Gateway{
		data.CreateEmptyGateway("my-gateway", "test", make(map[string]string)),
	})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	vals, valid := checker.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestFoundRemoteGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	virtualService := data.AddGatewaysToVirtualService([]string{"remote/my-gateway", "mesh"}, data.CreateVirtualService())
	gatewayNames := kubernetes.GatewayNames([]*networking_v1beta1.Gateway{
		data.CreateEmptyGateway("my-gateway", "remote", make(map[string]string)),
	})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	vals, valid := checker.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestFoundGatewayTwoPartNaming(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	virtualService := data.AddGatewaysToVirtualService([]string{"my-gateway.test", "mesh"}, data.CreateVirtualService())
	gatewayNames := kubernetes.GatewayNames([]*networking_v1beta1.Gateway{
		data.CreateEmptyGateway("my-gateway", "test", make(map[string]string)),
	})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	vals, valid := checker.Check()
	assert.True(valid)
	assert.Len(vals, 1)
	assert.Equal(models.Unknown, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.gateway.oldnomenclature", vals[0]))
}

func TestFQDNFoundGateway(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	virtualService := data.AddGatewaysToVirtualService([]string{"my-gateway.test.svc.cluster.local", "mesh"}, data.CreateVirtualService())
	gatewayNames := kubernetes.GatewayNames([]*networking_v1beta1.Gateway{
		data.CreateEmptyGateway("my-gateway", "test", make(map[string]string)),
	})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	vals, valid := checker.Check()
	assert.True(valid)
	assert.Len(vals, 1)
	assert.Equal(models.Unknown, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.gateway.oldnomenclature", vals[0]))
}

func TestFQDNFoundOtherNamespaceGateway(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	// virtualService is in "test" namespace
	virtualService := data.AddGatewaysToVirtualService([]string{"my-gateway.istio-system.svc.cluster.local", "mesh"}, data.CreateVirtualService())
	gatewayNames := kubernetes.GatewayNames([]*networking_v1beta1.Gateway{
		data.CreateEmptyGateway("my-gateway", "istio-system", make(map[string]string)),
	})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	vals, valid := checker.Check()
	assert.True(valid)
	assert.Len(vals, 1)
	assert.Equal(models.Unknown, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.gateway.oldnomenclature", vals[0]))
}

func TestNewIstioGatewayNameFormat(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	// virtualService is in "test" namespace
	virtualService := data.AddGatewaysToVirtualService([]string{"istio-system/my-gateway"}, data.CreateVirtualService())
	gatewayNames := kubernetes.GatewayNames([]*networking_v1beta1.Gateway{
		data.CreateEmptyGateway("my-gateway", "istio-system", make(map[string]string)),
	})

	checker := NoGatewayChecker{
		VirtualService: virtualService,
		GatewayNames:   gatewayNames,
	}

	vals, valid := checker.Check()
	assert.True(valid)
	assert.Empty(vals)
}
