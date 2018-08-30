package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

func TestNoCrashOnNil(t *testing.T) {
	assert := assert.New(t)

	typeValidations := NoServiceChecker{
		Namespace:    "test",
		IstioDetails: nil,
		ServiceList:  nil,
	}.Check()

	assert.Empty(typeValidations)
}

func TestAllIstioObjectWithServices(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	validations := NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "details", "product", "customer"}),
	}.Check()

	assert.NotEmpty(validations)
	assert.NotEmpty(validations[models.IstioValidationKey{"virtualservice", "product-vs"}])
	assert.NotEmpty(validations[models.IstioValidationKey{"destinationrule", "customer-dr"}])
	assert.True(validations[models.IstioValidationKey{"virtualservice", "product-vs"}].Valid)
	assert.True(validations[models.IstioValidationKey{"destinationrule", "customer-dr"}].Valid)
}

func TestDetectObjectWithoutService(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	validations := NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "details", "product"}),
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{"virtualservice", "product-vs"}].Valid)
	customerDr := validations[models.IstioValidationKey{"destinationrule", "customer-dr"}]
	assert.False(customerDr.Valid)
	assert.Equal(1, len(customerDr.Checks))
	assert.Equal("spec/host", customerDr.Checks[0].Path)
	assert.Equal("Host doesn't have a valid service", customerDr.Checks[0].Message)

	validations = NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "details", "customer"}),
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{"destinationrule", "customer-dr"}].Valid)
	productVs := validations[models.IstioValidationKey{"virtualservice", "product-vs"}]
	assert.False(productVs.Valid)
	assert.Equal(2, len(productVs.Checks))
	assert.Equal("spec/http", productVs.Checks[0].Path)
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", productVs.Checks[0].Message)
	assert.Equal("spec/tcp", productVs.Checks[1].Path)
	assert.Equal("DestinationWeight on route doesn't have a valid service (host not found)", productVs.Checks[1].Message)

	validations = NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "product", "customer"}),
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{"destinationrule", "customer-dr"}].Valid)

	validations = NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"details", "product", "customer"}),
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{"destinationrule", "customer-dr"}].Valid)
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
		Namespace:    "test",
		IstioDetails: istioDetails,
		ServiceList:  fakeServiceDetails([]string{"reviews", "product", "customer"}),
	}.Check()

	assert.NotEmpty(validations)

	productVs := validations[models.IstioValidationKey{"virtualservice", "product-vs"}]
	assert.False(productVs.Valid)
	assert.Equal("VirtualService is pointing to a non-existent gateway", productVs.Checks[0].Message)
}

func fakeIstioDetails() *kubernetes.IstioDetails {
	istioDetails := kubernetes.IstioDetails{}

	istioDetails.VirtualServices = []kubernetes.IstioObject{
		&kubernetes.VirtualService{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "product-vs",
			},
			Spec: map[string]interface{}{
				"hosts": []interface{}{
					"product",
				},
				"http": []interface{}{
					map[string]interface{}{
						"route": []interface{}{
							map[string]interface{}{
								"destination": map[string]interface{}{
									"host":   "product",
									"subset": "v1",
								},
							},
						},
					},
				},
				"tcp": []interface{}{
					map[string]interface{}{
						"route": []interface{}{
							map[string]interface{}{
								"destination": map[string]interface{}{
									"host":   "product",
									"subset": "v1",
								},
							},
						},
					},
				},
			},
		},
	}

	istioDetails.DestinationRules = []kubernetes.IstioObject{
		&kubernetes.DestinationRule{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "customer-dr",
			},
			Spec: map[string]interface{}{
				"host": "customer",
				"subsets": []interface{}{
					map[string]interface{}{
						"name": "v1",
						"labels": map[string]interface{}{
							"version": "v1",
						},
					},
					map[string]interface{}{
						"name": "v2",
						"labels": map[string]interface{}{
							"version": "v2",
						},
					},
				},
			},
		},
	}

	return &istioDetails
}

func fakeServiceDetails(services []string) *v1.ServiceList {
	items := []v1.Service{}

	for _, service := range services {
		items = append(items, v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: service,
			},
		})
	}

	return &v1.ServiceList{
		Items: items,
	}
}
