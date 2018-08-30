package business

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/services/models"
)

func TestGetNamespaceValidations(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(fakeCombinedIstioDetails(),
		[]string{"details", "product", "customer"}, fakePods())

	validations, _ := vs.GetNamespaceValidations("test")
	assert.NotEmpty(validations)
	assert.True(validations["test"][models.IstioValidationKey{"virtualservice", "product-vs"}].Valid)
	assert.True(validations["test"][models.IstioValidationKey{"destinationrule", "customer-dr"}].Valid)
}

func TestGetIstioObjectValidations(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(fakeCombinedIstioDetails(), []string{"details", "product", "customer"}, fakePods())

	validations, _ := vs.GetIstioObjectValidations("test", "virtualservices", "product-vs")

	assert.NotEmpty(validations)
}

func mockValidationService(istioObjects *kubernetes.IstioDetails, podList *v1.PodList) IstioValidationsService {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetIstioDetails", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(istioObjects, nil)
	k8s.On("GetServicePods", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string"),
		mock.AnythingOfType("string")).Return(podList, nil)

	return IstioValidationsService{k8s: k8s}
}

func mockCombinedValidationService(istioObjects *kubernetes.IstioDetails, services []string, podList *v1.PodList) IstioValidationsService {
	k8s := new(kubetest.K8SClientMock)
	k8s.On("GetIstioDetails", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(istioObjects, nil)
	k8s.On("GetServices", mock.AnythingOfType("string")).Return(fakeCombinedServices(services), nil)
	k8s.On("GetNamespacePods", mock.AnythingOfType("string")).Return(podList, nil)
	k8s.On("GetVirtualServices", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeCombinedIstioDetails().VirtualServices, nil)
	k8s.On("GetDestinationRules", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeCombinedIstioDetails().DestinationRules, nil)
	k8s.On("GetServiceEntries", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeCombinedIstioDetails().ServiceEntries, nil)
	k8s.On("GetGateways", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(fakeCombinedIstioDetails().Gateways, nil)

	return IstioValidationsService{k8s: k8s}
}

func fakeCombinedIstioDetails() *kubernetes.IstioDetails {
	istioDetails := kubernetes.IstioDetails{}

	istioDetails.VirtualServices = []kubernetes.IstioObject{
		&kubernetes.VirtualService{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "product-vs",
			},
			Spec: map[string]interface{}{
				"hosts": []interface{}{
					"product",
				},
				"http": []interface{}{
					map[string]interface{}{
						"route": []interface{}{
							map[string]interface{}{
								"destination": map[string]interface{}{
									"host":   "product",
									"subset": "v1",
								},
							},
						},
					},
				},
				"tcp": []interface{}{
					map[string]interface{}{
						"route": []interface{}{
							map[string]interface{}{
								"destination": map[string]interface{}{
									"host":   "product",
									"subset": "v1",
								},
							},
						},
					},
				},
			},
		},
	}

	istioDetails.DestinationRules = []kubernetes.IstioObject{
		&kubernetes.DestinationRule{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "product-dr",
			},
			Spec: map[string]interface{}{
				"host": "product",
				"subsets": []interface{}{
					map[string]interface{}{
						"name": "v1",
						"labels": map[string]interface{}{
							"version": "v1",
						},
					},
				},
			},
		},
		&kubernetes.DestinationRule{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "customer-dr",
			},
			Spec: map[string]interface{}{
				"host": "customer",
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

func fakeCombinedServices(services []string) *v1.ServiceList {
	items := []v1.Service{}

	for _, service := range services {
		items = append(items, v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: service,
			},
		})
	}
	return &v1.ServiceList{
		Items: items,
	}
}

func fakePods() *v1.PodList {
	return &v1.PodList{
		Items: []v1.Pod{
			v1.Pod{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "reviews-12345-hello",
					Labels: map[string]string{
						"app":     "reviews",
						"version": "v2",
					},
				},
			},
			v1.Pod{
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "reviews-54321-hello",
					Labels: map[string]string{
						"app":     "reviews",
						"version": "v1",
					},
				},
			},
		},
	}
}
