package references

import (
	"fmt"
	"strings"

	k8s_inference_v1alpha2 "sigs.k8s.io/gateway-api-inference-extension/api/v1alpha2"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type K8sInferencePoolReferences struct {
	Conf                  *config.Config
	Namespaces            []string
	K8sHTTPRoutes         []*k8s_networking_v1.HTTPRoute
	K8sInferencePools     []*k8s_inference_v1alpha2.InferencePool
	RegistryServices      []*kubernetes.RegistryService
	WorkloadsPerNamespace map[string]models.Workloads
}

// References computes and returns all references from the K8sInferencePools.
func (r K8sInferencePoolReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, pool := range r.K8sInferencePools {
		key := models.IstioReferenceKey{
			Namespace: pool.Namespace,
			Name:      pool.Name,
			ObjectGVK: kubernetes.K8sInferencePools,
		}
		references := &models.IstioReferences{}
		references.ServiceReferences = r.getServiceReferences(pool)
		references.WorkloadReferences = r.getWorkloadReferences(pool)
		references.ObjectReferences = r.getK8sHTTPRouteRefs(pool)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

// getWorkloadReferences finds all Workloads that are selected by the InferencePool's spec.selector.
func (r K8sInferencePoolReferences) getWorkloadReferences(pool *k8s_inference_v1alpha2.InferencePool) []models.WorkloadReference {
	result := make([]models.WorkloadReference, 0)

	poolLabelsS := []string{}
	poolSelector := pool.Spec.Selector
	for k, v := range poolSelector {
		poolLabelsS = append(poolLabelsS, fmt.Sprintf("%s=%s", k, v))
	}
	if resourceSelector, err := labels.Parse(strings.Join(poolLabelsS, ",")); err == nil {
		// InferencePool searches Workloads from own namespace
		for _, w := range r.WorkloadsPerNamespace[pool.Namespace] {
			wlLabelSet := labels.Set(w.Labels)
			if resourceSelector.Matches(wlLabelSet) {
				result = append(result, models.WorkloadReference{Name: w.Name, Namespace: pool.Namespace})
			}
		}
	}

	return result
}

// getServiceReferences finds the Service referenced by the InferencePool's spec.extensionRef.
func (r K8sInferencePoolReferences) getServiceReferences(pool *k8s_inference_v1alpha2.InferencePool) []models.ServiceReference {
	result := make([]models.ServiceReference, 0)

	fqdn := kubernetes.GetHost(string(pool.Spec.ExtensionRef.Name), pool.Namespace, r.Namespaces, r.Conf)
	if kubernetes.HasMatchingRegistryService(pool.Namespace, fqdn.String(), r.RegistryServices) {
		result = append(result, models.ServiceReference{Name: string(pool.Spec.ExtensionRef.Name), Namespace: pool.Namespace})
	}
	return result
}

// getK8sHTTPRouteRefs finds the K8s  HTTPRoute objects which refer to InferencePool by their spec.rules.backendRefs
func (r K8sInferencePoolReferences) getK8sHTTPRouteRefs(pool *k8s_inference_v1alpha2.InferencePool) []models.IstioReference {
	result := make([]models.IstioReference, 0)

routes:
	for _, rt := range r.K8sHTTPRoutes {
		for _, httpRoute := range rt.Spec.Rules {
			for _, ref := range httpRoute.BackendRefs {
				if ref.Kind == nil || string(*ref.Kind) != kubernetes.K8sInferencePoolsType || string(*ref.Group) != kubernetes.K8sInferencePools.Group {
					continue
				}
				namespace := rt.Namespace
				if ref.Namespace != nil && string(*ref.Namespace) != "" {
					namespace = string(*ref.Namespace)
				}
				if pool.Name == string(ref.Name) && pool.Namespace == namespace {
					result = append(result, getK8sHTTPRouteReference(rt.Name, rt.Namespace))
					continue routes
				}
			}
		}
	}

	return result
}

func getK8sHTTPRouteReference(name string, namespace string) models.IstioReference {
	return models.IstioReference{Name: name, Namespace: namespace, ObjectGVK: kubernetes.K8sHTTPRoutes}
}
