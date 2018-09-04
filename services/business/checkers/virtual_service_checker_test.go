package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

func prepareTestForVirtualService(istioObject kubernetes.IstioObject) models.IstioValidations {
	istioObjects := []kubernetes.IstioObject{istioObject}

	// Setup mocks
	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviewsrule", "reviews"),
	}

	virtualServiceChecker := VirtualServiceChecker{"bookinfo", destinationList, istioObjects}

	return virtualServiceChecker.Check()
}

func fakeDestinationRule(ruleName string, hostName string) kubernetes.IstioObject {
	destinationRule := kubernetes.DestinationRule{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: ruleName,
		},
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
	destinationList := []kubernetes.IstioObject{
		fakeDestinationRule("reviewsrule1", "reviews"),
	}

	virtualServiceChecker := VirtualServiceChecker{"bookinfo",
		destinationList, fakeVirtualServiceMultipleIstioObjects()}

	validations := virtualServiceChecker.Check()
	assert.NotEmpty(validations)

	validation, ok := validations[models.IstioValidationKey{"virtualservice", "reviews-mixed"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-mixed")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.Equal(validation.Valid, false)
	assert.Len(validation.Checks, 3)

	validation, ok = validations[models.IstioValidationKey{"virtualservice", "reviews-multiple"}]
	assert.True(ok)
	assert.Equal(validation.Name, "reviews-multiple")
	assert.Equal(validation.ObjectType, "virtualservice")
	assert.Equal(validation.Valid, false)
	assert.Len(validation.Checks, 2)
}

func fakeVirtualServices() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name: "reviews-well",
		},
		Spec: map[string]interface{}{
			"hosts": []interface{}{
				"reviews.prod.svc.cluster.local",
			},
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

func fakeVirtualServicesMultipleChecks() kubernetes.IstioObject {
	validVirtualService := (&kubernetes.VirtualService{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "reviews-multiple",
			Namespace: "bookinfo",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v4",
							},
							"weight": uint64(55),
						},
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v5",
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
			Namespace: "bookinfo",
		},
		Spec: map[string]interface{}{
			"http": []map[string]interface{}{
				{
					"route": []map[string]interface{}{
						{
							"destination": map[string]interface{}{
								"host":   "reviews",
								"subset": "v4",
							},
							"weight": uint64(155),
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
	return []kubernetes.IstioObject{fakeVirtualServiceMixedChecker(), fakeVirtualServicesMultipleChecks()}
}
