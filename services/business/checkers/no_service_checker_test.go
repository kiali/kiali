package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

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
	assert := assert.New(t)

	validations := NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "details", "product", "customer"}),
	}.Check()

	assert.NotEmpty(validations)
	assert.NotEmpty(validations[models.IstioValidationKey{"routerule", "reviews-rr"}])
	assert.NotEmpty(validations[models.IstioValidationKey{"destinationpolicy", "details-dp"}])
	assert.NotEmpty(validations[models.IstioValidationKey{"virtualservice", "product-vs"}])
	assert.NotEmpty(validations[models.IstioValidationKey{"destinationrule", "customer-dr"}])
	assert.True(validations[models.IstioValidationKey{"routerule", "reviews-rr"}].Valid)
	assert.True(validations[models.IstioValidationKey{"destinationpolicy", "details-dp"}].Valid)
	assert.True(validations[models.IstioValidationKey{"virtualservice", "product-vs"}].Valid)
	assert.True(validations[models.IstioValidationKey{"destinationrule", "customer-dr"}].Valid)
}

func TestDetectObjectWithoutService(t *testing.T) {
	assert := assert.New(t)

	validations := NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "details", "product"}),
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{"routerule", "reviews-rr"}].Valid)
	assert.True(validations[models.IstioValidationKey{"destinationpolicy", "details-dp"}].Valid)
	assert.True(validations[models.IstioValidationKey{"virtualservice", "product-vs"}].Valid)
	customerDr := validations[models.IstioValidationKey{"destinationrule", "customer-dr"}]
	assert.False(customerDr.Valid)
	assert.Equal(1, len(customerDr.Checks))
	assert.Equal("spec/name", customerDr.Checks[0].Path)
	assert.Equal("Name doesn't have a valid service", customerDr.Checks[0].Message)

	validations = NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "details", "customer"}),
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{"routerule", "reviews-rr"}].Valid)
	assert.True(validations[models.IstioValidationKey{"destinationpolicy", "details-dp"}].Valid)
	assert.True(validations[models.IstioValidationKey{"destinationrule", "customer-dr"}].Valid)
	productVs := validations[models.IstioValidationKey{"virtualservice", "product-vs"}]
	assert.False(productVs.Valid)
	assert.Equal(1, len(productVs.Checks))
	assert.Equal("spec/hosts", productVs.Checks[0].Path)
	assert.Equal("Hosts doesn't have a valid service", productVs.Checks[0].Message)

	validations = NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "product", "customer"}),
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{"routerule", "reviews-rr"}].Valid)
	assert.True(validations[models.IstioValidationKey{"virtualservice", "product-vs"}].Valid)
	assert.True(validations[models.IstioValidationKey{"destinationrule", "customer-dr"}].Valid)
	detailsDp := validations[models.IstioValidationKey{"destinationpolicy", "details-dp"}]
	assert.False(detailsDp.Valid)
	assert.Equal(1, len(detailsDp.Checks))
	assert.Equal("spec/destination", detailsDp.Checks[0].Path)
	assert.Equal("Destination doesn't have a valid service", detailsDp.Checks[0].Message)

	validations = NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"details", "product", "customer"}),
	}.Check()

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{"virtualservice", "product-vs"}].Valid)
	assert.True(validations[models.IstioValidationKey{"destinationpolicy", "details-dp"}].Valid)
	assert.True(validations[models.IstioValidationKey{"destinationrule", "customer-dr"}].Valid)
	reviewsRr := validations[models.IstioValidationKey{"routerule", "reviews-rr"}]
	assert.False(reviewsRr.Valid)
	assert.Equal(1, len(reviewsRr.Checks))
	assert.Equal("spec/destination", reviewsRr.Checks[0].Path)
	assert.Equal("Destination doesn't have a valid service", reviewsRr.Checks[0].Message)
}

func fakeIstioDetails() *kubernetes.IstioDetails {
	istioDetails := kubernetes.IstioDetails{}

	istioDetails.RouteRules = []kubernetes.IstioObject{
		&kubernetes.RouteRule{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "reviews-rr",
			},
			Spec: map[string]interface{}{
				"destination": map[string]interface{}{
					"name": "reviews",
				},
			},
		},
	}

	istioDetails.DestinationPolicies = []kubernetes.IstioObject{
		&kubernetes.DestinationPolicy{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "details-dp",
			},
			Spec: map[string]interface{}{
				"destination": map[string]interface{}{
					"name": "details",
				},
			},
		},
	}

	istioDetails.VirtualServices = []kubernetes.IstioObject{
		&kubernetes.VirtualService{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "product-vs",
			},
			Spec: map[string]interface{}{
				"hosts": []interface{}{
					"product",
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

func fakeServiceDetails(services []string) *kubernetes.ServiceList {
	items := []v1.Service{}

	for _, service := range services {
		items = append(items, v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: service,
			},
		})
	}

	serviceList := kubernetes.ServiceList{
		Services: &v1.ServiceList{
			Items: items,
		},
	}
	return &serviceList
}
