package virtualservices

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestValidHost(t *testing.T) {
	assert := assert.New(t)

	virtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v1", -1),
		data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("reviews", "v1", -1),
			data.CreateEmptyVirtualService("reviews", "bookinfo", []string{"reviews"}),
		),
	)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	vals, valid := NoHostChecker{
		RegistryServices: append(registryService1, registryService2...),
		VirtualService:   virtualService,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidHostExported(t *testing.T) {
	assert := assert.New(t)

	virtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("ratings.bookinfo2", "v1", -1),
		data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("ratings.bookinfo2", "v1", -1),
			data.CreateEmptyVirtualService("ratings", "bookinfo2", []string{"ratings"}),
		),
	)

	registryService := data.CreateFakeRegistryServices("reviews.bookinfo.svc.cluster.local", "bookinfo", "*")

	vals, valid := NoHostChecker{
		VirtualService:   virtualService,
		RegistryServices: append(data.CreateFakeRegistryServices("ratings.bookinfo2.svc.cluster.local", "bookinfo2", "bookinfo2"), registryService...),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestNoValidHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("details.bookinfo.svc.cluster.local", "bookinfo", "*")

	assert := assert.New(t)

	virtualService := data.CreateVirtualService()

	vals, valid := NoHostChecker{
		RegistryServices: append(registryService1, registryService2...),
		VirtualService:   virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[0]))
	assert.Equal("spec/http[0]/route[0]/destination/host", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[1]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", vals[1].Path)

	virtualService.Spec.Http = nil

	vals, valid = NoHostChecker{
		RegistryServices: append(registryService1, registryService2...),
		VirtualService:   virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", vals[0].Path)
}

func TestNoValidExportedHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("details.bookinfo.svc.cluster.local", "bookinfo", "*")

	assert := assert.New(t)

	virtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("ratings.bookinfo", "v1", -1),
		data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("ratings", "v1", -1),
			data.CreateEmptyVirtualService("ratings", "bookinfo", []string{"ratings"}),
		),
	)

	vals, valid := NoHostChecker{
		VirtualService:   virtualService,
		RegistryServices: append(data.CreateFakeRegistryServices("ratings.bookinfo2.svc.cluster.local", "bookinfo2", "*"), append(registryService1, registryService2...)...),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[0]))
	assert.Equal("spec/http[0]/route[0]/destination/host", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[1]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", vals[1].Path)

	virtualService.Spec.Http = nil

	vals, valid = NoHostChecker{
		VirtualService:   virtualService,
		RegistryServices: append(data.CreateFakeRegistryServices("ratings.bookinfo2.svc.cluster.local", "bookinfo2", "."), append(registryService1, registryService2...)...),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", vals[0].Path)
}

func TestInvalidServiceNamespaceFormatHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("details.bookinfo.svc.cluster.local", "bookinfo", "*")

	virtualService := data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("reviews.outside-namespace", "v1", -1),
		data.CreateEmptyVirtualService("reviews", "test", []string{"reviews"}),
	)

	vals, valid := NoHostChecker{
		Namespaces: models.Namespaces{
			models.Namespace{Name: "test"},
			models.Namespace{Name: "outside-namespace"},
		},
		RegistryServices: append(registryService1, registryService2...),
		VirtualService:   virtualService,
		PolicyAllowAny:   true,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", vals[0].Path)
}

func TestInvalidServiceNamespaceFormatExportedHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("other.bookinfo.svc.cluster.local", "bookinfo", "*")
	registryService2 := data.CreateFakeRegistryServices("details.bookinfo.svc.cluster.local", "bookinfo", "*")

	virtualService := data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("ratings.outside-namespace", "v1", -1),
		data.CreateEmptyVirtualService("ratings", "test", []string{"ratings"}),
	)

	vals, valid := NoHostChecker{
		Namespaces: models.Namespaces{
			models.Namespace{Name: "test"},
			models.Namespace{Name: "outside-namespace"},
		},
		VirtualService:   virtualService,
		RegistryServices: append(data.CreateFakeRegistryServices("ratings.bookinfo2.svc.cluster.local", "bookinfo2", "*"), append(registryService1, registryService2...)...),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", vals[0].Path)

	virtualService = data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("ratings", "v1", -1),
		data.CreateEmptyVirtualService("ratings", "bookinfo", []string{"ratings"}),
	)

	vals, valid = NoHostChecker{
		Namespaces: models.Namespaces{
			models.Namespace{Name: "bookinfo"},
			models.Namespace{Name: "bookinfo2"},
		},
		VirtualService:   virtualService,
		RegistryServices: append(data.CreateFakeRegistryServices("ratings.bookinfo2.svc.cluster.local", "bookinfo2", "."), append(registryService1, registryService2...)...),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", vals[0].Path)
}

func TestValidServiceEntryHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("my-wiki-rule.bookinfo.svc.cluster.local", "bookinfo", "*")

	virtualService := data.CreateVirtualServiceWithServiceEntryTarget()

	vals, valid := NoHostChecker{
		VirtualService:   virtualService,
		RegistryServices: registryService1,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)

	// Add ServiceEntry for validity
	serviceEntry := data.CreateExternalServiceEntry()

	vals, valid = NoHostChecker{
		VirtualService:    virtualService,
		ServiceEntryHosts: kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
		RegistryServices:  registryService1,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidWildcardServiceEntryHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	registryService1 := data.CreateFakeRegistryServices("duckduckgo.bookinfo.svc.cluster.local", "bookinfo", "*")

	virtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("www.google.com", "v1", -1),
		data.CreateEmptyVirtualService("googleIt", "google", []string{"www.google.com"}))

	vals, valid := NoHostChecker{
		VirtualService:   virtualService,
		RegistryServices: registryService1,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)

	// Add ServiceEntry for validity
	serviceEntry := data.CreateEmptyMeshExternalServiceEntry("googlecard", "google", []string{"*.google.com"})

	vals, valid = NoHostChecker{
		VirtualService:    virtualService,
		ServiceEntryHosts: kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
		RegistryServices:  registryService1,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidServiceRegistry(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	virtualService := data.AddHttpRoutesToVirtualService(
		data.CreateHttpRouteDestination("ratings.mesh2-bookinfo.svc.mesh1-imports.local", "v1", -1),
		data.CreateEmptyVirtualService("federation-vs", "bookinfo", []string{"*"}))

	vals, valid := NoHostChecker{
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)

	vals, valid = NoHostChecker{
		VirtualService:   virtualService,
		RegistryServices: data.CreateFakeRegistryServices("ratings.mesh2-bookinfo.svc.mesh1-imports.local", "bookinfo", "bookinfo"),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)

	vals, valid = NoHostChecker{
		VirtualService:   virtualService,
		RegistryServices: data.CreateFakeRegistryServices("ratings2.mesh2-bookinfo.svc.mesh1-imports.local", "bookinfo", "."),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
}
