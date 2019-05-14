package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestNoCrashOnNil(t *testing.T) {
	assert := assert.New(t)

	typeValidations := NoServiceChecker{
		Namespace:    "test",
		IstioDetails: nil,
		Services:     nil,
	}.Check()

	assert.Empty(typeValidations)
}

func TestAllIstioObjectWithServices(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	validations := NoServiceChecker{
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
		IstioDetails:         fakeIstioDetails(),
		Services:             fakeServiceDetails([]string{"reviews", "details", "product", "customer"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(validations)
	assert.NotEmpty(validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "product-vs"}])
	assert.NotEmpty(validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "customer-dr"}])
	assert.True(validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "product-vs"}].Valid)
	assert.True(validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "customer-dr"}].Valid)
}

func TestDetectObjectWithoutService(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	validations := NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		WorkloadList: data.CreateWorkloadList("test",
			data.CreateWorkloadListItem("reviewsv1", appVersionLabel("reviews", "v1")),
			data.CreateWorkloadListItem("reviewsv2", appVersionLabel("reviews", "v2")),
			data.CreateWorkloadListItem("detailsv1", appVersionLabel("details", "v1")),
			data.CreateWorkloadListItem("detailsv2", appVersionLabel("details", "v2")),
			data.CreateWorkloadListItem("productv1", appVersionLabel("product", "v1")),
			data.CreateWorkloadListItem("productv2", appVersionLabel("product", "v2")),
		),
		Services:             fakeServiceDetails([]string{"reviews", "details", "product"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "product-vs"}].Valid)
	customerDr := validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "customer-dr"}]
	assert.False(customerDr.Valid)
	assert.Equal(1, len(customerDr.Checks))
	assert.Equal("spec/host", customerDr.Checks[0].Path)
	assert.Equal(models.CheckMessage("destinationrules.nodest.matchingregistry"), customerDr.Checks[0].Message)

	validations = NoServiceChecker{
		Namespace: "test",
		WorkloadList: data.CreateWorkloadList("test",
			data.CreateWorkloadListItem("reviewsv1", appVersionLabel("reviews", "v1")),
			data.CreateWorkloadListItem("reviewsv2", appVersionLabel("reviews", "v2")),
			data.CreateWorkloadListItem("detailsv1", appVersionLabel("details", "v1")),
			data.CreateWorkloadListItem("detailsv2", appVersionLabel("details", "v2")),
			data.CreateWorkloadListItem("customerv1", appVersionLabel("customer", "v1")),
			data.CreateWorkloadListItem("customerv2", appVersionLabel("customer", "v2")),
		),
		IstioDetails:         fakeIstioDetails(),
		Services:             fakeServiceDetails([]string{"reviews", "details", "customer"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "customer-dr"}].Valid)
	productVs := validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "product-vs"}]
	assert.False(productVs.Valid)
	assert.Equal(2, len(productVs.Checks))
	assert.Equal("spec/http[0]/route[0]/destination/host", productVs.Checks[0].Path)
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", productVs.Checks[0].Message)
	assert.Equal("spec/tcp[0]/route[0]/destination/host", productVs.Checks[1].Path)
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", productVs.Checks[1].Message)

	validations = NoServiceChecker{
		Namespace: "test",
		WorkloadList: data.CreateWorkloadList("test",
			data.CreateWorkloadListItem("reviewsv1", appVersionLabel("reviews", "v1")),
			data.CreateWorkloadListItem("reviewsv2", appVersionLabel("reviews", "v2")),
			data.CreateWorkloadListItem("productv1", appVersionLabel("product", "v1")),
			data.CreateWorkloadListItem("productv2", appVersionLabel("product", "v2")),
			data.CreateWorkloadListItem("customerv1", appVersionLabel("customer", "v1")),
			data.CreateWorkloadListItem("customerv2", appVersionLabel("customer", "v2")),
		),
		IstioDetails:         fakeIstioDetails(),
		Services:             fakeServiceDetails([]string{"reviews", "product", "customer"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "customer-dr"}].Valid)

	validations = NoServiceChecker{
		Namespace: "test",
		WorkloadList: data.CreateWorkloadList("test",
			data.CreateWorkloadListItem("productv1", appVersionLabel("product", "v1")),
			data.CreateWorkloadListItem("productv2", appVersionLabel("product", "v2")),
			data.CreateWorkloadListItem("detailsv1", appVersionLabel("details", "v1")),
			data.CreateWorkloadListItem("detailsv2", appVersionLabel("details", "v2")),
			data.CreateWorkloadListItem("customerv1", appVersionLabel("customer", "v1")),
			data.CreateWorkloadListItem("customerv2", appVersionLabel("customer", "v2")),
		),
		IstioDetails:         fakeIstioDetails(),
		Services:             fakeServiceDetails([]string{"details", "product", "customer"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "customer-dr"}].Valid)
}

func TestObjectWithoutGateway(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	istioDetails := fakeIstioDetails()
	gateways := make([]interface{}, 1)
	gateways = append(gateways, "non-existant-gateway")

	istioDetails.VirtualServices[0].GetSpec()["gateways"] = gateways
	validations := NoServiceChecker{
		Namespace:            "test",
		IstioDetails:         istioDetails,
		Services:             fakeServiceDetails([]string{"reviews", "product", "customer"}),
		AuthorizationDetails: &kubernetes.RBACDetails{},
	}.Check()

	assert.NotEmpty(validations)

	productVs := validations[models.IstioValidationKey{ObjectType: "virtualservice", Name: "product-vs"}]
	assert.False(productVs.Valid)
	assert.Equal("VirtualService is pointing to a non-existent gateway", productVs.Checks[0].Message)
}

func fakeIstioDetails() *kubernetes.IstioDetails {
	istioDetails := kubernetes.IstioDetails{}

	istioDetails.VirtualServices = []kubernetes.IstioObject{
		data.AddRoutesToVirtualService("http", data.CreateRoute("product", "v1", -1),
			data.AddRoutesToVirtualService("tcp", data.CreateRoute("product", "v1", -1),
				data.CreateEmptyVirtualService("product-vs", "test", []string{"product"}),
			),
		)}

	istioDetails.DestinationRules = []kubernetes.IstioObject{
		data.CreateEmptyDestinationRule("test", "customer-dr", "customer"),
	}

	return &istioDetails
}

func fakeServiceDetails(services []string) []core_v1.Service {
	items := []core_v1.Service{}
	for _, service := range services {
		items = append(items, core_v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: service,
			},
		})
	}
	return items
}

func appVersionLabel(app, version string) map[string]string {
	return map[string]string{
		"app":     app,
		"version": version,
	}
}
