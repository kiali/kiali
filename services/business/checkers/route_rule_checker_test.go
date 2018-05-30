package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

func prepareTest(istioObject kubernetes.IstioObject) models.IstioValidations {
	istioObjects := []kubernetes.IstioObject{istioObject}

	routeRuleChecker := RouteRuleChecker{"bookinfo", fakePods(), istioObjects}
	return routeRuleChecker.Check()
}

func TestWellRouteRuleValidation(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations := prepareTest(fakeIstioObjects())
	assert.NotEmpty(validations)

	// Well configured object
	validation, ok := validations[models.IstioValidationKey{"routerule", "reviews-well"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-well")
	assert.Equal(validation.ObjectType, "routerule")
	assert.Equal(validation.Valid, true)
	assert.Len(validation.Checks, 0)
}

func TestMultipleCheck(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations := prepareTest(fakeMultipleChecks())
	assert.NotEmpty(validations)

	// route rule with multiple problems
	validation, ok := validations[models.IstioValidationKey{"routerule", "reviews-multiple"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-multiple")
	assert.Equal(validation.ObjectType, "routerule")
	assert.Equal(validation.Valid, false)
	assert.Len(validation.Checks, 2)
}

func TestCorrectPrecedence(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations := prepareTest(fakeCorrectPrecedence())
	assert.NotEmpty(validations)

	// wrong weight'ed route rule
	validation, ok := validations[models.IstioValidationKey{"routerule", "reviews-precedence"}]
	assert.True(ok)
	assert.NotEmpty(validation)
	assert.Equal(validation.Name, "reviews-precedence")
	assert.Equal(validation.ObjectType, "routerule")
	assert.Equal(validation.Valid, true)
	assert.Empty(validation.Checks)
}

func TestNegativePrecedence(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations := prepareTest(fakeNegative())
	assert.NotEmpty(validations)

	// Negative precedence
	validation, ok := validations[models.IstioValidationKey{"routerule", "reviews-negative"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-negative")
	assert.Equal(validation.ObjectType, "routerule")
	assert.Equal(validation.Valid, false)
	assert.Len(validation.Checks, 1)
}

func TestMixedCheckerRoule(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations := prepareTest(fakeMixedChecker())
	assert.NotEmpty(validations)

	// Precedence is incorrect
	validation, ok := validations[models.IstioValidationKey{"routerule", "reviews-mixed"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-mixed")
	assert.Equal(validation.ObjectType, "routerule")
	assert.Equal(validation.Valid, false)
	assert.Len(validation.Checks, 3)
}

func TestMultipleIstioObjects(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	routeRuleChecker := RouteRuleChecker{"bookinfo", fakePods(), fakeMultipleIstioObjects()}
	validations := routeRuleChecker.Check()
	assert.NotEmpty(validations)

	// Precedence is incorrect
	validation, ok := validations[models.IstioValidationKey{"routerule", "reviews-mixed"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-mixed")
	assert.Equal(validation.ObjectType, "routerule")
	assert.Equal(validation.Valid, false)
	assert.Len(validation.Checks, 3)

	// Negative precedence
	validation, ok = validations[models.IstioValidationKey{"routerule", "reviews-negative"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-negative")
	assert.Equal(validation.ObjectType, "routerule")
	assert.Equal(validation.Valid, false)
	assert.Len(validation.Checks, 1)
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
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
				map[string]interface{}{
					"weight": uint64(45),
					"labels": map[string]interface{}{
						"version": "v1",
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
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
				map[string]interface{}{
					"weight": uint64(45),
					"labels": map[string]interface{}{
						"version": "v1",
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
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
				map[string]interface{}{
					"weight": uint64(45),
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return routeRule
}

func fakeMultipleIstioObjects() []kubernetes.IstioObject {
	return []kubernetes.IstioObject{fakeMixedChecker(), fakeNegative()}
}

func fakePods() []v1.Pod {
	return []v1.Pod{
		v1.Pod{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "reviews-12345-hello",
				Labels: map[string]string{
					"version": "v2",
				},
			},
		},
		v1.Pod{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "reviews-54321-hello",
				Labels: map[string]string{
					"version": "v1",
				},
			},
		},
	}
}
