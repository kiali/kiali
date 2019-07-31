package gateways

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

func TestCorrectGateways(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwObject := data.AddServerToGateway(data.CreateServer([]string{"valid"}, 80, "http", "http"),
		data.CreateEmptyGateway("validgateway", "test", map[string]string{
			"app": "real",
		}))

	gws := [][]kubernetes.IstioObject{[]kubernetes.IstioObject{gwObject}}

	validations := MultiMatchChecker{
		GatewaysPerNamespace: gws,
	}.Check()

	assert.Empty(validations)
	_, ok := validations[models.IstioValidationKey{ObjectType: "gateway", Name: "validgateway"}]
	assert.False(ok)
}

func TestCaseMatching(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwObject := data.AddServerToGateway(data.CreateServer(
		[]string{
			"NOTFINE.example.com",
			"notfine.example.com",
		}, 80, "http", "http"),

		data.CreateEmptyGateway("foxxed", "test", map[string]string{
			"app": "canidae",
		}))

	gws := [][]kubernetes.IstioObject{[]kubernetes.IstioObject{gwObject}}

	validations := MultiMatchChecker{
		GatewaysPerNamespace: gws,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(1, len(validations))
	validation, ok := validations[models.IstioValidationKey{ObjectType: "gateway", Name: "foxxed"}]
	assert.True(ok)
	assert.True(validation.Valid)
}

func TestSameHostPortConfigInDifferentNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwObject := data.AddServerToGateway(data.CreateServer([]string{"valid"}, 80, "http", "http"),
		data.CreateEmptyGateway("validgateway", "test", map[string]string{
			"app": "real",
		}))

	// Another namespace
	gwObject2 := data.AddServerToGateway(data.CreateServer([]string{"valid"}, 80, "http", "http"),
		data.CreateEmptyGateway("stillvalid", "test", map[string]string{
			"app": "someother",
		}))

	gws := [][]kubernetes.IstioObject{[]kubernetes.IstioObject{gwObject}, []kubernetes.IstioObject{gwObject2}}

	validations := MultiMatchChecker{
		GatewaysPerNamespace: gws,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(2, len(validations))
	validation, ok := validations[models.IstioValidationKey{ObjectType: "gateway", Name: "stillvalid"}]
	assert.True(ok)
	assert.True(validation.Valid)
}

func TestWildCardMatchingHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwObject := data.AddServerToGateway(data.CreateServer([]string{"valid"}, 80, "http", "http"),
		data.CreateEmptyGateway("validgateway", "test", map[string]string{
			"app": "real",
		}))

	// Another namespace
	gwObject2 := data.AddServerToGateway(data.CreateServer([]string{"*"}, 80, "http", "http"),
		data.CreateEmptyGateway("stillvalid", "test", map[string]string{
			"app": "someother",
		}))

	// Another namespace
	gwObject3 := data.AddServerToGateway(data.CreateServer([]string{"*.justhost.com"}, 80, "http", "http"),
		data.CreateEmptyGateway("keepsvalid", "test", map[string]string{
			"app": "someother",
		}))

	gws := [][]kubernetes.IstioObject{[]kubernetes.IstioObject{gwObject}, []kubernetes.IstioObject{gwObject2, gwObject3}}

	validations := MultiMatchChecker{
		GatewaysPerNamespace: gws,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(3, len(validations))
	validation, ok := validations[models.IstioValidationKey{ObjectType: "gateway", Name: "stillvalid"}]
	assert.True(ok)
	assert.True(validation.Valid)

}

func TestAnotherSubdomainWildcardCombination(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwObject := data.AddServerToGateway(data.CreateServer(
		[]string{
			"*.echidna.com",
			"tachyglossa.echidna.com",
		}, 80, "http", "http"),

		data.CreateEmptyGateway("shouldnotbevalid", "test", map[string]string{
			"app": "monotreme",
		}))

	gws := [][]kubernetes.IstioObject{[]kubernetes.IstioObject{gwObject}}

	validations := MultiMatchChecker{
		GatewaysPerNamespace: gws,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(1, len(validations))
	validation, ok := validations[models.IstioValidationKey{ObjectType: "gateway", Name: "shouldnotbevalid"}]
	assert.True(ok)
	assert.True(validation.Valid)
}

func TestNoMatchOnSubdomainHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwObject := data.AddServerToGateway(data.CreateServer(
		[]string{
			"example.com",
			"thisisfine.example.com",
		}, 80, "http", "http"),

		data.CreateEmptyGateway("shouldbevalid", "test", map[string]string{
			"app": "someother",
		}))

	gws := [][]kubernetes.IstioObject{[]kubernetes.IstioObject{gwObject}}

	validations := MultiMatchChecker{
		GatewaysPerNamespace: gws,
	}.Check()

	assert.Empty(validations)
}

func TestTwoWildCardsMatching(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwObject := data.AddServerToGateway(data.CreateServer([]string{"*"}, 80, "http", "http"),
		data.CreateEmptyGateway("validgateway", "test", map[string]string{
			"app": "real",
		}))

	// Another namespace
	gwObject2 := data.AddServerToGateway(data.CreateServer([]string{"*"}, 80, "http", "http"),
		data.CreateEmptyGateway("stillvalid", "test", map[string]string{
			"app": "someother",
		}))

	gws := [][]kubernetes.IstioObject{[]kubernetes.IstioObject{gwObject}, []kubernetes.IstioObject{gwObject2}}

	validations := MultiMatchChecker{
		GatewaysPerNamespace: gws,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(2, len(validations))
	validation, ok := validations[models.IstioValidationKey{ObjectType: "gateway", Name: "stillvalid"}]
	assert.True(ok)
	assert.True(validation.Valid)
}

func TestDuplicateGatewaysErrorCount(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gwObject := data.AddServerToGateway(data.CreateServer([]string{"valid", "second.valid"}, 80, "http", "http"),
		data.CreateEmptyGateway("validgateway", "test", map[string]string{
			"app": "real",
		}))

	gwObjectIdentical := data.AddServerToGateway(data.CreateServer([]string{"valid", "second.valid"}, 80, "http", "http"),
		data.CreateEmptyGateway("duplicatevalidgateway", "test", map[string]string{
			"app": "real",
		}))

	gws := [][]kubernetes.IstioObject{[]kubernetes.IstioObject{gwObject, gwObjectIdentical}}

	validations := MultiMatchChecker{
		GatewaysPerNamespace: gws,
	}.Check()

	assert.NotEmpty(validations)
	validgateway, ok := validations[models.IstioValidationKey{ObjectType: "gateway", Name: "validgateway"}]
	assert.True(ok)

	duplicatevalidgateway, ok := validations[models.IstioValidationKey{ObjectType: "gateway", Name: "duplicatevalidgateway"}]
	assert.True(ok)

	assert.Equal(2, len(validgateway.Checks))
	assert.Equal("spec/servers[0]/hosts[0]", validgateway.Checks[0].Path)
	assert.Equal("spec/servers[0]/hosts[1]", validgateway.Checks[1].Path)

	assert.Equal(2, len(duplicatevalidgateway.Checks))
	assert.Equal("spec/servers[0]/hosts[0]", duplicatevalidgateway.Checks[0].Path)
	assert.Equal("spec/servers[0]/hosts[1]", duplicatevalidgateway.Checks[1].Path)
}
