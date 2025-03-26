package destinationrules

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func appVersionLabel(app, version string) map[string]string {
	return map[string]string{
		"app":     app,
		"version": version,
	}
}

func TestValidHost(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviewsv2", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  data.CreateTestDestinationRule("test-namespace", "name", "reviews"),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidWildcardHost(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviewsv2", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule: data.CreateTestDestinationRule("test-namespace",
			"name", "*.test-namespace.svc.cluster.local"),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidMeshWideHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviewsv2", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  data.CreateTestDestinationRule("test-namespace", "name", "*.local"),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidShortSvcHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviewsv2", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  data.CreateTestDestinationRule("test-namespace", "name", "reviews.test-namespace.svc"),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidServiceNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviewsv2", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  data.CreateTestDestinationRule("test-namespace", "name", "reviews.test-namespace"),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidServiceNamespaceInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	vals, valid := NoDestinationChecker{
		Conf:       config.Get(),
		Namespaces: []string{"test-namespace", "outside-ns"},
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviewsv2", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  data.CreateTestDestinationRule("test-namespace", "name", "reviews.not-a-namespace"),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/host", vals[0].Path)
}

func TestValidServiceNamespaceCrossNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	vals, valid := NoDestinationChecker{
		Conf:       config.Get(),
		Namespaces: []string{"test-namespace", "outside-ns"},
		WorkloadsPerNamespace: map[string]models.Workloads{
			"outside-ns": {
				data.CreateWorkload("reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviewsv2", appVersionLabel("reviews", "v2"))},
		},
		// using outside-ns namespace in host where the workloads are created. this should not fail
		DestinationRule: data.CreateTestDestinationRule("test-namespace", "name", "reviews.outside-ns.svc.cluster.local"),
		// Note that a cross-namespace service should be visible in the registry, otherwise won't be visible
		RegistryServices: append(data.CreateFakeRegistryServicesLabels("reviews", "outside-ns"), data.CreateFakeRegistryServicesLabels("reviews", "test-namespace")...),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestNoValidHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	// reviews is not part of services
	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("detailsv1", appVersionLabel("details", "v1")),
				data.CreateWorkload("otherv1", appVersionLabel("other", "v1"))},
		},
		RegistryServices: []*kubernetes.RegistryService{{}},
		DestinationRule:  data.CreateTestDestinationRule("test-namespace", "name", "reviews"),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/host", vals[0].Path)
}

func TestNoValidShortSvcHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	// Valid cases:
	// reviews.test-namespace
	// reviews.test-namespace.svc
	// reviews.test-namespace.svc.cluster.local
	// Not valid:
	// reviews.test-namespace.svc.cluster
	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("detailsv1", appVersionLabel("details", "v1")),
				data.CreateWorkload("otherv1", appVersionLabel("other", "v1"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  data.CreateTestDestinationRule("test-namespace", "name", "reviews.test-namespace.svc.cluster"),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/host", vals[0].Path)
}

func TestNoMatchingSubset(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	// reviews does not have v2 in known services
	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("reviews", appVersionLabel("reviews", "v1"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  data.CreateTestDestinationRule("test-namespace", "name", "reviews"),
		VirtualServices: []*networking_v1.VirtualService{data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v1", 55),
			data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v2", 45),
				data.CreateEmptyVirtualService("reviews", "test-namespace", []string{"reviews"}),
			),
		)},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetlabels", vals[0]))
	assert.Equal("spec/subsets[0]", vals[0].Path)
}

func TestNoMatchingSubsetWithMoreLabels(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	s1 := &api_networking_v1.Subset{
		Name: "reviewsv2",
		Labels: map[string]string{
			"version": "v2",
		},
	}
	s2 := &api_networking_v1.Subset{
		Name: "reviewsv1",
		Labels: map[string]string{
			"version": "v1",
			"seek":    "notfound",
		},
	}
	dr := data.AddSubsetToDestinationRule(s1,
		data.AddSubsetToDestinationRule(s2, data.CreateEmptyDestinationRule("test-namespace", "name", "reviews")))

	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("reviews", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviews", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  dr,
		VirtualServices: []*networking_v1.VirtualService{data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "reviewsv1", 55),
			data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "reviewsv2", 100),
				data.CreateEmptyVirtualService("reviews", "test-namespace", []string{"reviews"}),
			),
		)},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetlabels", vals[0]))
	assert.Equal("spec/subsets[0]", vals[0].Path)
}

func TestSubsetNotReferenced(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor1("subset-presence-not-referenced.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	dr := loader.FindDestinationRule("testrule", "bookinfo")

	vals, valid := NoDestinationChecker{
		Conf:       config.Get(),
		Namespaces: []string{"bookinfo2", "bookinfo"},
		WorkloadsPerNamespace: map[string]models.Workloads{
			"bookinfo": {
				data.CreateWorkload("reviews", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviews", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  dr,
		VirtualServices:  []*networking_v1.VirtualService{},
	}.Check()

	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.Unknown, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetlabels", vals[0]))
	assert.Equal("spec/subsets[0]", vals[0].Path)
}

func TestSubsetReferenced(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor1("subset-presence-referenced.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	dr := loader.FindDestinationRule("testrule", "bookinfo")

	vs := loader.FindVirtualService("testvs", "bookinfo")

	vals, valid := NoDestinationChecker{
		Conf:       config.Get(),
		Namespaces: []string{"bookinfo2", "bookinfo"},
		WorkloadsPerNamespace: map[string]models.Workloads{
			"bookinfo": {
				data.CreateWorkload("reviews", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviews", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  dr,
		VirtualServices:  []*networking_v1.VirtualService{vs},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetlabels", vals[0]))
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetlabels", vals[1]))
	assert.Equal("spec/subsets[0]", vals[0].Path)
	assert.Equal("spec/subsets[1]", vals[1].Path)
}

func TestSubsetPresentMatchingNotReferenced(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor1("subset-presence-matching-not-referenced.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	dr := loader.FindDestinationRule("testrule", "bookinfo")

	vs := loader.FindVirtualService("testvs", "bookinfo")

	vals, valid := NoDestinationChecker{
		Conf:       config.Get(),
		Namespaces: []string{"bookinfo"},
		WorkloadsPerNamespace: map[string]models.Workloads{
			"bookinfo": {
				data.CreateWorkload("reviews", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviews", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "bookinfo"),
		DestinationRule:  dr,
		VirtualServices:  []*networking_v1.VirtualService{vs},
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestWronglyReferenced(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	loader := yamlFixtureLoaderFor1("subset-presence-wrongly-referenced.yaml")
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}

	dr := loader.FindDestinationRule("testrule", "bookinfo")

	vs := loader.FindVirtualService("testvs", "bookinfo")

	vals, valid := NoDestinationChecker{
		Conf:       config.Get(),
		Namespaces: []string{"bookinfo2", "bookinfo"},
		WorkloadsPerNamespace: map[string]models.Workloads{
			"bookinfo": {
				data.CreateWorkload("reviews", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviews", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  dr,
		VirtualServices:  []*networking_v1.VirtualService{vs},
	}.Check()

	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.Unknown, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetlabels", vals[0]))
	assert.Equal("spec/subsets[0]", vals[0].Path)
}

func TestFailCrossNamespaceHost(t *testing.T) {
	assert := assert.New(t)

	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviewsv2", appVersionLabel("reviews", "v2"))},
		},
		// Intentionally using the same serviceName, but different NS. This SHOULD fail to match the above workloads which are created in test-namespace
		DestinationRule: data.CreateTestDestinationRule("test-namespace", "name", "reviews.different-ns.svc.cluster.local"),
		// Note that a cross-namespace service should be visible in the registry, otherwise won't be visible
		RegistryServices: append(data.CreateFakeRegistryServices("reviews.test-namespace.svc.cluster.local", "test-namespace", "test-namespace"),
			data.CreateFakeRegistryServicesLabels("reviews", "different-ns")...),
	}.Check()

	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	assert.Equal(models.Unknown, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetlabels", vals[0]))
	assert.Equal("spec/subsets[0]", vals[0].Path)
	assert.Equal(models.Unknown, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetlabels", vals[1]))
	assert.Equal("spec/subsets[1]", vals[1].Path)
}

func TestSNIProxyExample(t *testing.T) {
	// https://istio.io/docs/examples/advanced-gateways/wildcard-egress-hosts/#setup-egress-gateway-with-sni-proxy
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateEmptyDestinationRule("test", "disable-mtls-for-sni-proxy", "sni-proxy.local")
	se := data.AddPortDefinitionToServiceEntry(data.CreateEmptyServicePortDefinition(8443, "tcp", "TCP"),
		data.CreateEmptyMeshExternalServiceEntry("sni-proxy", "test", []string{"sni-proxy.local"}))

	vals, valid := NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestWildcardServiceEntry(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateEmptyDestinationRule("test", "disable-mtls-for-sni-proxy", "sni-proxy.local")
	se := data.AddPortDefinitionToServiceEntry(data.CreateEmptyServicePortDefinition(8443, "tcp", "TCP"),
		data.CreateEmptyMeshExternalServiceEntry("sni-proxy", "test", []string{"*.local"}))

	vals, valid := NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestExportedInternalServiceEntry(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateEmptyDestinationRule("bookinfo", "details", "details.bookinfo2.svc.cluster.local")
	se := data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"details.bookinfo2.svc.cluster.local"})

	vals, valid := NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestWildcardExportedInternalServiceEntry(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateEmptyDestinationRule("bookinfo", "details", "details.bookinfo2.svc.cluster.local")
	se := data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"*.bookinfo2.svc.cluster.local"})

	vals, valid := NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestExportedInternalServiceEntryFail(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateEmptyDestinationRule("bookinfo", "details", "details.bookinfo2.svc.cluster.local")
	se := data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"details.bookinfo3.svc.cluster.local"})

	vals, valid := NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/host", vals[0].Path)
}

func TestWildcardExportedInternalServiceEntryFail(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateEmptyDestinationRule("bookinfo", "details", "details.bookinfo2.svc.cluster.local")
	se := data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"*.bookinfo3.svc.cluster.local"})

	vals, valid := NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/host", vals[0].Path)
}

func TestExportedNonFQDNInternalServiceEntryFail(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateEmptyDestinationRule("bookinfo", "details", "details.bookinfo2.svc.cluster.local")
	se := data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"details"})

	vals, valid := NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/host", vals[0].Path)

	dr = data.CreateEmptyDestinationRule("bookinfo", "details", "details")

	vals, valid = NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/host", vals[0].Path)
}

func TestExportedExternalServiceEntry(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateEmptyDestinationRule("bookinfo", "details", "www.myhost.com")
	se := data.CreateEmptyMeshExternalServiceEntry("details-se", "bookinfo3", []string{"www.myhost.com"})

	vals, valid := NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestExportedExternalServiceEntryFail(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateEmptyDestinationRule("bookinfo", "details", "www.mynotexistinghost.com")
	se := data.CreateEmptyMeshExternalServiceEntry("details-se", "bookinfo3", []string{"www.myhost.com"})

	vals, valid := NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
		PolicyAllowAny:  true,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/host", vals[0].Path)
}

func TestNoLabelsInSubset(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviewsv2", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  data.CreateNoLabelsDestinationRule("test-namespace", "name", "reviews"),
	}.Check()

	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.Unknown, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetnolabels", vals[0]))
	assert.Equal("spec/subsets[0]", vals[0].Path)
}

func TestSubsetWithoutLabels(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vals, valid := NoDestinationChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test-namespace": {
				data.CreateWorkload("reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("reviewsv2", appVersionLabel("reviews", "v2"))},
		},
		RegistryServices: data.CreateFakeRegistryServicesLabels("reviews", "test-namespace"),
		DestinationRule:  data.CreateNoSubsetLabelsDestinationRule("test-namespace", "name", "reviews"),
	}.Check()

	assert.True(valid)
	assert.Len(vals, 2)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetnolabels", vals[0]))
	assert.Equal("spec/subsets[0]", vals[0].Path)
	assert.Equal(models.WarningSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetnolabels", vals[1]))
	assert.Equal("spec/subsets[1]", vals[1].Path)
}

func TestValidServiceRegistry(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateEmptyDestinationRule("test", "test-exported", "ratings.mesh2-bookinfo.svc.mesh1-imports.local")
	vals, valid := NoDestinationChecker{
		Conf:            config.Get(),
		DestinationRule: dr,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)

	vals, valid = NoDestinationChecker{
		Conf:             config.Get(),
		DestinationRule:  dr,
		RegistryServices: data.CreateFakeRegistryServices("ratings.mesh2-bookinfo.svc.mesh1-imports.local", "test", "*"),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)

	vals, valid = NoDestinationChecker{
		Conf:             config.Get(),
		DestinationRule:  dr,
		RegistryServices: data.CreateFakeRegistryServices("ratings2.mesh2-bookinfo.svc.mesh1-imports.local", "test", "."),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)

	dr = data.CreateEmptyDestinationRule("test", "test-exported", "ratings.bookinfo.svc.cluster.local")

	vals, valid = NoDestinationChecker{
		Conf:             config.Get(),
		DestinationRule:  dr,
		RegistryServices: data.CreateFakeRegistryServices("ratings.bookinfo.svc.cluster.local", "test", "test"),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)

	vals, valid = NoDestinationChecker{
		Conf:             config.Get(),
		DestinationRule:  dr,
		RegistryServices: data.CreateFakeRegistryServices("ratings2.bookinfo.svc.cluster.local", "test", "test"),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
}

func TestServiceEntryLabelsMatchSubsets(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateDestinationRuleWithLabel("bookinfo", "details", "details.bookinfo.svc.cluster.local", "cluster", "global")
	se := data.AddEndpointToServiceEntry("details.bookinfo.svc.cluster.local", "cluster", "global", data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo", []string{"details.bookinfo.svc.cluster.local"}))

	vals, valid := NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestServiceEntryLabelsNoMatchingSubsets(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	dr := data.CreateDestinationRuleWithLabel("bookinfo", "details", "details.bookinfo.svc.cluster.local", "cluster", "global")
	se := data.AddEndpointToServiceEntry("details.bookinfo.svc.cluster.local", "cluster", "wrong", data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo", []string{"details.bookinfo.svc.cluster.local"}))

	vals, _ := NoDestinationChecker{
		Conf:            config.Get(),
		ServiceEntries:  []*networking_v1.ServiceEntry{se},
		DestinationRule: dr,
	}.Check()

	assert.NotEmpty(vals)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.subsetlabels", vals[0]))
	assert.Equal("spec/subsets[0]", vals[0].Path)
}

func yamlFixtureLoaderFor1(file string) *validations.YamlFixtureLoader {
	path := fmt.Sprintf("../../../tests/data/validations/virtualservices/%s", file)
	return &validations.YamlFixtureLoader{Filename: path}
}
