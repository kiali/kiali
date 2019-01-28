package virtual_services

import (
	"testing"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

func TestOneVirtualServicePerHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews"),
		buildVirtualService("virtual-2", "ratings"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	emptyValidationTest(t, validations)

	// First virtual service has a gateway
	vss = []kubernetes.IstioObject{
		buildVirtualServiceWithGateway("virtual-1", "reviews", "bookinfo-gateway"),
		buildVirtualService("virtual-2", "ratings"),
	}
	validations = SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	emptyValidationTest(t, validations)
	emptyValidationTest(t, validations)

	// Second virtual service has a gateway
	vss = []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews"),
		buildVirtualServiceWithGateway("virtual-2", "ratings", "bookinfo-gateway"),
	}
	validations = SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	emptyValidationTest(t, validations)
	emptyValidationTest(t, validations)

	// Both virtual services have a gateway
	vss = []kubernetes.IstioObject{
		buildVirtualServiceWithGateway("virtual-1", "reviews", "bookinfo-gateway"),
		buildVirtualServiceWithGateway("virtual-2", "ratings", "bookinfo-gateway"),
	}

	validations = SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	emptyValidationTest(t, validations)
	emptyValidationTest(t, validations)
}

func TestOneVirtualServicePerFQDNHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "ratings.bookinfo.svc.cluster.local"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	emptyValidationTest(t, validations)
}

func TestOneVirtualServicePerFQDNWildcardHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "*.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "*.eshop.svc.cluster.local"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	emptyValidationTest(t, validations)
}

func TestRepeatingSimpleHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews"),
		buildVirtualService("virtual-2", "reviews"),
	}

	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-1")
	presentValidationTest(t, validations, "virtual-2")
}

func TestRepeatingSimpleHostWithGateway(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualServiceWithGateway("virtual-1", "reviews", "bookinfo"),
		buildVirtualService("virtual-2", "reviews"),
	}

	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	noObjectValidationTest(t, validations, "virtual-1")
	presentValidationTest(t, validations, "virtual-2")

	vss = []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews"),
		buildVirtualServiceWithGateway("virtual-2", "reviews", "bookinfo"),
	}

	validations = SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-1")
	noObjectValidationTest(t, validations, "virtual-2")

	vss = []kubernetes.IstioObject{
		buildVirtualServiceWithGateway("virtual-1", "reviews", "bookinfo"),
		buildVirtualServiceWithGateway("virtual-2", "reviews", "bookinfo"),
	}

	validations = SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	noObjectValidationTest(t, validations, "virtual-1")
	noObjectValidationTest(t, validations, "virtual-2")
	emptyValidationTest(t, validations)
}

func TestRepeatingFQDNHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "reviews.bookinfo.svc.cluster.local"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-2")
}

func TestRepeatingFQDNWildcardHost(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "*.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "*.bookinfo.svc.cluster.local"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-1")
	presentValidationTest(t, validations, "virtual-2")
}

func TestIncludedIntoWildCard(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "*.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "reviews.bookinfo.svc.cluster.local"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-1")
	presentValidationTest(t, validations, "virtual-2")

	// Same test, with different order of appearance
	vss = []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "*.bookinfo.svc.cluster.local"),
	}
	validations = SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-2")
}

func TestShortHostNameIncludedIntoWildCard(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "*.bookinfo.svc.cluster.local"),
		buildVirtualService("virtual-2", "reviews"),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-1")
	presentValidationTest(t, validations, "virtual-2")
}

func TestMultipleHostsFailing(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews"),
		buildVirtualServiceMultipleHosts("virtual-2", []string{"reviews",
			"mongo.backup.svc.cluster.local", "mongo.staging.svc.cluster.local"}),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	presentValidationTest(t, validations, "virtual-1")
	presentValidationTest(t, validations, "virtual-2")
}

func TestMultipleHostsPassing(t *testing.T) {
	vss := []kubernetes.IstioObject{
		buildVirtualService("virtual-1", "reviews"),
		buildVirtualServiceMultipleHosts("virtual-2", []string{"ratings",
			"mongo.backup.svc.cluster.local", "mongo.staging.svc.cluster.local"}),
	}
	validations := SingleHostChecker{
		Namespace:       "bookinfo",
		VirtualServices: vss,
	}.Check()

	emptyValidationTest(t, validations)
}

func buildVirtualService(name, host string) kubernetes.IstioObject {
	return buildVirtualServiceMultipleHosts(name, []string{host})
}

func buildVirtualServiceWithGateway(name, host, gateway string) kubernetes.IstioObject {
	return data.AddGatewaysToVirtualService([]string{gateway}, data.CreateEmptyVirtualService(name,
		"bookinfo", []string{host}))
}

func buildVirtualServiceMultipleHosts(name string, hosts []string) kubernetes.IstioObject {
	return data.CreateEmptyVirtualService(name, "bookinfo", hosts)
}

func emptyValidationTest(t *testing.T, validations models.IstioValidations) {
	assert := assert.New(t)
	assert.Empty(validations)

	validation, ok := validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "virtual-1"}]
	assert.False(ok)
	assert.Nil(validation)

	validation, ok = validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "virtual-2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func noObjectValidationTest(t *testing.T, validations models.IstioValidations, name string) {
	assert := assert.New(t)

	validation, ok := validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: name}]
	assert.False(ok)
	assert.Nil(validation)
}

func presentValidationTest(t *testing.T, validations models.IstioValidations, serviceName string) {
	assert := assert.New(t)
	assert.NotEmpty(validations)

	validation, ok := validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: serviceName}]
	assert.True(ok)

	assert.True(validation.Valid)
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(models.CheckMessage("virtualservices.singlehost"), validation.Checks[0].Message)
	assert.Equal("spec/hosts", validation.Checks[0].Path)
}
