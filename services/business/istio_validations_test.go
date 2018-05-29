package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/services/models"
	"k8s.io/api/core/v1"
)

func TestServiceWellRouteRuleValidation(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	vs := mockValidationService(fakeIstioObjects())
	validations, _ := vs.GetServiceValidations("bookinfo", "reviews")

	// Well configured object
	validObject, ok := validations[models.IstioValidationKey{"routerule", "reviews-well"}]
	assert.True(ok)
	assert.Equal(validObject.Name, "reviews-well")
	assert.Equal(validObject.ObjectType, "routerule")
	assert.Equal(validObject.Valid, true)

	// Assert checks
	assert.Len(validObject.Checks, 0)
}

func TestServiceMultipleChecks(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	vs := mockValidationService(fakeMultipleChecks())
	validations, _ := vs.GetServiceValidations("bookinfo", "reviews")

	// wrong weight'ed route rule
	invalidObject, ok := validations[models.IstioValidationKey{"routerule", "reviews-multiple"}]
	assert.True(ok)
	assert.Equal(invalidObject.Name, "reviews-multiple")
	assert.Equal(invalidObject.ObjectType, "routerule")
	assert.Equal(invalidObject.Valid, false)

	checks := invalidObject.Checks
	assert.Len(checks, 2)

	assert.Equal(checks[0].Message, "Weight should be between 0 and 100")
	assert.Equal(checks[0].Severity, "error")
	assert.Equal(checks[0].Path, "spec/route/weight/155")

	assert.Equal(checks[1].Message, "Weight sum should be 100")
	assert.Equal(checks[1].Severity, "error")
	assert.Equal(checks[1].Path, "")

}

func TestServiceOver100RouteRule(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	vs := mockValidationService(fakeOver100RouteRule())
	validations, _ := vs.GetServiceValidations("bookinfo", "reviews")

	// wrong weight'ed route rule
	invalidObject, ok := validations[models.IstioValidationKey{"routerule", "reviews-100-plus"}]
	assert.True(ok)

	assert.Equal(invalidObject.Name, "reviews-100-plus")
	assert.Equal(invalidObject.ObjectType, "routerule")
	assert.Equal(invalidObject.Valid, false)

	checks := invalidObject.Checks
	assert.Len(checks, 1)

	assert.Equal(checks[0].Message, "Weight sum should be 100")
	assert.Equal(checks[0].Severity, "error")
	assert.Equal(checks[0].Path, "")
}

func TestServiceUnder100RouteRule(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	vs := mockValidationService(fakeUnder100RouteRule())
	validations, _ := vs.GetServiceValidations("bookinfo", "reviews")

	// wrong weight'ed route rule
	invalidObject, ok := validations[models.IstioValidationKey{"routerule", "reviews-100-minus"}]
	assert.True(ok)

	assert.Equal(invalidObject.Name, "reviews-100-minus")
	assert.Equal(invalidObject.ObjectType, "routerule")
	assert.Equal(invalidObject.Valid, false)

	checks := invalidObject.Checks
	assert.Len(checks, 1)
	assert.Equal(checks[0].Message, "Weight sum should be 100")
	assert.Equal(checks[0].Severity, "error")
	assert.Equal(checks[0].Path, "")
}

func TestCombinedCheckers(t *testing.T) {
	assert := assert.New(t)

	vs := mockCombinedValidationService(fakeCombinedIstioDetails(), []string{"details", "product", "customer"})

	validations, _ := vs.GetNamespaceValidations("test")

	assert.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{"destinationpolicy", "details-dp"}].Valid)
	assert.True(validations[models.IstioValidationKey{"virtualservice", "product-vs"}].Valid)
	assert.True(validations[models.IstioValidationKey{"destinationrule", "customer-dr"}].Valid)

	reviewsRr := validations[models.IstioValidationKey{"routerule", "reviews-rr"}]
	assert.False(reviewsRr.Valid)
	assert.Equal(3, len(reviewsRr.Checks))

	assert.Equal("spec/route/weight/155", reviewsRr.Checks[0].Path)
	assert.Equal("Weight should be between 0 and 100", reviewsRr.Checks[0].Message)
	assert.Equal("error", reviewsRr.Checks[0].Severity)

	assert.Equal("", reviewsRr.Checks[1].Path)
	assert.Equal("Weight sum should be 100", reviewsRr.Checks[1].Message)
	assert.Equal("error", reviewsRr.Checks[1].Severity)

	assert.Equal("spec/destination", reviewsRr.Checks[2].Path)
	assert.Equal("Destination doesn't have a valid service", reviewsRr.Checks[2].Message)
	assert.Equal("error", reviewsRr.Checks[2].Severity)
}

func fakeIstioObjects() *kubernetes.IstioDetails {
	validRouteRule := (&kubernetes.RouteRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-well",
		},
		Spec: map[string]interface{}{
			"route": []map[string]interface{}{
				map[string]interface{}{
					"weight": uint64(55),
					"labels": map[string]string{
						"version":   "v1",
						"Namespace": "bookinfo",
					},
				},
				map[string]interface{}{
					"weight": uint64(45),
					"labels": map[string]string{
						"version":   "v1",
						"Namespace": "bookinfo",
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	var istioDetails = &kubernetes.IstioDetails{}
	istioDetails.RouteRules = []kubernetes.IstioObject{validRouteRule}
	return istioDetails
}

func fakeUnder100RouteRule() *kubernetes.IstioDetails {
	routeRule := (&kubernetes.RouteRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-100-minus",
		},
		Spec: map[string]interface{}{
			"route": []map[string]interface{}{
				map[string]interface{}{
					"weight": uint64(45),
					"labels": map[string]string{
						"version":   "v1",
						"Namespace": "bookinfo",
					},
				},
				map[string]interface{}{
					"weight": uint64(45),
					"labels": map[string]string{
						"version":   "v1",
						"Namespace": "bookinfo",
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	var istioDetails = &kubernetes.IstioDetails{}
	istioDetails.RouteRules = []kubernetes.IstioObject{routeRule}
	return istioDetails
}

func fakeOver100RouteRule() *kubernetes.IstioDetails {
	routeRule := (&kubernetes.RouteRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-100-plus",
		},
		Spec: map[string]interface{}{
			"route": []map[string]interface{}{
				map[string]interface{}{
					"weight": uint64(55),
					"labels": map[string]string{
						"version":   "v1",
						"Namespace": "bookinfo",
					},
				},
				map[string]interface{}{
					"weight": uint64(55),
					"labels": map[string]string{
						"version":   "v1",
						"Namespace": "bookinfo",
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	var istioDetails = &kubernetes.IstioDetails{}
	istioDetails.RouteRules = []kubernetes.IstioObject{routeRule}
	return istioDetails
}

func fakeMultipleChecks() *kubernetes.IstioDetails {
	routeRule := (&kubernetes.RouteRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-multiple",
		},
		Spec: map[string]interface{}{
			"route": []map[string]interface{}{
				map[string]interface{}{
					"weight": uint64(155),
					"labels": map[string]string{
						"version":   "v1",
						"Namespace": "bookinfo",
					},
				},
				map[string]interface{}{
					"weight": uint64(45),
					"labels": map[string]string{
						"version":   "v1",
						"Namespace": "bookinfo",
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	var istioDetails = &kubernetes.IstioDetails{}
	istioDetails.RouteRules = []kubernetes.IstioObject{routeRule}
	return istioDetails
}

func mockValidationService(istioObjects *kubernetes.IstioDetails) IstioValidationsService {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetIstioDetails", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(istioObjects, nil)
	k8s.On("GetServicePods", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(&v1.PodList{}, nil)

	return IstioValidationsService{k8s: k8s}
}

func mockCombinedValidationService(istioObjects *kubernetes.IstioDetails, services []string) IstioValidationsService {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetIstioDetails", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(istioObjects, nil)
	k8s.On("GetServices", mock.AnythingOfType("string")).Return(fakeCombinedServices(services), nil)

	return IstioValidationsService{k8s: k8s}
}

func fakeCombinedIstioDetails() *kubernetes.IstioDetails {
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
				"route": []map[string]interface{}{
					{
						"weight": uint64(155),
						"labels": map[string]interface{}{
							"version":   "v1",
							"Namespace": "bookinfo",
						},
					},
					{
						"weight": uint64(45),
						"labels": map[string]interface{}{
							"version":   "v1",
							"Namespace": "bookinfo",
						},
					},
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

func fakeCombinedServices(services []string) *kubernetes.ServiceList {
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
