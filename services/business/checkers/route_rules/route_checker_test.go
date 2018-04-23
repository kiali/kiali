package route_rules

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func TestServiceWellRouteRuleValidation(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations, valid := RouteChecker{fakeIstioObjects()}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestServiceMultipleChecks(t *testing.T) {
	assert := assert.New(t)

	validations, valid := RouteChecker{fakeMultipleChecks()}.Check()

	// wrong weight'ed route rule
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 2)
	assert.Equal(validations[0].Message, "Weight should be between 0 and 100")
	assert.Equal(validations[0].Severity, "error")
	assert.Equal(validations[0].Path, "spec/route/weight/155")

	assert.Equal(validations[1].Message, "Weight sum should be 100")
	assert.Equal(validations[1].Severity, "error")
	assert.Equal(validations[1].Path, "")

}

func TestServiceOver100RouteRule(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations, valid := RouteChecker{fakeOver100RouteRule()}.Check()

	// wrong weight'ed route rule
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(validations[0].Message, "Weight sum should be 100")
	assert.Equal(validations[0].Severity, "error")
	assert.Equal(validations[0].Path, "")
}

func TestServiceUnder100RouteRule(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations, valid := RouteChecker{fakeUnder100RouteRule()}.Check()

	// wrong weight'ed route rule
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(validations[0].Message, "Weight sum should be 100")
	assert.Equal(validations[0].Severity, "error")
	assert.Equal(validations[0].Path, "")
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

func fakeUnder100RouteRule() kubernetes.IstioObject {
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

func fakeOver100RouteRule() kubernetes.IstioObject {
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
						"namespace": "bookinfo",
					},
				},
				map[string]interface{}{
					"weight": uint64(55),
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
