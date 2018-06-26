package virtual_services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/kubernetes"
)

func TestServiceWellVirtualServiceValidation(t *testing.T) {
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
	assert.Equal(validations[0].Path, "spec/http[0]/route[1]/weight/145")

	assert.Equal(validations[1].Message, "Weight sum should be 100")
	assert.Equal(validations[1].Severity, "error")
	assert.Equal(validations[1].Path, "spec/http[0]/route")

}

func TestServiceOver100VirtualService(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations, valid := RouteChecker{fakeOver100VirtualService()}.Check()

	// wrong weight'ed route rule
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(validations[0].Message, "Weight sum should be 100")
	assert.Equal(validations[0].Severity, "error")
	assert.Equal(validations[0].Path, "spec/http[0]/route")
}

func TestServiceUnder100VirtualService(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations, valid := RouteChecker{fakeUnder100VirtualService()}.Check()

	// wrong weight'ed route rule
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 1)
	assert.Equal(validations[0].Message, "Weight sum should be 100")
	assert.Equal(validations[0].Severity, "error")
	assert.Equal(validations[0].Path, "spec/http[0]/route")
}

func TestOneRouteWithoutWeight(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations, valid := RouteChecker{fakeOneRouteWithoutWeight()}.Check()

	// wrong weight'ed route rule
	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 2)

	assert.Equal(validations[0].Message, "Weight sum should be 100")
	assert.Equal(validations[0].Severity, "error")
	assert.Equal(validations[0].Path, "spec/http[0]/route")

	assert.Equal(validations[1].Message, "All routes should have weight")
	assert.Equal(validations[1].Severity, "error")
	assert.Equal(validations[1].Path, "spec/http[0]/route")
}

func fakeIstioObjects() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-well",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"weight": uint64(55),
							"destination": map[string]string{
								"subset": "v1",
								"host":   "reviews",
							},
						},
						{
							"weight": uint64(45),
							"destination": map[string]string{
								"subset": "v1",
								"host":   "reviews",
							},
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return validVirtualService
}

func fakeUnder100VirtualService() kubernetes.IstioObject {
	routeRule := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-100-minus",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"weight": uint64(45),
							"destination": map[string]string{
								"subset": "v1",
								"host":   "reviews",
							},
						},
						{
							"weight": uint64(45),
							"destination": map[string]string{
								"subset": "v1",
								"host":   "reviews",
							},
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return routeRule
}

func fakeOver100VirtualService() kubernetes.IstioObject {
	routeRule := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-100-plus",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"weight": uint64(55),
							"destination": map[string]string{
								"subset": "v1",
								"host":   "reviews",
							},
						},
						{
							"weight": uint64(55),
							"destination": map[string]string{
								"subset": "v1",
								"host":   "reviews",
							},
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return routeRule
}

func fakeMultipleChecks() kubernetes.IstioObject {
	routeRule := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-multiple",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"weight": uint64(55),
							"destination": map[string]string{
								"subset": "v1",
								"host":   "reviews",
							},
						},
						{
							"weight": uint64(145),
							"destination": map[string]string{
								"subset": "v1",
								"host":   "reviews",
							},
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return routeRule
}

func fakeOneRouteWithoutWeight() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-well",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"weight": uint64(55),
							"destination": map[string]string{
								"subset": "v1",
								"host":   "reviews",
							},
						},
						{
							"destination": map[string]string{
								"subset": "v1",
								"host":   "reviews",
							},
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return validVirtualService
}
