package virtual_services

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/tests/data"
)

func TestValidHost(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		Namespace:      "test",
		ServiceNames:   []string{"reviews", "other"},
		VirtualService: data.CreateVirtualService(),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestNoValidHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	virtualService := data.CreateVirtualService()

	validations, valid := NoHostChecker{
		Namespace:      "test",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", validations[0].Message)
	assert.Equal("spec/http", validations[0].Path)
	assert.Equal("error", validations[1].Severity)
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", validations[1].Message)
	assert.Equal("spec/tcp", validations[1].Path)

	delete(virtualService.GetSpec(), "http")

	validations, valid = NoHostChecker{
		Namespace:      "test",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", validations[0].Message)
	assert.Equal("spec/tcp", validations[0].Path)

	delete(virtualService.GetSpec(), "tcp")

	validations, valid = NoHostChecker{
		Namespace:      "test",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal("error", validations[0].Severity)
	assert.Equal("VirtualService doesn't define any route protocol", validations[0].Message)
	assert.Equal("", validations[0].Path)
}

func TestValidServiceEntryHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	virtualService := data.CreateVirtualServiceWithServiceEntryTarget()

	validations, valid := NoHostChecker{
		Namespace:      "wikipedia",
		ServiceNames:   []string{},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)

	// Add ServiceEntry for validity
	serviceEntry := data.CreateExternalServiceEntry()

	validations, valid = NoHostChecker{
		Namespace:         "wikipedia",
		ServiceNames:      []string{},
		VirtualService:    virtualService,
		ServiceEntryHosts: kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{serviceEntry}),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestGoogleApisServiceExample(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	vs := data.CreateGoogleApisExampleVirtualService()
	serviceEntry := data.CreateGoogleApisExampleExternalServiceEntry()

	validations, valid := NoHostChecker{
		Namespace:         "bookinfo",
		ServiceNames:      []string{},
		VirtualService:    vs,
		ServiceEntryHosts: kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{serviceEntry}),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}
