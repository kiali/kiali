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

	conf := config.NewConfig()
	config.Set(conf)

	virtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews", "v1", -1),
		data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("reviews", "v1", -1),
			data.CreateEmptyVirtualService("reviews", "bookinfo", []string{"reviews"}),
		),
	)

	fakeServices := data.CreateFakeMultiServices([]string{"other.bookinfo.svc.cluster.local", "reviews.bookinfo.svc.cluster.local"}, "bookinfo")

	vals, valid := NoHostChecker{
		Conf:             conf,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
		VirtualService:   virtualService,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidHostWithTwoPartName(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	virtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("ratings.bookinfo2", "v1", -1),
		data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("ratings.bookinfo2", "v1", -1),
			data.CreateEmptyVirtualService("ratings", "bookinfo2", []string{"ratings"}),
		),
	)

	fakeServices := append(
		data.CreateFakeMultiServices([]string{"ratings.bookinfo2.svc.cluster.local"}, "bookinfo2"),
		data.CreateFakeMultiServices([]string{"reviews.bookinfo.svc.cluster.local"}, "bookinfo")...)

	vals, valid := NoHostChecker{
		Conf:             conf,
		VirtualService:   virtualService,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestNoValidHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	fakeServices := data.CreateFakeMultiServices([]string{"other.bookinfo.svc.cluster.local", "details.bookinfo.svc.cluster.local"}, "bookinfo")

	assert := assert.New(t)

	virtualService := data.CreateVirtualService()

	vals, valid := NoHostChecker{
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
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
		Conf:             config.Get(),
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
		VirtualService:   virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", vals[0].Path)
}

func TestNoValidHostWrongNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	fakeServices := append(
		data.CreateFakeMultiServices([]string{"ratings.bookinfo2.svc.cluster.local"}, "bookinfo2"),
		data.CreateFakeMultiServices([]string{"other.bookinfo.svc.cluster.local", "details.bookinfo.svc.cluster.local"}, "bookinfo")...)

	assert := assert.New(t)

	virtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("ratings.bookinfo", "v1", -1),
		data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("ratings", "v1", -1),
			data.CreateEmptyVirtualService("ratings", "bookinfo", []string{"ratings"}),
		),
	)

	vals, valid := NoHostChecker{
		Conf:             config.Get(),
		VirtualService:   virtualService,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
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

	fakeServices2 := append(
		data.CreateFakeMultiServices([]string{"ratings.bookinfo2.svc.cluster.local"}, "bookinfo2"),
		data.CreateFakeMultiServices([]string{"other.bookinfo.svc.cluster.local", "details.bookinfo.svc.cluster.local"}, "bookinfo")...)

	vals, valid = NoHostChecker{
		Conf:             config.Get(),
		VirtualService:   virtualService,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices2, conf),
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

	fakeServices := data.CreateFakeMultiServices([]string{"other.bookinfo.svc.cluster.local", "details.bookinfo.svc.cluster.local"}, "bookinfo")

	virtualService := data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("reviews.outside-namespace", "v1", -1),
		data.CreateEmptyVirtualService("reviews", "test", []string{"reviews"}),
	)

	vals, valid := NoHostChecker{
		Conf:             config.Get(),
		Namespaces:       []string{"test", "outside-namespace"},
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
		VirtualService:   virtualService,
		PolicyAllowAny:   true,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", vals[0].Path)
}

func TestInvalidServiceNamespaceFormatCrossNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	fakeServices := append(
		data.CreateFakeMultiServices([]string{"ratings.bookinfo2.svc.cluster.local"}, "bookinfo2"),
		data.CreateFakeMultiServices([]string{"other.bookinfo.svc.cluster.local", "details.bookinfo.svc.cluster.local"}, "bookinfo")...)

	virtualService := data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("ratings.outside-namespace", "v1", -1),
		data.CreateEmptyVirtualService("ratings", "test", []string{"ratings"}),
	)

	vals, valid := NoHostChecker{
		Conf:             config.Get(),
		Namespaces:       []string{"test", "outside-namespace"},
		VirtualService:   virtualService,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", vals[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", vals[0].Path)

	virtualService = data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("ratings", "v1", -1),
		data.CreateEmptyVirtualService("ratings", "bookinfo", []string{"ratings"}),
	)

	fakeServices2 := append(
		data.CreateFakeMultiServices([]string{"ratings.bookinfo2.svc.cluster.local"}, "bookinfo2"),
		data.CreateFakeMultiServices([]string{"other.bookinfo.svc.cluster.local", "details.bookinfo.svc.cluster.local"}, "bookinfo")...)

	vals, valid = NoHostChecker{
		Conf:             config.Get(),
		Namespaces:       []string{"bookinfo", "bookinfo2"},
		VirtualService:   virtualService,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices2, conf),
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

	fakeServices := data.CreateFakeMultiServices([]string{"my-wiki-rule.bookinfo.svc.cluster.local"}, "bookinfo")

	virtualService := data.CreateVirtualServiceWithServiceEntryTarget()

	vals, valid := NoHostChecker{
		Conf:             config.Get(),
		VirtualService:   virtualService,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)

	// Add ServiceEntry for validity
	serviceEntry := data.CreateExternalServiceEntry()

	vals, valid = NoHostChecker{
		Conf:              config.Get(),
		VirtualService:    virtualService,
		ServiceEntryHosts: kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
		KubeServiceHosts:  kubernetes.KubeServiceFQDNs(fakeServices, conf),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidWildcardServiceEntryHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	fakeServices := data.CreateFakeMultiServices([]string{"duckduckgo.bookinfo.svc.cluster.local"}, "bookinfo")

	virtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("www.google.com", "v1", -1),
		data.CreateEmptyVirtualService("googleIt", "google", []string{"www.google.com"}))

	vals, valid := NoHostChecker{
		Conf:             config.Get(),
		VirtualService:   virtualService,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)

	// Add ServiceEntry for validity
	serviceEntry := data.CreateEmptyMeshExternalServiceEntry("googlecard", "google", []string{"*.google.com"})

	vals, valid = NoHostChecker{
		Conf:              config.Get(),
		VirtualService:    virtualService,
		ServiceEntryHosts: kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{serviceEntry}),
		KubeServiceHosts:  kubernetes.KubeServiceFQDNs(fakeServices, conf),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidServiceRegistry(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioIdentityDomain = "svc.mesh1-imports.local"
	config.Set(conf)

	assert := assert.New(t)

	virtualService := data.AddHttpRoutesToVirtualService(
		data.CreateHttpRouteDestination("ratings.mesh2-bookinfo.svc.mesh1-imports.local", "v1", -1),
		data.CreateEmptyVirtualService("federation-vs", "bookinfo", []string{"*"}))

	vals, valid := NoHostChecker{
		Conf:           config.Get(),
		VirtualService: virtualService,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)

	fakeServices := data.CreateFakeMultiServices([]string{"ratings.mesh2-bookinfo.svc.mesh1-imports.local"}, "mesh2-bookinfo")

	vals, valid = NoHostChecker{
		Conf:             config.Get(),
		VirtualService:   virtualService,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices, conf),
	}.Check()

	assert.True(valid)
	assert.Empty(vals)

	fakeServices2 := data.CreateFakeMultiServices([]string{"ratings2.mesh2-bookinfo.svc.mesh1-imports.local"}, "mesh2-bookinfo")

	vals, valid = NoHostChecker{
		Conf:             config.Get(),
		VirtualService:   virtualService,
		KubeServiceHosts: kubernetes.KubeServiceFQDNs(fakeServices2, conf),
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
}
