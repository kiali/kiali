package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	core_v1 "k8s.io/api/core/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestNoCrashOnEmpty(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	typeValidations := NoServiceChecker{
		Conf:             conf,
		IstioConfigList:  emptyIstioConfigList(),
		KubeServiceHosts: kubernetes.NewKubeServiceHosts(nil, conf, nil),
		Services:         []core_v1.Service{},
	}.Check()

	assert.Empty(typeValidations)
}

func TestAllIstioObjectWithServices(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	fakeServices := append(
		data.CreateFakeMultiServices([]string{"product.test.svc.cluster.local"}, "test"),
		data.CreateFakeMultiServices([]string{"reviews.test.svc.cluster.local", "details.test.svc.cluster.local", "customer.test.svc.cluster.local"}, "test")...)

	vals := NoServiceChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("test", "reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("test", "reviewsv2", appVersionLabel("reviews", "v2")),
				data.CreateWorkload("test", "detailsv1", appVersionLabel("details", "v1")),
				data.CreateWorkload("test", "detailsv2", appVersionLabel("details", "v2")),
				data.CreateWorkload("test", "productv1", appVersionLabel("product", "v1")),
				data.CreateWorkload("test", "productv2", appVersionLabel("product", "v2")),
				data.CreateWorkload("test", "customerv1", appVersionLabel("customer", "v1")),
				data.CreateWorkload("test", "customerv2", appVersionLabel("customer", "v2")),
			}},
		IstioConfigList:      fakeIstioConfigList(),
		AuthorizationDetails: &kubernetes.RBACDetails{},
		KubeServiceHosts:     kubernetes.KubeServiceFQDNs(fakeServices, conf),
		Services:             fakeServices,
	}.Check()

	assert.NotEmpty(vals)
	assert.NotEmpty(vals[models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "test", Name: "product-vs"}])
	assert.NotEmpty(vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "customer-dr", Cluster: ""}])
	assert.True(vals[models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "test", Name: "product-vs"}].Valid)
	assert.True(vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "customer-dr"}].Valid)
}

func TestDetectObjectWithoutService(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	fakeServices := append(
		data.CreateFakeMultiServices([]string{"product.test.svc.cluster.local"}, "test"),
		data.CreateFakeMultiServices([]string{"reviews.test.svc.cluster.local", "details.test.svc.cluster.local"}, "test")...)

	vals := NoServiceChecker{
		Conf:            config.Get(),
		IstioConfigList: fakeIstioConfigList(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("test", "reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("test", "reviewsv2", appVersionLabel("reviews", "v2")),
				data.CreateWorkload("test", "detailsv1", appVersionLabel("details", "v1")),
				data.CreateWorkload("test", "detailsv2", appVersionLabel("details", "v2")),
				data.CreateWorkload("test", "productv1", appVersionLabel("product", "v1")),
				data.CreateWorkload("test", "productv2", appVersionLabel("product", "v2")),
			}},
		AuthorizationDetails: &kubernetes.RBACDetails{},
		KubeServiceHosts:     kubernetes.KubeServiceFQDNs(fakeServices, conf),
		Services:             fakeServices,
	}.Check()

	assert.NotEmpty(vals)
	assert.True(vals[models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "test", Name: "product-vs"}].Valid)
	customerDr := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "customer-dr"}]
	assert.False(customerDr.Valid)
	assert.Equal(1, len(customerDr.Checks))
	assert.Equal("spec/host", customerDr.Checks[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.matchingregistry", customerDr.Checks[0]))

	fakeServices2 := data.CreateFakeMultiServices([]string{"reviews.test.svc.cluster.local", "details.test.svc.cluster.local", "customer.test.svc.cluster.local"}, "test")

	vals = NoServiceChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("test", "reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("test", "reviewsv2", appVersionLabel("reviews", "v2")),
				data.CreateWorkload("test", "detailsv1", appVersionLabel("details", "v1")),
				data.CreateWorkload("test", "detailsv2", appVersionLabel("details", "v2")),
				data.CreateWorkload("test", "customerv1", appVersionLabel("customer", "v1")),
				data.CreateWorkload("test", "customerv2", appVersionLabel("customer", "v2")),
			}},
		IstioConfigList:      fakeIstioConfigList(),
		KubeServiceHosts:     kubernetes.KubeServiceFQDNs(fakeServices2, conf),
		Services:             fakeServices2,
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(vals)
	assert.True(vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "customer-dr"}].Valid)
	productVs := vals[models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "test", Name: "product-vs"}]
	assert.False(productVs.Valid)
	assert.Equal(2, len(productVs.Checks))
	assert.Equal("spec/http[0]/route[0]/destination/host", productVs.Checks[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", productVs.Checks[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", productVs.Checks[1].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", productVs.Checks[1]))

	fakeServices3 := data.CreateFakeMultiServices([]string{"reviews.test.svc.cluster.local", "product.test.svc.cluster.local", "customer.test.svc.cluster.local"}, "test")

	vals = NoServiceChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("test", "reviewsv1", appVersionLabel("reviews", "v1")),
				data.CreateWorkload("test", "reviewsv2", appVersionLabel("reviews", "v2")),
				data.CreateWorkload("test", "productv1", appVersionLabel("product", "v1")),
				data.CreateWorkload("test", "productv2", appVersionLabel("product", "v2")),
				data.CreateWorkload("test", "customerv1", appVersionLabel("customer", "v1")),
				data.CreateWorkload("test", "customerv2", appVersionLabel("customer", "v2")),
			}},
		IstioConfigList:      fakeIstioConfigList(),
		KubeServiceHosts:     kubernetes.KubeServiceFQDNs(fakeServices3, conf),
		Services:             fakeServices3,
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(vals)
	assert.True(vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "customer-dr"}].Valid)

	fakeServices4 := data.CreateFakeMultiServices([]string{"details.test.svc.cluster.local", "product.test.svc.cluster.local", "customer.test.svc.cluster.local"}, "test")

	vals = NoServiceChecker{
		Conf: config.Get(),
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("test", "productv1", appVersionLabel("product", "v1")),
				data.CreateWorkload("test", "productv2", appVersionLabel("product", "v2")),
				data.CreateWorkload("test", "detailsv1", appVersionLabel("details", "v1")),
				data.CreateWorkload("test", "detailsv2", appVersionLabel("details", "v2")),
				data.CreateWorkload("test", "customerv1", appVersionLabel("customer", "v1")),
				data.CreateWorkload("test", "customerv2", appVersionLabel("customer", "v2")),
			}},
		IstioConfigList:      fakeIstioConfigList(),
		KubeServiceHosts:     kubernetes.KubeServiceFQDNs(fakeServices4, conf),
		Services:             fakeServices4,
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(vals)
	assert.True(vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "customer-dr"}].Valid)
}

func TestObjectWithoutGateway(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	istioDetails := fakeIstioConfigList()
	// Test both an empty gateway name and a non-existent one; the original code
	// used make([]string, 1) which obscured the intent of testing an empty string.
	gateways := []string{"", "non-existant-gateway"}

	istioDetails.VirtualServices[0].Spec.Gateways = gateways
	fakeServices := data.CreateFakeMultiServices([]string{"reviews.test.svc.cluster.local", "product.test.svc.cluster.local", "customer.test.svc.cluster.local"}, "test")

	vals := NoServiceChecker{
		Conf:                 config.Get(),
		IstioConfigList:      istioDetails,
		KubeServiceHosts:     kubernetes.KubeServiceFQDNs(fakeServices, conf),
		Services:             fakeServices,
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(vals)

	productVs := vals[models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "test", Name: "product-vs"}]
	assert.False(productVs.Valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nogateway", productVs.Checks[0]))
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nogateway", productVs.Checks[1]))
}

func emptyIstioConfigList() *models.IstioConfigList {
	return &models.IstioConfigList{}
}

func fakeIstioConfigList() *models.IstioConfigList {
	result := models.IstioConfigList{}

	result.VirtualServices = []*networking_v1.VirtualService{
		data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("product", "v1", -1),
			data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("product", "v1", -1),
				data.CreateEmptyVirtualService("product-vs", "test", []string{"product"}),
			),
		)}

	result.DestinationRules = []*networking_v1.DestinationRule{
		data.CreateEmptyDestinationRule("test", "customer-dr", "customer"),
	}
	return &result
}

func appVersionLabel(app, version string) map[string]string {
	return map[string]string{
		"app":     app,
		"version": version,
	}
}
