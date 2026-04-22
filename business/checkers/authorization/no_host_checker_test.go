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

	// Wrong host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[1]", vals[0].Path)
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

	// Well configured object
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

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[1]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[1]", vals[1].Path)
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

	// www.wrong.com host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", vals[0].Path)
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

	// details.bookinfo3.svc.cluster.local host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", vals[0].Path)
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

	// details.bookinfo2.svc.cluster.local host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", vals[0].Path)
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

	// Wrong.org host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", vals[0].Path)
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

	// Wrong.org host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", vals[0].Path)
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

	// Wrong.org host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", vals[0].Path)
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

	// Well configured object
	assert.True(valid)
	assert.Empty(vals)

	// Not matching
	vals, valid = NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"maps.apple.com"}),
		Namespaces:          []string{"outside", "bookinfo"},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{&serviceEntry}),
		PolicyAllowAny:      true,
	}.Check()

	// apple.com host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", vals[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", vals[0].Path)
}

func authPolicyWithHost(hostList []string) *security_v1.AuthorizationPolicy {
	methods := []string{"GET", "PUT", "PATCH"}
	nss := []string{"bookinfo"}
	selector := map[string]string{"app": "details", "version": "v1"}
	return data.CreateAuthorizationPolicy(nss, methods, hostList, selector)
}

func TestValidServiceRegistry(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}),
		Namespaces:          []string{"outside", "bookinfo"},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)

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

	assert.False(valid)
	assert.NotEmpty(validations)

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

	fakeServices4 := data.CreateFakeMultiServices([]string{"ratings.bookinfo.svc.cluster.local"}, "bookinfo")

	validations, valid = NoHostChecker{
		IdentityDomain:      "svc.cluster.local",
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings2.bookinfo.svc.cluster.local"}),
		Namespaces:          []string{"outside", "bookinfo"},
		KubeServiceHosts:    kubernetes.KubeServiceFQDNs(fakeServices4, "svc.cluster.local"),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
}
