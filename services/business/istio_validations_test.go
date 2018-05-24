package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"k8s.io/api/core/v1"
)

func TestServiceWellRouteRuleValidation(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	vs := mockValidationService(fakeIstioObjects())
	validations, _ := vs.GetServiceValidations("bookinfo", "reviews")

	// Well configured object
	nameValidations := validations["routerule"]
	assert.NotEmpty(nameValidations)
	validObject := (*nameValidations)["reviews-well"]
	assert.NotEmpty(validObject)
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
	nameValidations := validations["routerule"]
	assert.NotEmpty(nameValidations)
	invalidObject := (*nameValidations)["reviews-multiple"]
	assert.NotEmpty(invalidObject)
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
	nameValidations := validations["routerule"]
	assert.NotEmpty(nameValidations)
	invalidObject := (*nameValidations)["reviews-100-plus"]
	assert.NotEmpty(invalidObject)

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
	nameValidations := validations["routerule"]
	assert.NotEmpty(nameValidations)
	invalidObject := (*nameValidations)["reviews-100-minus"]
	assert.NotEmpty(invalidObject)

	assert.Equal(invalidObject.Name, "reviews-100-minus")
	assert.Equal(invalidObject.ObjectType, "routerule")
	assert.Equal(invalidObject.Valid, false)

	checks := invalidObject.Checks
	assert.Len(checks, 1)
	assert.Equal(checks[0].Message, "Weight sum should be 100")
	assert.Equal(checks[0].Severity, "error")
	assert.Equal(checks[0].Path, "")
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
