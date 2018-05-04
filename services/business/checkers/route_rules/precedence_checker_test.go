package route_rules

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func TestCheckerWell(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations, valid := PrecedenceChecker{fakeCorrectPrecedence()}.Check()

	// Well configured object
	assert.Empty(validations)
	assert.True(valid)
}

func TestCheckerString(t *testing.T) {
	assert := assert.New(t)

	validations, valid := PrecedenceChecker{fakeString()}.Check()

	// wrong weight'ed route rule
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(validations[0].Message, "Precedence must be a number")
	assert.Equal(validations[0].Severity, "error")
	assert.Equal(validations[0].Path, "spec/precedence/abc")
}

func TestCheckerNegative(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations, valid := PrecedenceChecker{fakeNegative()}.Check()

	// wrong weight'ed route rule
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(validations[0].Message, "Precedence should be greater than or equal to 0")
	assert.Equal(validations[0].Severity, "error")
	assert.Equal(validations[0].Path, "spec/precedence/-1")
}

func fakeCorrectPrecedence() kubernetes.IstioObject {
	validRouteRule := (&kubernetes.RouteRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-well",
		},
		Spec: map[string]interface{}{
			"precedence": uint64(1),
		},
	}).DeepCopyIstioObject()

	return validRouteRule
}

func fakeString() kubernetes.IstioObject {
	validRouteRule := (&kubernetes.RouteRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-string",
		},
		Spec: map[string]interface{}{
			"precedence": "abc",
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
