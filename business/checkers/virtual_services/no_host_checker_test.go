package virtual_services

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestValidHost(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		Namespace:      "test-namespace",
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
		Namespace:      "test-namespace",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", validations[0].Message)
	assert.Equal("spec/http/route[0]/destination/host", validations[0].Path)
	assert.Equal(models.ErrorSeverity, validations[1].Severity)
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", validations[1].Message)
	assert.Equal("spec/tcp/route[0]/destination/host", validations[1].Path)

	delete(virtualService.GetSpec(), "http")

	validations, valid = NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", validations[0].Message)
	assert.Equal("spec/tcp/route[0]/destination/host", validations[0].Path)

	delete(virtualService.GetSpec(), "tcp")

	validations, valid = NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.Equal("VirtualService doesn't define any valid route protocol", validations[0].Message)
	assert.Equal("", validations[0].Path)
}

func TestValidServiceEntryHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	virtualService := data.CreateVirtualServiceWithServiceEntryTarget()

	validations, valid := NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"my-wiki-rule"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)

	// Add ServiceEntry for validity
	serviceEntry := data.CreateExternalServiceEntry()

	validations, valid = NoHostChecker{
		Namespace:         "test-namespace",
		ServiceNames:      []string{"my-wiki-rule"},
		VirtualService:    virtualService,
		ServiceEntryHosts: kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{serviceEntry}),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}
