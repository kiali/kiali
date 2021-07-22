package virtual_services

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestValidHost(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"reviews", "other"},
		VirtualService: data.CreateVirtualService(),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestNoValidHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	virtualService := data.CreateVirtualService()

	validations, valid := NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.NoError(common.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", validations[0]))
	assert.Equal("spec/http[0]/route[0]/destination/host", validations[0].Path)
	assert.Equal(models.ErrorSeverity, validations[1].Severity)
	assert.NoError(common.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", validations[1]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", validations[1].Path)

	delete(virtualService.GetSpec(), "http")

	validations, valid = NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.NoError(common.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", validations[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", validations[0].Path)

	delete(virtualService.GetSpec(), "tcp")

	validations, valid = NoHostChecker{
		Namespace:      "test-namespace",
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.ErrorSeverity, validations[0].Severity)
	assert.NoError(common.ConfirmIstioCheckMessage("virtualservices.nohost.invalidprotocol", validations[0]))
	assert.Equal("", validations[0].Path)
}

func TestInvalidServiceNamespaceFormatHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	virtualService := data.AddRoutesToVirtualService("tcp", data.CreateRoute("reviews.outside-namespace", "v1", -1),
		data.CreateEmptyVirtualService("reviews", "test", []string{"reviews"}),
	)

	validations, valid := NoHostChecker{
		Namespace: "test-namespace",
		Namespaces: models.Namespaces{
			models.Namespace{Name: "test"},
			models.Namespace{Name: "outside-namespace"},
		},
		ServiceNames:   []string{"details", "other"},
		VirtualService: virtualService,
	}.Check()

	assert.True(valid)
	assert.NotEmpty(validations)
	assert.Equal(models.Unknown, validations[0].Severity)
	assert.NoError(common.ConfirmIstioCheckMessage("validation.unable.cross-namespace", validations[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", validations[0].Path)
}

func TestValidServiceEntryHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	virtualService := data.CreateVirtualServiceWithServiceEntryTarget()

	validations, valid := NoHostChecker{
		Namespace:      "wikipedia",
		ServiceNames:   []string{"my-wiki-rule"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)

	// Add ServiceEntry for validity
	serviceEntry := data.CreateExternalServiceEntry()

	validations, valid = NoHostChecker{
		Namespace:         "wikipedia",
		ServiceNames:      []string{"my-wiki-rule"},
		VirtualService:    virtualService,
		ServiceEntryHosts: kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{serviceEntry}),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestValidWildcardServiceEntryHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	virtualService := data.AddRoutesToVirtualService("http", data.CreateRoute("www.google.com", "v1", -1),
		data.CreateEmptyVirtualService("googleIt", "google", []string{"www.google.com"}))

	validations, valid := NoHostChecker{
		Namespace:      "google",
		ServiceNames:   []string{"duckduckgo"},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)

	// Add ServiceEntry for validity
	serviceEntry := data.CreateEmptyMeshExternalServiceEntry("googlecard", "google", []string{"*.google.com"})

	validations, valid = NoHostChecker{
		Namespace:         "google",
		ServiceNames:      []string{"duckduckgo"},
		VirtualService:    virtualService,
		ServiceEntryHosts: kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{serviceEntry}),
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestValidServiceRegistry(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	virtualService := data.AddRoutesToVirtualService(
		"http",
		data.CreateRoute("ratings.mesh2-bookinfo.svc.mesh1-imports.local", "v1", -1),
		data.CreateEmptyVirtualService("federation-vs", "bookinfo", []string{"*"}))

	validations, valid := NoHostChecker{
		Namespace:      "bookinfo",
		ServiceNames:   []string{""},
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)

	registryService := kubernetes.RegistryStatus{}
	registryService.Hostname = "ratings.mesh2-bookinfo.svc.mesh1-imports.local"
	validations, valid = NoHostChecker{
		Namespace:      "bookinfo",
		ServiceNames:   []string{""},
		VirtualService: virtualService,
		RegistryStatus: []*kubernetes.RegistryStatus{&registryService},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	registryService = kubernetes.RegistryStatus{}
	registryService.Hostname = "ratings2.mesh2-bookinfo.svc.mesh1-imports.local"
	validations, valid = NoHostChecker{
		Namespace:      "bookinfo",
		ServiceNames:   []string{""},
		VirtualService: virtualService,
		RegistryStatus: []*kubernetes.RegistryStatus{&registryService},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
}
