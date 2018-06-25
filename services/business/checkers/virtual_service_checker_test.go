package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
	"k8s.io/apimachinery/pkg/labels"
)

func prepareTestForVirtualService(istioObject kubernetes.IstioObject) models.IstioValidations {
	istioObjects := []kubernetes.IstioObject{istioObject}

	// Setup mocks
	podList := []v1.Pod{
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v1", "stage": "production"}),
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v2", "stage": "production"}),
	}

	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	virtualServiceChecker := VirtualServiceChecker{"bookinfo",
		podList, destinationList, istioObjects}

	return virtualServiceChecker.Check()
}

func fakePodsForLabels(namespace string, labels labels.Set) v1.Pod {
	return v1.Pod{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews-12345-hello",
			Namespace: namespace,
			Labels:    labels,
		},
	}
}

func fakeDestinationRule(hostName string) kubernetes.IstioObject {
	destinationRule := kubernetes.DestinationRule{
		Spec: map[string]interface{}{
			"host": hostName,
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
	}

	return destinationRule.DeepCopyIstioObject()
}

func TestWellVirtualServiceValidation(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	validations := prepareTestForVirtualService(fakeVirtualServices())
	assert.NotEmpty(validations)

	// Well configured object
	validation, ok := validations[models.IstioValidationKey{"virtualservice", "reviews-well"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-well")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.Equal(validation.Valid, true)
	assert.Len(validation.Checks, 0)
}

func TestVirtualServiceMultipleCheck(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations := prepareTestForVirtualService(fakeVirtualServicesMultipleChecks())
	assert.NotEmpty(validations)

	// route rule with multiple problems
	validation, ok := validations[models.IstioValidationKey{"virtualservice", "reviews-multiple"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-multiple")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.Equal(validation.Valid, false)
	assert.Len(validation.Checks, 2)
}

func TestVirtualServiceMixedChecker(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	validations := prepareTestForVirtualService(fakeVirtualServiceMixedChecker())
	assert.NotEmpty(validations)

	// Precedence is incorrect
	validation, ok := validations[models.IstioValidationKey{"virtualservice", "reviews-mixed"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-mixed")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.Equal(validation.Valid, false)
	assert.Len(validation.Checks, 3)
}

func TestVirtualServiceMultipleIstioObjects(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	podList := []v1.Pod{
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v1", "stage": "production"}),
		fakePodsForLabels("bookinfo", map[string]string{"app": "reviews", "version": "v2", "stage": "production"}),
	}

	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviews"),
	}

	virtualServiceChecker := VirtualServiceChecker{"bookinfo",
		podList, destinationList, fakeVirtualServiceMultipleIstioObjects()}

	validations := virtualServiceChecker.Check()
	assert.NotEmpty(validations)

	// Precedence is incorrect
	validation, ok := validations[models.IstioValidationKey{"virtualservice", "reviews-mixed"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-mixed")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.Equal(validation.Valid, false)
	assert.Len(validation.Checks, 3)

	// Negative precedence
	validation, ok = validations[models.IstioValidationKey{"virtualservice", "reviews-precedence"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-precedence")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.Equal(validation.Valid, false)
	assert.Len(validation.Checks, 1)
}

func fakeVirtualServices() kubernetes.IstioObject {
	validRouteRule := (&kubernetes.RouteRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-well",
		},
		Spec: map[string]interface{}{
			"destination": map[string]interface{}{
				"name": "reviews",
			},
			"route": []map[string]interface{}{
				{
					"weight": uint64(55),
					"labels": map[string]interface{}{
						"version": "v1",
					},
				},
				{
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

func fakeVirtualServicesMultipleChecks() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews-multiple",
			Namespace: "otherbookinfo",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v1",
							},
							"weight": uint64(55),
						},
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v2",
							},
							"weight": uint64(45),
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return validVirtualService
}

func fakeVirtualServiceWrongPrecedence() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews-precedence",
			Namespace: "bookinfo",
		},
		Spec: map[string]interface{}{
			"precedence": "abc",
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v1",
							},
							"weight": uint64(55),
						},
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v2",
							},
							"weight": uint64(45),
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return validVirtualService
}

func fakeVirtualServiceMixedChecker() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews-mixed",
			Namespace: "mistaken",
		},
		Spec: map[string]interface{}{
			"precedence": "abc",
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v1",
							},
							"weight": uint64(55),
						},
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v2",
							},
							"weight": uint64(45),
						},
					},
				},
			},
		},
	}).DeepCopyIstioObject()

	return validVirtualService
}

func fakeVirtualServiceMultipleIstioObjects() []kubernetes.IstioObject {
	return []kubernetes.IstioObject{fakeVirtualServiceMixedChecker(), fakeVirtualServiceWrongPrecedence()}
}
