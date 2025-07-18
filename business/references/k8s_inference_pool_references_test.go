package references

import (
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8s_inference_v1alpha2 "sigs.k8s.io/gateway-api-inference-extension/api/v1alpha2"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func prepareTestForK8sInferencePool(pool *k8s_inference_v1alpha2.InferencePool, workloads models.Workloads, services []*kubernetes.RegistryService) models.IstioReferences {
	conf := config.Get()
	if conf.KubernetesConfig.ClusterName == "" {
		conf.KubernetesConfig.ClusterName = "Kubernetes"
	}

	references := K8sInferencePoolReferences{
		Conf:              conf,
		Namespaces:        []string{pool.Namespace, "different-ns"},
		K8sInferencePools: []*k8s_inference_v1alpha2.InferencePool{pool},
		WorkloadsPerNamespace: map[string]models.Workloads{
			pool.Namespace: workloads,
		},
		RegistryServices: services,
	}
	return *references.References()[models.IstioReferenceKey{ObjectGVK: kubernetes.K8sInferencePools, Namespace: pool.Namespace, Name: pool.Name}]
}

// TestK8sInferencePoolReferences tests that both workload and service references are correctly found.
func TestK8sInferencePoolReferences(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	// Setup mocks
	pool := fakeInferencePool("test-pool", "test-ns", map[k8s_inference_v1alpha2.LabelKey]k8s_inference_v1alpha2.LabelValue{"app": "vllm-llama3-8b-instruct"}, "my-service-epp")
	workloads := models.Workloads{
		data.CreateWorkload("workload1", map[string]string{"app": "vllm-llama3-8b-instruct"}),
		data.CreateWorkload("workload2", map[string]string{"app": "vllm-llama3-8b-instruct-new"}),
		data.CreateWorkload("other-workload", map[string]string{"app": "other-app"}),
	}
	services := data.CreateFakeMultiRegistryServices([]string{"my-service-epp.test-ns.svc.cluster.local", "other-service"}, "test-ns", ".")

	references := prepareTestForK8sInferencePool(pool, workloads, services)

	// Check Workload references
	assert.Len(references.WorkloadReferences, 1)
	assert.ElementsMatch([]string{"workload1"}, []string{references.WorkloadReferences[0].Name})

	// Check Service references
	assert.Len(references.ServiceReferences, 1)
	assert.Equal("my-service-epp", references.ServiceReferences[0].Name)
	assert.Equal("test-ns", references.ServiceReferences[0].Namespace)
}

// TestK8sInferencePoolNoWorkloadReferences tests the case where the selector matches no workloads.
func TestK8sInferencePoolNoWorkloadReferences(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	pool := fakeInferencePool("test-pool", "test-ns", map[k8s_inference_v1alpha2.LabelKey]k8s_inference_v1alpha2.LabelValue{"app": "vllm-llama3-8b-instruct"}, "my-service")
	workloads := models.Workloads{
		data.CreateWorkload("workload1", map[string]string{"app": "my-app"}),
	}
	services := data.CreateFakeRegistryServicesLabels("my-service.test-ns.svc.cluster.local", "test-ns")

	references := prepareTestForK8sInferencePool(pool, workloads, services)

	// Check Workload references empty
	assert.Empty(references.WorkloadReferences)

	// Check Service references (1)
	assert.Len(references.ServiceReferences, 1)
	assert.Equal("my-service", references.ServiceReferences[0].Name)
}

// TestK8sInferencePoolNoServiceReference tests the case where the extensionRef points to a non-existent service.
func TestK8sInferencePoolNoServiceReference(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	pool := fakeInferencePool("test-pool", "test-ns", map[k8s_inference_v1alpha2.LabelKey]k8s_inference_v1alpha2.LabelValue{"app": "vllm-llama3-8b-instruct"}, "non-existent-service")
	workloads := models.Workloads{
		data.CreateWorkload("workload1", map[string]string{"app": "vllm-llama3-8b-instruct"}),
	}
	services := data.CreateFakeRegistryServicesLabels("my-service.test-ns.svc.cluster.local", "test-ns")

	references := prepareTestForK8sInferencePool(pool, workloads, services)

	// Check Workload references (1)
	assert.Len(references.WorkloadReferences, 1)
	assert.Equal("workload1", references.WorkloadReferences[0].Name)

	// Check Service references empty
	assert.Empty(references.ServiceReferences)
}

// TestK8sInferencePoolNoReferences tests the case where neither selector nor extensionRef match anything.
func TestK8sInferencePoolNoReferences(t *testing.T) {
	assert := assert.New(t)
	config.Set(config.NewConfig())

	// Create a pool with a selector that won't match and a reference to a non-existent service
	pool := fakeInferencePool("test-pool", "test-ns", map[k8s_inference_v1alpha2.LabelKey]k8s_inference_v1alpha2.LabelValue{"app": "non-existent"}, "non-existent")
	workloads := models.Workloads{
		data.CreateWorkload("workload1", map[string]string{"app": "my-app"}),
	}
	services := data.CreateFakeRegistryServicesLabels("my-service.test-ns.svc.cluster.local", "test-ns")

	references := prepareTestForK8sInferencePool(pool, workloads, services)

	// Check both references are empty
	assert.Empty(references.WorkloadReferences)
	assert.Empty(references.ServiceReferences)
}

// fakeInferencePool is a helper to create K8sInferencePool objects for testing.
func fakeInferencePool(name, namespace string, selector map[k8s_inference_v1alpha2.LabelKey]k8s_inference_v1alpha2.LabelValue, serviceRefName string) *k8s_inference_v1alpha2.InferencePool {
	kind := k8s_inference_v1alpha2.Kind("Service")
	return &k8s_inference_v1alpha2.InferencePool{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
		},
		Spec: k8s_inference_v1alpha2.InferencePoolSpec{
			Selector: selector,
			EndpointPickerConfig: k8s_inference_v1alpha2.EndpointPickerConfig{
				ExtensionRef: &k8s_inference_v1alpha2.Extension{
					ExtensionReference: k8s_inference_v1alpha2.ExtensionReference{
						Name: k8s_inference_v1alpha2.ObjectName(serviceRefName),
						Kind: &kind,
					},
				},
			},
		},
	}
}
