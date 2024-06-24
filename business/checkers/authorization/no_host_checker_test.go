package authorization

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestPresentService(t *testing.T) {
	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("details.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	validations, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]string{"details", "reviews"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      map[string][]string{},
		RegistryServices:    append(registryService1, registryService2...),
		PolicyAllowAny:      true,
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestNonExistingService(t *testing.T) {
	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("details.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	vals, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]string{"details", "wrong"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      map[string][]string{},
		RegistryServices:    append(registryService1, registryService2...),
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

	registryService1 := data.CreateFakeRegistryServices("details.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	vals, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]string{"*", "*.bookinfo", "*.bookinfo.svc.cluster.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      map[string][]string{},
		RegistryServices:    append(registryService1, registryService2...),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(vals)
}

func TestWildcardHostOutsideNamespace(t *testing.T) {
	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("details.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	vals, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]string{"*.outside", "*.outside.svc.cluster.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      map[string][]string{},
		RegistryServices:    append(registryService1, registryService2...),
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
		AuthorizationPolicy: authPolicyWithHost([]string{"wikipedia.org"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"details.bookinfo2.svc.cluster.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "bookinfo"}, models.Namespace{Name: "bookinfo2"}, models.Namespace{Name: "bookinfo3"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"www.myhost.com"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "bookinfo"}, models.Namespace{Name: "bookinfo2"}, models.Namespace{Name: "bookinfo3"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"www.wrong.com"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "bookinfo"}, models.Namespace{Name: "bookinfo2"}, models.Namespace{Name: "bookinfo3"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"details.bookinfo2.svc.cluster.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "bookinfo"}, models.Namespace{Name: "bookinfo2"}, models.Namespace{Name: "bookinfo3"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"details.bookinfo3.svc.cluster.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "bookinfo"}, models.Namespace{Name: "bookinfo2"}, models.Namespace{Name: "bookinfo3"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"details.bookinfo2.svc.cluster.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "bookinfo"}, models.Namespace{Name: "bookinfo2"}, models.Namespace{Name: "bookinfo3"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"wrong.org"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"wrong.bookinfo2.svc.cluster.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "bookinfo"}, models.Namespace{Name: "bookinfo2"}, models.Namespace{Name: "bookinfo3"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"foo-dev.example.com"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"foo-bogus.example.com"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"maps.google.com"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{&serviceEntry}),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(vals)

	// Not matching
	vals, valid = NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]string{"maps.apple.com"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
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
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)

	registryService := data.CreateFakeRegistryServices("ratings.mesh2-bookinfo.svc.mesh1-imports.local", "bookinfo", "*")

	validations, valid = NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		RegistryServices:    registryService,
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	registryService = data.CreateFakeRegistryServices("ratings2.mesh2-bookinfo.svc.mesh1-imports.local", "bookinfo", "*")

	validations, valid = NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		RegistryServices:    registryService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)

	registryService = data.CreateFakeRegistryServices("ratings.bookinfo.svc.cluster.local", "bookinfo", "*")

	validations, valid = NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings.bookinfo.svc.cluster.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		RegistryServices:    registryService,
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	registryService = data.CreateFakeRegistryServices("ratings.bookinfo.svc.cluster.local", "bookinfo", "*")

	validations, valid = NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]string{"ratings2.bookinfo.svc.cluster.local"}),
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		RegistryServices:    registryService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
}
