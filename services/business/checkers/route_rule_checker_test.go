package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

func prepareTest(istioObject kubernetes.IstioObject) *models.IstioTypeValidations {
	istioObjects := []kubernetes.IstioObject{istioObject}

	routeRuleChecker := RouteRuleChecker{istioObjects}
	return routeRuleChecker.Check()
}

func TestWellRouteRuleValidation(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	typeValidations := *(prepareTest(fakeIstioObjects()))
	assert.NotEmpty(typeValidations)

	nameValidations := (*typeValidations["routerule"])
	assert.NotEmpty(nameValidations)

	// Well configured object
	validObject := nameValidations["reviews-well"]
	assert.Equal(validObject.Name, "reviews-well")
	assert.Equal(validObject.ObjectType, "routerule")
	assert.Equal(validObject.Valid, true)
	assert.NotEmpty(validObject)
	assert.Len(validObject.Checks, 0)
}

func TestMultipleCheck(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	typeValidations := *(prepareTest(fakeMultipleChecks()))
	assert.NotEmpty(typeValidations)

	nameValidations := (*typeValidations["routerule"])
	assert.NotEmpty(nameValidations)

	// route rule with multiple problems
	invalidObject := nameValidations["reviews-multiple"]
	assert.NotEmpty(invalidObject)
	assert.Equal(invalidObject.Name, "reviews-multiple")
	assert.Equal(invalidObject.ObjectType, "routerule")
	assert.Equal(invalidObject.Valid, false)
	assert.Len(invalidObject.Checks, 2)
}

func TestCorrectPrecedence(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	typeValidations := *(prepareTest(fakeCorrectPrecedence()))
	assert.NotEmpty(typeValidations)

	nameValidations := (*typeValidations["routerule"])
	assert.NotEmpty(nameValidations)

	// wrong weight'ed route rule
	invalidObject := nameValidations["reviews-precedence"]
	assert.NotEmpty(invalidObject)
	assert.Equal(invalidObject.Name, "reviews-precedence")
	assert.Equal(invalidObject.ObjectType, "routerule")
	assert.Equal(invalidObject.Valid, true)
	assert.Empty(invalidObject.Checks)
}

func TestNegativePrecedence(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	typeValidations := *(prepareTest(fakeNegative()))
	assert.NotEmpty(typeValidations)

	nameValidations := (*typeValidations["routerule"])
	assert.NotEmpty(nameValidations)

	// Negative precedence
	invalidObject := nameValidations["reviews-negative"]
	assert.NotEmpty(invalidObject)
	assert.Equal(invalidObject.Name, "reviews-negative")
	assert.Equal(invalidObject.ObjectType, "routerule")
	assert.Equal(invalidObject.Valid, false)
	assert.Len(invalidObject.Checks, 1)
}

func TestMixedCheckerRoule(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	typeValidations := *(prepareTest(fakeMixedChecker()))
	assert.NotEmpty(typeValidations)

	nameValidations := (*typeValidations["routerule"])
	assert.NotEmpty(nameValidations)

	// Precedence is incorrect
	invalidObject := nameValidations["reviews-mixed"]
	assert.NotEmpty(invalidObject)
	assert.Equal(invalidObject.Name, "reviews-mixed")
	assert.Equal(invalidObject.ObjectType, "routerule")
	assert.Equal(invalidObject.Valid, false)
	assert.Len(invalidObject.Checks, 3)
}

func fakeIstioObjects() kubernetes.IstioObject {
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
						"namespace": "bookinfo",
					},
				},
				map[string]interface{}{
					"weight": uint64(45),
					"labels": map[string]string{
						"version":   "v1",
						"namespace": "bookinfo",
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return validRouteRule
}

func fakeMultipleChecks() kubernetes.IstioObject {
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
						"namespace": "bookinfo",
					},
				},
				map[string]interface{}{
					"weight": uint64(45),
					"labels": map[string]string{
						"version":   "v1",
						"namespace": "bookinfo",
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return routeRule
}

func fakeCorrectPrecedence() kubernetes.IstioObject {
	validRouteRule := (&kubernetes.RouteRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-precedence",
		},
		Spec: map[string]interface{}{
			"precedence": uint64(1),
		},
	}).DeepCopyIstioObject()

	return validRouteRule
}

func fakeNegative() kubernetes.IstioObject {
	routeRule := (&kubernetes.RouteRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-negative",
		},
		Spec: map[string]interface{}{
			"precedence": int64(-1),
		},
	}).DeepCopyIstioObject()

	return routeRule
}

func fakeMixedChecker() kubernetes.IstioObject {
	routeRule := (&kubernetes.RouteRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-mixed",
		},
		Spec: map[string]interface{}{
			"precedence": int64(-1),
			"route": []map[string]interface{}{
				map[string]interface{}{
					"weight": uint64(155),
					"labels": map[string]string{
						"version":   "v1",
						"namespace": "bookinfo",
					},
				},
				map[string]interface{}{
					"weight": uint64(45),
					"labels": map[string]string{
						"version":   "v1",
						"namespace": "bookinfo",
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return routeRule
}
