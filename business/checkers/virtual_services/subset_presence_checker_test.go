package virtual_services

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

func TestCheckerWithSubsetMatching(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("bookinfo", "testrule", "reviews"),
	}

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{
			Namespace:        "bookinfo",
			DestinationRules: destinationList,
			VirtualService:   fakeCorrectVersions(protocol),
		}.Check()

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
		data.CreateTestDestinationRule("bookinfo", "testrule", "reviews"),
	}

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{
			Namespace:        "bookinfo",
			DestinationRules: destinationList,
			VirtualService:   fakeCorrectVersionsShortHostname(protocol),
		}.Check()

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

func TestCheckerWithSubsetsMatchingSVCNSHostname(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("bookinfo", "testrule", "reviews"),
	}

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{
			Namespace:        "bookinfo",
			DestinationRules: destinationList,
			VirtualService:   fakeCorrectVersionsSVCNSHostname(protocol),
		}.Check()

		// Well configured object
		assert.Empty(validations)
		assert.True(valid)
	}
}

func fakeCorrectVersionsSVCNSHostname(protocol string) kubernetes.IstioObject {
	validVirtualService :=
		data.AddRoutesToVirtualService(protocol, data.CreateRoute("reviews.bookinfo", "v1", 55),
			data.AddRoutesToVirtualService(protocol, data.CreateRoute("reviews.bookinfo", "v2", 45),
				data.CreateEmptyVirtualService("reviews", "bookinfo", []string{"reviews.bookinfo"}),
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
		data.CreateTestDestinationRule("bookinfo", "testrule", "reviews"),
	}

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{
			Namespace:        "bookinfo",
			DestinationRules: destinationList,
			VirtualService:   fakeWrongSubsets(protocol),
		}.Check()

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

func TestSubsetsNotFoundSVCNS(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("bookinfo", "testrule", "reviews.bookinfo"),
	}

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{
			Namespace:        "bookinfo",
			DestinationRules: destinationList,
			VirtualService:   fakeWrongSubsetsServiceNamespace(protocol),
		}.Check()

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

func fakeWrongSubsetsServiceNamespace(protocol string) kubernetes.IstioObject {
	validVirtualService :=
		data.AddRoutesToVirtualService(protocol, data.CreateRoute("reviews.bookinfo", "not-v2", 45),
			data.AddRoutesToVirtualService(protocol, data.CreateRoute("reviews.bookinfo.svc.cluster.local", "not-v1", 55),
				data.CreateEmptyVirtualService("reviews", "bookinfo", []string{"reviews.bookinfo"}),
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

	validations, valid := SubsetPresenceChecker{
		Namespace:        "bookinfo",
		DestinationRules: destinationList,
		VirtualService:   fakeBadSpec(),
	}.Check()

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
		validations, valid := SubsetPresenceChecker{
			Namespace:        "bookinfo",
			DestinationRules: destinationList,
			VirtualService:   fakeCorrectVersions(protocol),
		}.Check()

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

func TestCorrectServiceEntry(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "testrule", "api.kiali.io"),
	}

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{
			Namespace:        "bookinfo",
			Namespaces:       []string{"bookinfo", "default", "foo", "bar"},
			DestinationRules: destinationList,
			VirtualService:   fakeServiceEntry(protocol, []string{"v1", "v2"}),
		}.Check()

		assert.True(valid)
		assert.Empty(validations)
	}
}

func TestInvalidServiceEntry(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "testrule", "api.kiali.io"),
	}

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{
			Namespace:        "bookinfo",
			Namespaces:       []string{"bookinfo", "default", "foo", "bar"},
			DestinationRules: destinationList,
			VirtualService:   fakeServiceEntry(protocol, []string{"bogus-1", "bogus-2"}),
		}.Check()

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

func fakeServiceEntry(protocol string, versions []string) kubernetes.IstioObject {
	if len(versions) != 2 {
		return nil
	}

	validVirtualService :=
		data.AddRoutesToVirtualService(protocol, data.CreateRoute("api.kiali.io", versions[0], 55),
			data.AddRoutesToVirtualService(protocol, data.CreateRoute("api.kiali.io", versions[1], 45),
				data.CreateEmptyVirtualService("kiali", "bookinfo", []string{"api.kiali.io"}),
			),
		)

	return validVirtualService
}

func TestDestRuleDifferentNamespaceFQDNName(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("wrong-namespace", "testrule", "reviews.bookinfo.svc.cluster.local"),
	}

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{
			Namespace:        "bookinfo",
			Namespaces:       []string{"bookinfo", "default", "foo", "bar"},
			DestinationRules: destinationList,
			VirtualService:   fakeCorrectVersions(protocol),
		}.Check()

		assert.True(valid)
		assert.Empty(validations)
	}
}

func TestDestRuleDifferentNamespaceHalfFQDNName(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("wrong-namespace", "testrule", "reviews.bookinfo"),
	}

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{
			Namespace:        "bookinfo",
			Namespaces:       []string{"bookinfo", "default", "foo", "bar"},
			DestinationRules: destinationList,
			VirtualService:   fakeCorrectVersions(protocol),
		}.Check()

		assert.True(valid)
		assert.Empty(validations)
	}
}

func TestDestRuleDifferentNamespaceShortServiceName(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("wrong-namespace", "testrule", "reviews"),
	}

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		validations, valid := SubsetPresenceChecker{
			Namespace:        "bookinfo",
			Namespaces:       []string{"bookinfo", "default", "foo", "bar"},
			DestinationRules: destinationList,
			VirtualService:   fakeCorrectVersions(protocol),
		}.Check()

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
