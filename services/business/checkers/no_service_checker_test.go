package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
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

	typeValidations := NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "details", "product", "customer"}),
	}.Check()

	assert.NotEmpty(typeValidations)
	assert.NotEmpty((*typeValidations)["routerule"])
	assert.NotEmpty((*typeValidations)["destinationpolicy"])
	assert.NotEmpty((*typeValidations)["virtualservice"])
	assert.NotEmpty((*typeValidations)["destinationrule"])
	assert.NotEmpty((*(*typeValidations)["routerule"])["reviews-rr"])
	assert.NotEmpty((*(*typeValidations)["destinationpolicy"])["details-dp"])
	assert.NotEmpty((*(*typeValidations)["virtualservice"])["product-vs"])
	assert.NotEmpty((*(*typeValidations)["destinationrule"])["customer-dr"])
	assert.True((*(*typeValidations)["routerule"])["reviews-rr"].Valid)
	assert.True((*(*typeValidations)["destinationpolicy"])["details-dp"].Valid)
	assert.True((*(*typeValidations)["virtualservice"])["product-vs"].Valid)
	assert.True((*(*typeValidations)["destinationrule"])["customer-dr"].Valid)
}

func TestDetectObjectWithoutService(t *testing.T) {
	assert := assert.New(t)

	typeValidations := NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "details", "product"}),
	}.Check()

	assert.NotEmpty(typeValidations)
	assert.NotEmpty((*typeValidations)["routerule"])
	assert.NotEmpty((*typeValidations)["destinationpolicy"])
	assert.NotEmpty((*typeValidations)["virtualservice"])
	assert.NotEmpty((*typeValidations)["destinationrule"])
	assert.NotEmpty((*(*typeValidations)["routerule"])["reviews-rr"])
	assert.NotEmpty((*(*typeValidations)["destinationpolicy"])["details-dp"])
	assert.NotEmpty((*(*typeValidations)["virtualservice"])["product-vs"])
	assert.NotEmpty((*(*typeValidations)["destinationrule"])["customer-dr"])
	assert.True((*(*typeValidations)["routerule"])["reviews-rr"].Valid)
	assert.True((*(*typeValidations)["destinationpolicy"])["details-dp"].Valid)
	assert.True((*(*typeValidations)["virtualservice"])["product-vs"].Valid)
	assert.False((*(*typeValidations)["destinationrule"])["customer-dr"].Valid)
	assert.NotEmpty((*(*typeValidations)["destinationrule"])["customer-dr"].Checks)
	assert.Equal(1, len((*(*typeValidations)["destinationrule"])["customer-dr"].Checks))
	assert.Equal("spec/name", (*(*typeValidations)["destinationrule"])["customer-dr"].Checks[0].Path)
	assert.Equal("Name doesn't have a valid service", (*(*typeValidations)["destinationrule"])["customer-dr"].Checks[0].Message)

	typeValidations = NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "details", "customer"}),
	}.Check()

	assert.NotEmpty(typeValidations)
	assert.NotEmpty((*typeValidations)["routerule"])
	assert.NotEmpty((*typeValidations)["destinationpolicy"])
	assert.NotEmpty((*typeValidations)["virtualservice"])
	assert.NotEmpty((*typeValidations)["destinationrule"])
	assert.NotEmpty((*(*typeValidations)["routerule"])["reviews-rr"])
	assert.NotEmpty((*(*typeValidations)["destinationpolicy"])["details-dp"])
	assert.NotEmpty((*(*typeValidations)["virtualservice"])["product-vs"])
	assert.NotEmpty((*(*typeValidations)["destinationrule"])["customer-dr"])
	assert.True((*(*typeValidations)["routerule"])["reviews-rr"].Valid)
	assert.True((*(*typeValidations)["destinationpolicy"])["details-dp"].Valid)
	assert.False((*(*typeValidations)["virtualservice"])["product-vs"].Valid)
	assert.True((*(*typeValidations)["destinationrule"])["customer-dr"].Valid)
	assert.NotEmpty((*(*typeValidations)["virtualservice"])["product-vs"].Checks)
	assert.Equal(1, len((*(*typeValidations)["virtualservice"])["product-vs"].Checks))
	assert.Equal("spec/hosts", (*(*typeValidations)["virtualservice"])["product-vs"].Checks[0].Path)
	assert.Equal("Hosts doesn't have a valid service", (*(*typeValidations)["virtualservice"])["product-vs"].Checks[0].Message)

	typeValidations = NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"reviews", "product", "customer"}),
	}.Check()

	assert.NotEmpty(typeValidations)
	assert.NotEmpty((*typeValidations)["routerule"])
	assert.NotEmpty((*typeValidations)["destinationpolicy"])
	assert.NotEmpty((*typeValidations)["virtualservice"])
	assert.NotEmpty((*typeValidations)["destinationrule"])
	assert.NotEmpty((*(*typeValidations)["routerule"])["reviews-rr"])
	assert.NotEmpty((*(*typeValidations)["destinationpolicy"])["details-dp"])
	assert.NotEmpty((*(*typeValidations)["virtualservice"])["product-vs"])
	assert.NotEmpty((*(*typeValidations)["destinationrule"])["customer-dr"])
	assert.True((*(*typeValidations)["routerule"])["reviews-rr"].Valid)
	assert.False((*(*typeValidations)["destinationpolicy"])["details-dp"].Valid)
	assert.True((*(*typeValidations)["virtualservice"])["product-vs"].Valid)
	assert.True((*(*typeValidations)["destinationrule"])["customer-dr"].Valid)
	assert.NotEmpty((*(*typeValidations)["destinationpolicy"])["details-dp"].Checks)
	assert.Equal(1, len((*(*typeValidations)["destinationpolicy"])["details-dp"].Checks))
	assert.Equal("spec/destination", (*(*typeValidations)["destinationpolicy"])["details-dp"].Checks[0].Path)
	assert.Equal("Destination doesn't have a valid service", (*(*typeValidations)["destinationpolicy"])["details-dp"].Checks[0].Message)

	typeValidations = NoServiceChecker{
		Namespace:    "test",
		IstioDetails: fakeIstioDetails(),
		ServiceList:  fakeServiceDetails([]string{"details", "product", "customer"}),
	}.Check()

	assert.NotEmpty(typeValidations)
	assert.NotEmpty((*typeValidations)["routerule"])
	assert.NotEmpty((*typeValidations)["destinationpolicy"])
	assert.NotEmpty((*typeValidations)["virtualservice"])
	assert.NotEmpty((*typeValidations)["destinationrule"])
	assert.NotEmpty((*(*typeValidations)["routerule"])["reviews-rr"])
	assert.NotEmpty((*(*typeValidations)["destinationpolicy"])["details-dp"])
	assert.NotEmpty((*(*typeValidations)["virtualservice"])["product-vs"])
	assert.NotEmpty((*(*typeValidations)["destinationrule"])["customer-dr"])
	assert.False((*(*typeValidations)["routerule"])["reviews-rr"].Valid)
	assert.True((*(*typeValidations)["destinationpolicy"])["details-dp"].Valid)
	assert.True((*(*typeValidations)["virtualservice"])["product-vs"].Valid)
	assert.True((*(*typeValidations)["destinationrule"])["customer-dr"].Valid)
	assert.NotEmpty((*(*typeValidations)["routerule"])["reviews-rr"].Checks)
	assert.Equal(1, len((*(*typeValidations)["routerule"])["reviews-rr"].Checks))
	assert.Equal("spec/destination", (*(*typeValidations)["routerule"])["reviews-rr"].Checks[0].Path)
	assert.Equal("Destination doesn't have a valid service", (*(*typeValidations)["routerule"])["reviews-rr"].Checks[0].Message)
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
				"name": "customer",
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
