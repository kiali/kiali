package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func prepareTestForVirtualService(istioObject kubernetes.IstioObject) models.IstioValidations {
	istioObjects := []kubernetes.IstioObject{istioObject}

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "reviewsrule", "reviews"),
	}

	virtualServiceChecker := VirtualServiceChecker{"bookinfo", destinationList, istioObjects}

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
	validation, ok := validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "reviews-well"}]
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
	validation, ok := validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "reviews-multiple"}]
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
	validation, ok := validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "reviews-mixed"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-mixed")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.False(validation.Valid)
	assert.Len(validation.Checks, 3)
}

func TestVirtualServiceMultipleIstioObjects(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "reviewsrule1", "reviews"),
	}

	virtualServiceChecker := VirtualServiceChecker{"bookinfo",
		destinationList, fakeVirtualServiceMultipleIstioObjects()}

	validations := virtualServiceChecker.Check()
	assert.NotEmpty(validations)

	validation, ok := validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "reviews-mixed"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-mixed")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.False(validation.Valid)
	assert.Len(validation.Checks, 3)

	validation, ok = validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "reviews-multiple"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-multiple")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.True(validation.Valid)
	assert.Len(validation.Checks, 2)
}

func fakeVirtualServices() kubernetes.IstioObject {
	validVirtualService := data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v1", 55),
		data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v2", 45),
			data.CreateEmptyVirtualService("reviews-well", "prod", []string{"reviews.prod.svc.cluster.local"}),
		),
	).DeepCopyIstioObject()

	return validVirtualService
}

func fakeVirtualServicesMultipleChecks() kubernetes.IstioObject {

	validVirtualService := data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v4", 55),
		data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v5", 45),
			data.CreateEmptyVirtualService("reviews-multiple", "bookinfo", []string{}),
		),
	).DeepCopyIstioObject()
	delete(validVirtualService.GetSpec(), "hosts") // this isn't valid, but we mock the original testdata

	return validVirtualService
}

func fakeVirtualServiceMixedChecker() kubernetes.IstioObject {
	validVirtualService := data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v4", 155),
		data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v2", 45),
			data.CreateEmptyVirtualService("reviews-mixed", "bookinfo", []string{}),
		),
	).DeepCopyIstioObject()
	delete(validVirtualService.GetSpec(), "hosts") // this isn't valid, but we mock the original testdata

	return validVirtualService
}

func fakeVirtualServiceMultipleIstioObjects() []kubernetes.IstioObject {
	return []kubernetes.IstioObject{fakeVirtualServiceMixedChecker(), fakeVirtualServicesMultipleChecks()}
}
