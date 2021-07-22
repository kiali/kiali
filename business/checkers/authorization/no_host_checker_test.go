package authorization

import (
	"testing"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestPresentService(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"details", "reviews"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      map[string][]string{},
		Services:            fakeServices([]string{"details", "reviews"}),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestNonExistingService(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"details", "wrong"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      map[string][]string{},
		Services:            fakeServices([]string{"details", "reviews"}),
	}.Check()

	// Wrong host is not present
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.NoError(common.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", validations[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[1]", validations[0].Path)
}

func TestWildcardHost(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"*", "*.bookinfo", "*.bookinfo.svc.cluster.local"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      map[string][]string{},
		Services:            fakeServices([]string{"details", "reviews"}),
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestWildcardHostOutsideNamespace(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"*.outside", "*.outside.svc.cluster.local"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      map[string][]string{},
		Services:            fakeServices([]string{"details", "reviews"}),
	}.Check()

	assert.True(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 2)
	assert.Equal(models.Unknown, validations[0].Severity)
	assert.NoError(common.ConfirmIstioCheckMessage("validation.unable.cross-namespace", validations[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", validations[0].Path)
	assert.Equal(models.Unknown, validations[1].Severity)
	assert.NoError(common.ConfirmIstioCheckMessage("validation.unable.cross-namespace", validations[1]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[1]", validations[1].Path)
}

func TestServiceEntryPresent(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateExternalServiceEntry()

	validations, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"wikipedia.org"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{serviceEntry}),
		Services:            []core_v1.Service{},
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestServiceEntryNotPresent(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateExternalServiceEntry()
	validations, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"wrong.org"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{serviceEntry}),
		Services:            []core_v1.Service{},
	}.Check()

	// Wrong.org host is not present
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.NoError(common.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", validations[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", validations[0].Path)
}

func TestVirtualServicePresent(t *testing.T) {
	assert := assert.New(t)

	virtualService := data.CreateEmptyVirtualService("foo-dev", "foo", []string{"foo-dev.example.com"})
	validations, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"foo-dev.example.com"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      map[string][]string{},
		Services:            []core_v1.Service{},
		VirtualServices:     []kubernetes.IstioObject{virtualService},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestVirtualServiceNotPresent(t *testing.T) {
	assert := assert.New(t)

	virtualService := data.CreateEmptyVirtualService("foo-dev", "foo", []string{"foo-dev.example.com"})
	validations, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"foo-bogus.example.com"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      map[string][]string{},
		Services:            []core_v1.Service{},
		VirtualServices:     []kubernetes.IstioObject{virtualService},
	}.Check()

	// Wrong.org host is not present
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.NoError(common.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", validations[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", validations[0].Path)
}

func TestWildcardServiceEntryHost(t *testing.T) {
	assert := assert.New(t)

	serviceEntry := data.CreateEmptyMeshExternalServiceEntry("googlecard", "google", []string{"*.google.com"})

	validations, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"maps.google.com"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{serviceEntry}),
		Services:            []core_v1.Service{},
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)

	// Not matching
	validations, valid = NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"maps.apple.com"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		ServiceEntries:      kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{serviceEntry}),
		Services:            []core_v1.Service{},
	}.Check()

	// apple.com host is not present
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.NoError(common.ConfirmIstioCheckMessage("authorizationpolicy.nodest.matchingregistry", validations[0]))
	assert.Equal("spec/rules[0]/to[0]/operation/hosts[0]", validations[0].Path)
}

func authPolicyWithHost(hostList []interface{}) kubernetes.IstioObject {
	methods := []interface{}{"GET", "PUT", "PATCH"}
	nss := []interface{}{"bookinfo"}
	selector := map[string]interface{}{"app": "details", "version": "v1"}
	return data.CreateAuthorizationPolicy(nss, methods, hostList, selector)
}

func fakeServices(serviceNames []string) []core_v1.Service {
	services := make([]core_v1.Service, 0, len(serviceNames))

	for _, sName := range serviceNames {
		service := core_v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:      sName,
				Namespace: "bookinfo",
				Labels: map[string]string{
					"app":     sName,
					"version": "v1"}},
			Spec: core_v1.ServiceSpec{
				ClusterIP: "fromservice",
				Type:      "ClusterIP",
				Selector:  map[string]string{"app": sName},
			},
		}

		services = append(services, service)
	}

	return services
}

func TestValidServiceRegistry(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)

	registryService := kubernetes.RegistryStatus{}
	registryService.Hostname = "ratings.mesh2-bookinfo.svc.mesh1-imports.local"

	validations, valid = NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		RegistryStatus:      []*kubernetes.RegistryStatus{&registryService},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	registryService = kubernetes.RegistryStatus{}
	registryService.Hostname = "ratings2.mesh2-bookinfo.svc.mesh1-imports.local"

	validations, valid = NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		RegistryStatus:      []*kubernetes.RegistryStatus{&registryService},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)

	registryService = kubernetes.RegistryStatus{}
	registryService.Hostname = "ratings.bookinfo.svc.cluster.local"

	validations, valid = NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"ratings.bookinfo.svc.cluster.local"}),
		Namespace:           "bookinfo",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		RegistryStatus:      []*kubernetes.RegistryStatus{&registryService},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	registryService = kubernetes.RegistryStatus{}
	registryService.Hostname = "ratings.bookinfo.svc.cluster.local"

	validations, valid = NoHostChecker{
		AuthorizationPolicy: authPolicyWithHost([]interface{}{"ratings2.bookinfo.svc.cluster.local"}),
		Namespace:           "test",
		Namespaces:          models.Namespaces{models.Namespace{Name: "outside"}, models.Namespace{Name: "bookinfo"}},
		RegistryStatus:      []*kubernetes.RegistryStatus{&registryService},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
}
