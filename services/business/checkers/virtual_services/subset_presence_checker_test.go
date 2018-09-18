package virtual_services

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

func TestCheckerWithPodsMatching(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "testrule", "reviews"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
		destinationList, fakeCorrectVersions()}.Check()

	// Well configured object
	assert.Empty(validations)
	assert.True(valid)
}

func fakeCorrectVersions() kubernetes.IstioObject {
	validVirtualService :=
		data.AddRoutesToVirtualService("http", data.CreateRoute("reviews.bookinfo.svc.cluster.local", "v1", 55),
			data.AddRoutesToVirtualService("http", data.CreateRoute("reviews.bookinfo.svc.cluster.local", "v2", 45),
				data.CreateEmptyVirtualService("reviews", "bookinfo", []string{"reviews.bookinfo.svc.cluster.local"}),
			),
		)

	return validVirtualService
}

func TestCheckerWithSubsetsMatchingShortHostname(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "testrule", "reviews"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
		destinationList, fakeCorrectVersionsShortHostname()}.Check()

	// Well configured object
	assert.Empty(validations)
	assert.True(valid)
}

func fakeCorrectVersionsShortHostname() kubernetes.IstioObject {
	validVirtualService :=
		data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v1", 55),
			data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "v2", 45),
				data.CreateEmptyVirtualService("reviews", "bookinfo", []string{"reviews"}),
			),
		)

	return validVirtualService
}

func TestSubsetsNotFound(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "testrule", "reviews"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
		destinationList, fakeWrongSubsets()}.Check()

	// There are no pods no deployments
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 2)
	assert.Equal(validations[0].Message, "Subset not found")
	assert.Equal(validations[0].Severity, "warning")
	assert.Equal(validations[0].Path, "spec/http[0]/route[0]/destination")

	assert.Equal(validations[1].Message, "Subset not found")
	assert.Equal(validations[1].Severity, "warning")
	assert.Equal(validations[1].Path, "spec/http[0]/route[1]/destination")
}

func fakeWrongSubsets() kubernetes.IstioObject {
	validVirtualService :=
		data.AddRoutesToVirtualService("http", data.CreateRoute("reviews", "not-v2", 45),
			data.AddRoutesToVirtualService("http", data.CreateRoute("reviews.bookinfo.svc.cluster.local", "not-v1", 55),
				data.CreateEmptyVirtualService("reviews", "bookinfo", []string{"reviews"}),
			),
		)

	return validVirtualService
}

func TestVirtualServiceWithoutDestination(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "testrule", "reviews"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
		destinationList, fakeNilDestination()}.Check()

	// There are no pods no deployments
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(validations[0].Message, "Destination field is mandatory")
	assert.Equal(validations[0].Severity, "error")
	assert.Equal(validations[0].Path, "spec/http[0]/route[0]")
}

func fakeNilDestination() kubernetes.IstioObject {
	emptyRoute := make(map[string]interface{})
	emptyRoute["weight"] = uint64(55)

	validVirtualService :=
		data.AddRoutesToVirtualService("http", data.CreateRoute("reviews.bookinfo.svc.cluster.local", "v2", 45),
			data.AddRoutesToVirtualService("http", emptyRoute,
				data.CreateEmptyVirtualService("reviews", "bookinfo", []string{"reviews"}),
			),
		)

	return validVirtualService
}

func TestVirtualServiceWithoutSpec(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "testrule", "reviews"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
		destinationList, fakeBadSpec()}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func fakeBadSpec() kubernetes.IstioObject {
	return data.CreateEmptyVirtualService("reviews", "bookinfo", []string{})
}

func TestWrongDestinationRule(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "testrule", "ratings"),
	}

	validations, valid := SubsetPresenceChecker{"bookinfo",
		destinationList, fakeCorrectVersions()}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 2)
	assert.Equal(validations[0].Message, "Subset not found")
	assert.Equal(validations[0].Severity, "warning")
	assert.Equal(validations[0].Path, "spec/http[0]/route[0]/destination")

	assert.Equal(validations[1].Message, "Subset not found")
	assert.Equal(validations[1].Severity, "warning")
	assert.Equal(validations[1].Path, "spec/http[0]/route[1]/destination")
}
