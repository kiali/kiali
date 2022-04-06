package tests

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/tests/integration/utils"
)

func TestServicesList(t *testing.T) {
	assert := assert.New(t)
	serviceList, err := utils.ServicesList(utils.BOOKINFO)

	assert.Nil(err)
	assert.NotEmpty(serviceList)
	assert.True(len(serviceList.Services) >= 4)
	for _, service := range serviceList.Services {
		assert.NotEmpty(service.Name)
		assert.True(service.IstioSidecar)
		assert.True(service.AppLabel)
		assert.NotNil(service.Health)
		assert.NotNil(service.Health.Requests)
		assert.NotNil(service.Health.Requests.Outbound)
		assert.NotNil(service.Health.Requests.Inbound)
	}
	assert.NotNil(serviceList.Validations)
	assert.Equal(utils.BOOKINFO, serviceList.Namespace.Name)
}

func TestServiceDetails(t *testing.T) {
	name := "productpage"
	assert := assert.New(t)
	service, err := utils.ServiceDetails(name, utils.BOOKINFO)

	assert.Nil(err)
	assert.NotNil(service)
	assert.NotNil(service.Service)
	assert.Equal(utils.BOOKINFO, service.Service.Namespace.Name)
	assert.NotEmpty(service.Workloads)
	assert.NotEmpty(service.Service.Ports)
	assert.NotEmpty(service.Service.Ports)
	assert.NotNil(service.Endpoints)
	assert.NotEmpty(service.VirtualServices)
	assert.NotEmpty(service.DestinationRules)
	assert.NotNil(service.Validations)

	assert.NotNil(service.Health)
	assert.NotNil(service.Health.Requests)
	assert.NotNil(service.Health.Requests.Outbound)
	assert.NotNil(service.Health.Requests.Inbound)

	assert.True(service.IstioSidecar)
}
