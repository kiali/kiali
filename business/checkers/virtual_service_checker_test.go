package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func prepareTestForVirtualService(vs *networking_v1.VirtualService) models.IstioValidations {
	vss := []*networking_v1.VirtualService{vs}

	// Setup mocks
	destinationList := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("bookinfo", "reviewsrule", "reviews"),
	}

	virtualServiceChecker := VirtualServiceChecker{
		DestinationRules: destinationList,
		VirtualServices:  vss,
	}

	return virtualServiceChecker.Check()
}

func TestWellVirtualServiceValidation(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	validations := prepareTestForVirtualService(fakeVirtualServices())
	assert.NotEmpty(validations)

	// Well configured object
	validation, ok := validations[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "bookinfo", Name: "reviews-well"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-well")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.True(validation.Valid)
	assert.Len(validation.Checks, 0)
}

func TestVirtualServiceMultipleCheck(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations := prepareTestForVirtualService(fakeVirtualServicesMultipleChecks())
	assert.NotEmpty(validations)

	// route rule with multiple problems
	validation, ok := validations[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "bookinfo", Name: "reviews-multiple"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-multiple")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.True(validation.Valid)
	assert.Len(validation.Checks, 2)
}

func TestVirtualServiceMixedChecker(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations := prepareTestForVirtualService(fakeVirtualServiceMixedChecker())
	assert.NotEmpty(validations)

	// Precedence is incorrect
	validation, ok := validations[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "bookinfo", Name: "reviews-mixed"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-mixed")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.True(validation.Valid)
	assert.Len(validation.Checks, 2)
}

func TestVirtualServiceMultipleIstioObjects(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	destinationList := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("bookinfo", "reviewsrule1", "reviews"),
	}

	virtualServiceChecker := VirtualServiceChecker{
		DestinationRules: destinationList,
		VirtualServices:  fakeVirtualServiceMultipleIstioObjects(),
	}

	validations := virtualServiceChecker.Check()
	assert.NotEmpty(validations)

	validation, ok := validations[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "bookinfo", Name: "reviews-mixed"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-mixed")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.True(validation.Valid)
	assert.Len(validation.Checks, 2)

	validation, ok = validations[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "bookinfo", Name: "reviews-multiple"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-multiple")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.True(validation.Valid)
	assert.Len(validation.Checks, 2)
}

func fakeVirtualServices() *networking_v1.VirtualService {
	validVirtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v1", 55),
		data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v2", 45),
			data.CreateEmptyVirtualService("reviews-well", "bookinfo", []string{"reviews.prod.svc.cluster.local"}),
		),
	)

	return validVirtualService
}

func fakeVirtualServicesMultipleChecks() *networking_v1.VirtualService {
	virtualService := data.CreateEmptyVirtualService("reviews-multiple", "bookinfo", []string{})
	validVirtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v1", 55), virtualService)
	validVirtualService = data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("reviews", "v2", 55),
		validVirtualService)
	validVirtualService.Spec.Hosts = nil

	return validVirtualService
}

func fakeVirtualServiceMixedChecker() *networking_v1.VirtualService {
	validVirtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v4", 05),
		data.CreateEmptyVirtualService("reviews-mixed", "bookinfo", []string{}),
	)
	validVirtualService.Spec.Hosts = nil

	return validVirtualService
}

func fakeVirtualServiceMultipleIstioObjects() []*networking_v1.VirtualService {
	return []*networking_v1.VirtualService{fakeVirtualServiceMixedChecker(), fakeVirtualServicesMultipleChecks()}
}
