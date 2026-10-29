package authorization

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestPresentService(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"details.bookinfo.svc.cluster.local", "reviews.bookinfo.svc.cluster.local"}, "bookinfo")

	validations, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"details", "reviews"}),
		Namespaces:          []string{"outside", "bookinfo"},
		ServiceEntries:      map[string][]string{},
		KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices, "svc.cluster.local"),
		PolicyAllowAny:      true,
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestNonExistingService(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"details.bookinfo.svc.cluster.local", "reviews.bookinfo.svc.cluster.local"}, "bookinfo")

	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"details", "wrong"}),
		Namespaces:          []string{"outside", "bookinfo"},
		ServiceEntries:      map[string][]string{},
		KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices, "svc.cluster.local"),
		PolicyAllowAny:      true,
	}.Check()

	// Short-name typo is still flagged (soft registry lint)
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[1]", vals[0].Path)
}

func TestNonExistingServiceNamespaceShorthand(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"details.bookinfo.svc.cluster.local"}, "bookinfo")

	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"missing.bookinfo"}),
		Namespaces:          []string{"bookinfo"},
		ServiceEntries:      map[string][]string{},
		KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices, "svc.cluster.local"),
		PolicyAllowAny:      true,
	}.Check()

	// service.namespace shorthand is registry-checked when the namespace is known
	assert.False(valid)
	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
}

func TestHTTPHostHeaderSkipped(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"details.bookinfo.svc.cluster.local"}, "bookinfo")

	for _, host := range []string{"api.example.com", "wrong.org", "myservice.test", "api.info", "app.tech"} {
		vals, valid := NoHostChecker{
			IdentityDomain:      "svc.cluster.local",
			AuthorizationPolicy: authPolicyWithHost([]string{host}),
			Namespaces:          []string{"bookinfo"},
			ServiceEntries:      map[string][]string{},
			KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices, "svc.cluster.local"),
			PolicyAllowAny:      true,
		}.Check()

		assert.True(valid, "host %q should not be registry-validated", host)
		assert.Empty(vals, "host %q should not produce KIA0104", host)
	}
}

func TestNonExistingServiceErrorSeverity(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"details.bookinfo.svc.cluster.local"}, "bookinfo")

	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"wrong"}),
		Namespaces:          []string{"bookinfo"},
		ServiceEntries:      map[string][]string{},
		KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices, "svc.cluster.local"),
		PolicyAllowAny:      false,
	}.Check()

	assert.False(valid)
	assert.Len(vals, 1)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
}

func TestWildcardHost(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"details.bookinfo.svc.cluster.local", "reviews.bookinfo.svc.cluster.local"}, "bookinfo")

	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"*", "*.bookinfo", "*.bookinfo.svc.cluster.local"}),
		Namespaces:          []string{"outside", "bookinfo"},
		ServiceEntries:      map[string][]string{},
		KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices, "svc.cluster.local"),
	}.Check()

	// Host-header wildcards are valid Istio AuthZ matchers
	assert.True(valid)
	assert.Empty(vals)
}

func TestWildcardHostOutsideNamespace(t *testing.T) {
	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"details.bookinfo.svc.cluster.local", "reviews.bookinfo.svc.cluster.local"}, "bookinfo")

	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"*.outside", "*.outside.svc.cluster.local"}),
		Namespaces:          []string{"outside", "bookinfo"},
		ServiceEntries:      map[string][]string{},
		KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices, "svc.cluster.local"),
	}.Check()

	// Wildcard Host-header matchers are not registry-validated
	assert.True(valid)
	assert.Empty(vals)
}

func TestServiceEntryPresent(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateExternalServiceEntry()

	validations, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"wikipedia.org"}),
		Namespaces:          []string{"outside", "bookinfo"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestExportedInternalServiceEntryPresent(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"details.bookinfo2.svc.cluster.local"})

	validations, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"details.bookinfo2.svc.cluster.local"}),
		Namespaces:          []string{"bookinfo", "bookinfo2", "bookinfo3"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestExportedExternalServiceEntryPresent(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateEmptyMeshExternalServiceEntry("details-se", "bookinfo3", []string{"www.myhost.com"})

	validations, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"www.myhost.com"}),
		Namespaces:          []string{"bookinfo", "bookinfo2", "bookinfo3"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestExportedExternalServiceEntryFail(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateEmptyMeshExternalServiceEntry("details-se", "bookinfo3", []string{"www.myhost.com"})

	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"www.wrong.com"}),
		Namespaces:          []string{"bookinfo", "bookinfo2", "bookinfo3"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
	}.Check()

	// Dotted Host-header values are not registry-validated
	assert.True(valid)
	assert.Empty(vals)
}

func TestWildcardExportedInternalServiceEntryPresent(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"*.bookinfo2.svc.cluster.local"})

	validations, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"details.bookinfo2.svc.cluster.local"}),
		Namespaces:          []string{"bookinfo", "bookinfo2", "bookinfo3"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestWildcardExportedInternalServiceEntryFail(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"details.bookinfo2.svc.cluster.local"})

	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"details.bookinfo3.svc.cluster.local"}),
		Namespaces:          []string{"bookinfo", "bookinfo2", "bookinfo3"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
	}.Check()

	// Dotted Host-header values are not registry-validated
	assert.True(valid)
	assert.Empty(vals)
}

func TestExportedNonFQDNInternalServiceEntryFail(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"details"})

	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"details.bookinfo2.svc.cluster.local"}),
		Namespaces:          []string{"bookinfo", "bookinfo2", "bookinfo3"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
	}.Check()

	// Dotted Host-header values are not registry-validated
	assert.True(valid)
	assert.Empty(vals)
}

func TestServiceEntryNotPresent(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateExternalServiceEntry()
	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"wrong.org"}),
		Namespaces:          []string{"outside", "bookinfo"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
	}.Check()

	// Dotted Host-header values are not registry-validated
	assert.True(valid)
	assert.Empty(vals)
}

func TestExportedInternalServiceEntryNotPresent(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateEmptyMeshInternalServiceEntry("details-se", "bookinfo3", []string{"details.bookinfo2.svc.cluster.local"})
	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"wrong.bookinfo2.svc.cluster.local"}),
		Namespaces:          []string{"bookinfo", "bookinfo2", "bookinfo3"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
	}.Check()

	// Dotted Host-header values are not registry-validated
	assert.True(valid)
	assert.Empty(vals)
}

func TestVirtualServicePresent(t *testing.T) {
	assert := assert.New(t)

	virtualService := *data.CreateEmptyVirtualService("foo-dev", "foo", []string{"foo-dev.example.com"})
	validations, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"foo-dev.example.com"}),
		Namespaces:          []string{"outside", "bookinfo"},
		ServiceEntries:      map[string][]string{},
		VirtualServices:     []*networking_v1.VirtualService{&virtualService},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestVirtualServiceNotPresent(t *testing.T) {
	assert := assert.New(t)

	virtualService := *data.CreateEmptyVirtualService("foo-dev", "foo", []string{"foo-dev.example.com"})
	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"foo-bogus.example.com"}),
		Namespaces:          []string{"outside", "bookinfo"},
		ServiceEntries:      map[string][]string{},
		VirtualServices:     []*networking_v1.VirtualService{&virtualService},
	}.Check()

	// Dotted Host-header values are not registry-validated
	assert.True(valid)
	assert.Empty(vals)
}

func TestWildcardServiceEntryHost(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := *data.CreateEmptyMeshExternalServiceEntry("googlecard", "google", []string{"*.google.com"})

	vals, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"maps.google.com"}),
		Namespaces:          []string{"outside", "bookinfo"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{&serviceEntry}),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)

	// Non-matching dotted Host header is still not registry-validated
	vals, valid = NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"maps.apple.com"}),
		Namespaces:          []string{"outside", "bookinfo"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{&serviceEntry}),
		PolicyAllowAny:      true,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func authPolicyWithHost(hostList []string) *security_v1.AuthorizationPolicy {
	methods := []string{"GET", "PUT", "PATCH"}
	nss := []string{"bookinfo"}
	selector := map[string]string{"app": "details", "version": "v1"}
	return data.CreateAuthorizationPolicy(nss, methods, hostList, selector)
}

func TestValidServiceRegistry(t *testing.T) {
	assert := assert.New(t)

	// Dotted FQDNs are Host-header matchers and skip registry validation
	validations, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}),
		Namespaces:          []string{"outside", "bookinfo"},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioIdentityDomain = "svc.mesh1-imports.local"
	config.Set(conf)
	id := config.ResolveIdentityDomain(conf.ExternalServices.Istio.IstioIdentityDomain, "")

	fakeServices := data.CreateFakeMultiServices([]string{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}, "mesh2-bookinfo")

	validations, valid = NoHostChecker{
		IdentityDomain:      id,
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}),
		Namespaces:          []string{"outside", "bookinfo"},
		KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices, id),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	fakeServices2 := data.CreateFakeMultiServices([]string{"ratings2.mesh2-bookinfo.svc.mesh1-imports.local"}, "mesh2-bookinfo")

	validations, valid = NoHostChecker{
		IdentityDomain:      id,
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}),
		Namespaces:          []string{"outside", "bookinfo"},
		KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices2, id),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	config.Set(config.NewConfig())
	fakeServices3 := data.CreateFakeMultiServices([]string{"ratings.bookinfo.svc.cluster.local"}, "bookinfo")

	validations, valid = NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings.bookinfo.svc.cluster.local"}),
		Namespaces:          []string{"outside", "bookinfo"},
		KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices3, "svc.cluster.local"),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	// Short names remain registry-validated
	validations, valid = NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings2"}),
		Namespaces:          []string{"outside", "bookinfo"},
		KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices3, "svc.cluster.local"),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
}
