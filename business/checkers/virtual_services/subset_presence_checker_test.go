package virtual_services

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
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

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{"bookinfo",
			destinationList, fakeCorrectVersions(protocol)}.Check()

		// Well configured object
		assert.Empty(validations)
		assert.True(valid)
	}
}

func fakeCorrectVersions(protocol string) kubernetes.IstioObject {
	validVirtualService :=
		data.AddRoutesToVirtualService(protocol, data.CreateRoute("reviews.bookinfo.svc.cluster.local", "v1", 55),
			data.AddRoutesToVirtualService(protocol, data.CreateRoute("reviews.bookinfo.svc.cluster.local", "v2", 45),
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

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{"bookinfo",
			destinationList, fakeCorrectVersionsShortHostname(protocol)}.Check()

		// Well configured object
		assert.Empty(validations)
		assert.True(valid)
	}
}

func fakeCorrectVersionsShortHostname(protocol string) kubernetes.IstioObject {
	validVirtualService :=
		data.AddRoutesToVirtualService(protocol, data.CreateRoute("reviews", "v1", 55),
			data.AddRoutesToVirtualService(protocol, data.CreateRoute("reviews", "v2", 45),
				data.CreateEmptyVirtualService("reviews", "bookinfo", []string{"reviews"}),
			),
		)

	return validVirtualService
}

func TestSubsetsNotFound(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "testrule", "reviews"),
	}

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{"bookinfo",
			destinationList, fakeWrongSubsets(protocol)}.Check()

		// There are no pods no deployments
		assert.True(valid)
		assert.NotEmpty(validations)
		assert.Len(validations, 2)
		assert.Equal(validations[0].Message, models.CheckMessage("virtualservices.subsetpresent.subsetnotfound"))
		assert.Equal(validations[0].Severity, models.WarningSeverity)
		assert.Equal(validations[0].Path, "spec/"+protocol+"[0]/route[0]/destination")

		assert.Equal(validations[1].Message, models.CheckMessage("virtualservices.subsetpresent.subsetnotfound"))
		assert.Equal(validations[1].Severity, models.WarningSeverity)
		assert.Equal(validations[1].Path, "spec/"+protocol+"[0]/route[1]/destination")
	}
}

func fakeWrongSubsets(protocol string) kubernetes.IstioObject {
	validVirtualService :=
		data.AddRoutesToVirtualService(protocol, data.CreateRoute("reviews", "not-v2", 45),
			data.AddRoutesToVirtualService(protocol, data.CreateRoute("reviews.bookinfo.svc.cluster.local", "not-v1", 55),
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

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{"bookinfo",
			destinationList, fakeNilDestination(protocol)}.Check()

		// There are no pods no deployments
		assert.False(valid)
		assert.NotEmpty(validations)
		assert.Len(validations, 1)
		assert.Equal(validations[0].Message, models.CheckMessage("virtualservices.subsetpresent.destinationmandatory"))
		assert.Equal(validations[0].Severity, models.ErrorSeverity)
		assert.Equal(validations[0].Path, "spec/"+protocol+"[0]/route[0]")
	}
}

func fakeNilDestination(protocol string) kubernetes.IstioObject {
	emptyRoute := make(map[string]interface{})
	emptyRoute["weight"] = uint64(55)

	validVirtualService :=
		data.AddRoutesToVirtualService(protocol, data.CreateRoute("reviews.bookinfo.svc.cluster.local", "v2", 45),
			data.AddRoutesToVirtualService(protocol, emptyRoute,
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

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{"bookinfo",
			destinationList, fakeCorrectVersions(protocol)}.Check()

		assert.True(valid)
		assert.NotEmpty(validations)
		assert.Len(validations, 2)
		assert.Equal(validations[0].Message, models.CheckMessage("virtualservices.subsetpresent.subsetnotfound"))
		assert.Equal(validations[0].Severity, models.WarningSeverity)
		assert.Equal(validations[0].Path, "spec/"+protocol+"[0]/route[0]/destination")

		assert.Equal(validations[1].Message, models.CheckMessage("virtualservices.subsetpresent.subsetnotfound"))
		assert.Equal(validations[1].Severity, models.WarningSeverity)
		assert.Equal(validations[1].Path, "spec/"+protocol+"[0]/route[1]/destination")
	}
}
