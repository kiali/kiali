package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestNoCrashOnNil(t *testing.T) {
	assert := assert.New(t)

	typeValidations := NoServiceChecker{
		Namespace:         "test",
		IstioConfigList:   models.IstioConfigList{},
		ExportedResources: nil,
		ServiceList:       models.ServiceList{},
	}.Check()

	assert.Empty(typeValidations)
}

func TestAllIstioObjectWithServices(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	vals := NoServiceChecker{
		Namespace: "test",
		WorkloadList: data.CreateWorkloadList("test",
			data.CreateWorkloadListItem("reviewsv1", appVersionLabel("reviews", "v1")),
			data.CreateWorkloadListItem("reviewsv2", appVersionLabel("reviews", "v2")),
			data.CreateWorkloadListItem("detailsv1", appVersionLabel("details", "v1")),
			data.CreateWorkloadListItem("detailsv2", appVersionLabel("details", "v2")),
			data.CreateWorkloadListItem("productv1", appVersionLabel("product", "v1")),
			data.CreateWorkloadListItem("productv2", appVersionLabel("product", "v2")),
			data.CreateWorkloadListItem("customerv1", appVersionLabel("customer", "v1")),
			data.CreateWorkloadListItem("customerv2", appVersionLabel("customer", "v2")),
		),
		IstioConfigList:      *fakeIstioConfigList(),
		ExportedResources:    emptyExportedResources(),
		ServiceList:          fakeServiceList([]string{"reviews", "details", "product", "customer"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(vals)
	assert.NotEmpty(vals[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "test", Name: "product-vs"}])
	assert.NotEmpty(vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "customer-dr"}])
	assert.True(vals[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "test", Name: "product-vs"}].Valid)
	assert.True(vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "customer-dr"}].Valid)
}

func TestDetectObjectWithoutService(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	vals := NoServiceChecker{
		Namespace:         "test",
		IstioConfigList:   *fakeIstioConfigList(),
		ExportedResources: emptyExportedResources(),
		WorkloadList: data.CreateWorkloadList("test",
			data.CreateWorkloadListItem("reviewsv1", appVersionLabel("reviews", "v1")),
			data.CreateWorkloadListItem("reviewsv2", appVersionLabel("reviews", "v2")),
			data.CreateWorkloadListItem("detailsv1", appVersionLabel("details", "v1")),
			data.CreateWorkloadListItem("detailsv2", appVersionLabel("details", "v2")),
			data.CreateWorkloadListItem("productv1", appVersionLabel("product", "v1")),
			data.CreateWorkloadListItem("productv2", appVersionLabel("product", "v2")),
		),
		ServiceList:          fakeServiceList([]string{"reviews", "details", "product"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(vals)
	assert.True(vals[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "test", Name: "product-vs"}].Valid)
	customerDr := vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "customer-dr"}]
	assert.False(customerDr.Valid)
	assert.Equal(1, len(customerDr.Checks))
	assert.Equal("spec/host", customerDr.Checks[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.nodest.matchingregistry", customerDr.Checks[0]))

	vals = NoServiceChecker{
		Namespace: "test",
		WorkloadList: data.CreateWorkloadList("test",
			data.CreateWorkloadListItem("reviewsv1", appVersionLabel("reviews", "v1")),
			data.CreateWorkloadListItem("reviewsv2", appVersionLabel("reviews", "v2")),
			data.CreateWorkloadListItem("detailsv1", appVersionLabel("details", "v1")),
			data.CreateWorkloadListItem("detailsv2", appVersionLabel("details", "v2")),
			data.CreateWorkloadListItem("customerv1", appVersionLabel("customer", "v1")),
			data.CreateWorkloadListItem("customerv2", appVersionLabel("customer", "v2")),
		),
		IstioConfigList:      *fakeIstioConfigList(),
		ExportedResources:    emptyExportedResources(),
		ServiceList:          fakeServiceList([]string{"reviews", "details", "customer"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(vals)
	assert.True(vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "customer-dr"}].Valid)
	productVs := vals[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "test", Name: "product-vs"}]
	assert.False(productVs.Valid)
	assert.Equal(2, len(productVs.Checks))
	assert.Equal("spec/http[0]/route[0]/destination/host", productVs.Checks[0].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", productVs.Checks[0]))
	assert.Equal("spec/tcp[0]/route[0]/destination/host", productVs.Checks[1].Path)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nohost.hostnotfound", productVs.Checks[1]))

	vals = NoServiceChecker{
		Namespace: "test",
		WorkloadList: data.CreateWorkloadList("test",
			data.CreateWorkloadListItem("reviewsv1", appVersionLabel("reviews", "v1")),
			data.CreateWorkloadListItem("reviewsv2", appVersionLabel("reviews", "v2")),
			data.CreateWorkloadListItem("productv1", appVersionLabel("product", "v1")),
			data.CreateWorkloadListItem("productv2", appVersionLabel("product", "v2")),
			data.CreateWorkloadListItem("customerv1", appVersionLabel("customer", "v1")),
			data.CreateWorkloadListItem("customerv2", appVersionLabel("customer", "v2")),
		),
		IstioConfigList:      *fakeIstioConfigList(),
		ExportedResources:    emptyExportedResources(),
		ServiceList:          fakeServiceList([]string{"reviews", "product", "customer"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(vals)
	assert.True(vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "customer-dr"}].Valid)

	vals = NoServiceChecker{
		Namespace: "test",
		WorkloadList: data.CreateWorkloadList("test",
			data.CreateWorkloadListItem("productv1", appVersionLabel("product", "v1")),
			data.CreateWorkloadListItem("productv2", appVersionLabel("product", "v2")),
			data.CreateWorkloadListItem("detailsv1", appVersionLabel("details", "v1")),
			data.CreateWorkloadListItem("detailsv2", appVersionLabel("details", "v2")),
			data.CreateWorkloadListItem("customerv1", appVersionLabel("customer", "v1")),
			data.CreateWorkloadListItem("customerv2", appVersionLabel("customer", "v2")),
		),
		IstioConfigList:      *fakeIstioConfigList(),
		ExportedResources:    emptyExportedResources(),
		ServiceList:          fakeServiceList([]string{"details", "product", "customer"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(vals)
	assert.True(vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "customer-dr"}].Valid)
}

func TestObjectWithoutGateway(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	istioDetails := fakeIstioConfigList()
	gateways := make([]string, 1)
	gateways = append(gateways, "non-existant-gateway")

	istioDetails.VirtualServices[0].Spec.Gateways = gateways
	vals := NoServiceChecker{
		Namespace:            "test",
		IstioConfigList:      *istioDetails,
		ExportedResources:    emptyExportedResources(),
		ServiceList:          fakeServiceList([]string{"reviews", "product", "customer"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(vals)

	productVs := vals[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "test", Name: "product-vs"}]
	assert.False(productVs.Valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("virtualservices.nogateway", productVs.Checks[0]))
}

func fakeIstioConfigList() *models.IstioConfigList {
	istioConfigList := models.IstioConfigList{}

	istioConfigList.VirtualServices = []networking_v1alpha3.VirtualService{
		*data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("product", "v1", -1),
			data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("product", "v1", -1),
				data.CreateEmptyVirtualService("product-vs", "test", []string{"product"}),
			),
		)}

	istioConfigList.DestinationRules = []networking_v1alpha3.DestinationRule{
		*data.CreateEmptyDestinationRule("test", "customer-dr", "customer"),
	}

	return &istioConfigList
}

func emptyExportedResources() *kubernetes.ExportedResources {
	return &kubernetes.ExportedResources{}
}

func fakeServiceList(services []string) models.ServiceList {
	serviceList := models.ServiceList{
		Services: []models.ServiceOverview{},
	}
	for _, service := range services {
		serviceList.Services = append(serviceList.Services, models.ServiceOverview{Name: service})
	}
	return serviceList
}

func appVersionLabel(app, version string) map[string]string {
	return map[string]string{
		"app":     app,
		"version": version,
	}
}
