package virtual_services

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

// VirtualService has two routes that all the weights sum 100
func TestServiceWellVirtualServiceValidation(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations, valid := RouteChecker{fakeValidVirtualService()}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

// VirtualService with one route and a weight between 0 and 100
func TestServiceMultipleChecks(t *testing.T) {
	assert := assert.New(t)

	validations, valid := RouteChecker{fakeOneRouteUnder100()}.Check()

	// wrong weight'ed route rule
	assert.True(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.NoError(common.ConfirmIstioCheckMessage("virtualservices.route.singleweight", validations[0]))
	assert.Equal(validations[0].Severity, models.WarningSeverity)
	assert.Equal(validations[0].Path, "spec/http[0]/route[0]/weight")
}

func TestVSWithRepeatingSubsets(t *testing.T) {
	assert := assert.New(t)

	validations, valid := RouteChecker{fakeRepeatedSubset()}.Check()
	assert.True(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 4)
	assert.NoError(common.ConfirmIstioCheckMessage("virtualservices.route.repeatedsubset", validations[0]))
	assert.Equal(validations[0].Severity, models.WarningSeverity)
	assert.Regexp(`spec\/http\[0\]\/route\[[0,2]\]\/subset`, validations[0].Path)
	assert.NoError(common.ConfirmIstioCheckMessage("virtualservices.route.repeatedsubset", validations[3]))
	assert.Equal(validations[3].Severity, models.WarningSeverity)
	assert.Regexp(`spec\/http\[0\]\/route\[[1,3]\]\/subset`, validations[3].Path)
}

func fakeValidVirtualService() kubernetes.IstioObject {
	validVirtualService := data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v1", 55),
		data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v2", 45),
			data.CreateEmptyVirtualService("reviews-well", "test", []string{"reviews"}),
		),
	)

	return validVirtualService
}

func fakeOneRouteUnder100() kubernetes.IstioObject {
	virtualService := data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v1", 45),
		data.CreateEmptyVirtualService("reviews-multiple", "test", []string{"reviews"}),
	)

	return virtualService
}

func fakeRepeatedSubset() kubernetes.IstioObject {
	validVirtualService := data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v1", 55),
		data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v1", 45),
			data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v2", 55),
				data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v2", 45),
					data.CreateEmptyVirtualService("reviews-repeated", "test", []string{"reviews"}),
				),
			),
		),
	)

	return validVirtualService
}
