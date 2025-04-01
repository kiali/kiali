package virtualservices

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

// VirtualService has two routes that all the weights sum 100
func TestServiceWellVirtualServiceValidation(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	vals, valid := RouteChecker{
		Conf:           config.Get(),
		Namespaces:     []string{"test"},
		VirtualService: fakeValidVirtualService(),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(vals)
}

// VirtualService with one route and a weight between 0 and 100
func TestServiceMultipleChecks(t *testing.T) {
	assert := assert.New(t)

	vals, valid := RouteChecker{
		Conf:           config.Get(),
		Namespaces:     []string{"test"},
		VirtualService: fakeOneRouteUnder100(),
	}.Check()

	// wrong weight'ed route rule
	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.route.singleweight", vals[0]))
	assert.Equal(vals[0].Severity, models.WarningSeverity)
	assert.Equal(vals[0].Path, "spec/http[0]/route[0]/weight")

	vals, valid = RouteChecker{
		Conf:           config.Get(),
		Namespaces:     []string{"test"},
		VirtualService: fakeOneTcpRouteUnder100(),
	}.Check()

	// wrong weight'ed route rule
	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.route.singleweight", vals[0]))
	assert.Equal(vals[0].Severity, models.WarningSeverity)
	assert.Equal(vals[0].Path, "spec/tcp[0]/route[0]/weight")

	vals, valid = RouteChecker{
		Conf:           config.Get(),
		Namespaces:     []string{"test"},
		VirtualService: fakeOneTlsRouteUnder100(),
	}.Check()

	// wrong weight'ed route rule
	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.route.singleweight", vals[0]))
	assert.Equal(vals[0].Severity, models.WarningSeverity)
	assert.Equal(vals[0].Path, "spec/tls[0]/route[0]/weight")
}

// VirtualService with one route and no weight
func TestServiceEmptyWeight(t *testing.T) {
	assert := assert.New(t)

	vals, valid := RouteChecker{
		Conf:           config.Get(),
		Namespaces:     []string{"test"},
		VirtualService: fakeOneRouteNoWeight(),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)

	vals, valid = RouteChecker{
		Conf:           config.Get(),
		Namespaces:     []string{"test"},
		VirtualService: fakeOneTcpRouteNoWeight(),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)

	vals, valid = RouteChecker{
		Conf:           config.Get(),
		Namespaces:     []string{"test"},
		VirtualService: fakeOneTlsRouteNoWeight(),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestVSWithRepeatingSubsets(t *testing.T) {
	assert := assert.New(t)

	vals, valid := RouteChecker{
		Conf:           config.Get(),
		Namespaces:     []string{"test"},
		VirtualService: fakeRepeatedSubset(),
	}.Check()
	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 4)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.route.repeatedsubset", vals[0]))
	assert.Equal(vals[0].Severity, models.WarningSeverity)
	assert.Regexp(`spec\/http\[0\]\/route\[[0,2]\]\/host`, vals[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.route.repeatedsubset", vals[3]))
	assert.Equal(vals[3].Severity, models.WarningSeverity)
	assert.Regexp(`spec\/http\[0\]\/route\[[1,3]\]\/host`, vals[3].Path)
}

func TestVSWithRepeatingHostsNoSubsets(t *testing.T) {
	assert := assert.New(t)

	vals, valid := RouteChecker{
		Conf:           config.Get(),
		Namespaces:     []string{"test"},
		VirtualService: fakeRepeatedHosts(),
	}.Check()
	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 4)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.route.repeatedsubset", vals[0]))
	assert.Equal(vals[0].Severity, models.WarningSeverity)
	assert.Regexp(`spec\/http\[0\]\/route\[[0,2]\]\/host`, vals[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.route.repeatedsubset", vals[3]))
	assert.Equal(vals[3].Severity, models.WarningSeverity)
	assert.Regexp(`spec\/http\[0\]\/route\[[1,3]\]\/host`, vals[3].Path)
}

func fakeValidVirtualService() *networking_v1.VirtualService {
	validVirtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v1", 55),
		data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v2", 45),
			data.CreateEmptyVirtualService("reviews-well", "test", []string{"reviews"}),
		),
	)

	return validVirtualService
}

func fakeOneRouteUnder100() *networking_v1.VirtualService {
	virtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v1", 45),
		data.CreateEmptyVirtualService("reviews-multiple", "test", []string{"reviews"}),
	)

	return virtualService
}

func fakeOneTcpRouteUnder100() *networking_v1.VirtualService {
	virtualService := data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("reviews", "v1", 45),
		data.CreateEmptyVirtualService("reviews-multiple", "test", []string{"reviews"}),
	)

	return virtualService
}

func fakeOneTlsRouteUnder100() *networking_v1.VirtualService {
	virtualService := data.AddTlsRoutesToVirtualService(data.CreateTlsRoute("reviews", "v1", 45),
		data.CreateEmptyVirtualService("reviews-multiple", "test", []string{"reviews"}),
	)

	return virtualService
}

func fakeOneRouteNoWeight() *networking_v1.VirtualService {
	virtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v1", 0),
		data.CreateEmptyVirtualService("reviews-multiple", "test", []string{"reviews"}),
	)

	return virtualService
}

func fakeOneTcpRouteNoWeight() *networking_v1.VirtualService {
	virtualService := data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("reviews", "v1", 0),
		data.CreateEmptyVirtualService("reviews-multiple", "test", []string{"reviews"}),
	)

	return virtualService
}

func fakeOneTlsRouteNoWeight() *networking_v1.VirtualService {
	virtualService := data.AddTlsRoutesToVirtualService(data.CreateTlsRoute("reviews", "v1", 0),
		data.CreateEmptyVirtualService("reviews-multiple", "test", []string{"reviews"}),
	)

	return virtualService
}

func fakeRepeatedSubset() *networking_v1.VirtualService {
	validVirtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v1", 55),
		data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v1", 45),
			data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v2", 55),
				data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v2", 45),
					data.CreateEmptyVirtualService("reviews-repeated", "test", []string{"reviews"}),
				),
			),
		),
	)

	return validVirtualService
}

func fakeRepeatedHosts() *networking_v1.VirtualService {
	validVirtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews.test.svc.cluster.local", "", 55),
		data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews.test.svc.cluster.local", "", 45),
			data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews.test.svc.cluster.local", "", 55),
				data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews.test.svc.cluster.local", "", 45),
					data.CreateEmptyVirtualService("reviews-repeated", "test", []string{"reviews"}),
				),
			),
		),
	)

	return validVirtualService
}
