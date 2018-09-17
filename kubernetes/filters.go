package kubernetes

import (
	"k8s.io/api/apps/v1beta1"
	"k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/log"
)

// FilterPodsForService returns a subpart of pod list filtered according service selector
func FilterPodsForService(s *v1.Service, allPods []v1.Pod) []v1.Pod {
	if s == nil || allPods == nil {
		return nil
	}
	serviceSelector := labels.Set(s.Spec.Selector).AsSelector()
	pods := filterPodsForService(serviceSelector, allPods)

	return pods
}

// FilterDeploymentsForService returns a subpart of deployments list filtered according to pods labels.
func FilterDeploymentsForService(s *v1.Service, servicePods []v1.Pod, allDepls []v1beta1.Deployment) []v1beta1.Deployment {
	if s == nil || allDepls == nil {
		return nil
	}
	serviceSelector := labels.Set(s.Spec.Selector).AsSelector()

	var deployments []v1beta1.Deployment
	for _, d := range allDepls {
		depSelector, err := meta_v1.LabelSelectorAsSelector(d.Spec.Selector)
		if err != nil {
			log.Errorf("Invalid label selector: %v", err)
		}
		added := false
		// If it matches any of the pods, then it's "part" of the service
		for _, pod := range servicePods {
			// If a deployment with an empty selector creeps in, it should match nothing, not everything.
			if !depSelector.Empty() && depSelector.Matches(labels.Set(pod.ObjectMeta.Labels)) {
				deployments = append(deployments, d)
				added = true
				break
			}
		}
		if !added {
			// Maybe there's no pod (yet) for a deployment, but it still "belongs" to that service
			// We can try to guess that by matching service selector with deployment labels and assume they would match.
			// This is of course not guaranteed.
			if !serviceSelector.Empty() && serviceSelector.Matches(labels.Set(d.ObjectMeta.Labels)) {
				deployments = append(deployments, d)
			}
		}
	}
	return deployments
}

func filterPodsForService(selector labels.Selector, allPods []v1.Pod) []v1.Pod {
	var pods []v1.Pod
	for _, pod := range allPods {
		if selector.Matches(labels.Set(pod.ObjectMeta.Labels)) {
			pods = append(pods, pod)
		}
	}
	return pods
}

// FilterPodsForEndpoints performs a second pass was selector may return too many data
// This case happens when a "nil" selector (such as one of default/kubernetes service) is used
func FilterPodsForEndpoints(endpoints *v1.Endpoints, unfiltered []v1.Pod) []v1.Pod {
	endpointPods := make(map[string]bool)
	for _, subset := range endpoints.Subsets {
		for _, address := range subset.Addresses {
			if address.TargetRef != nil && address.TargetRef.Kind == "Pod" {
				endpointPods[address.TargetRef.Name] = true
			}
		}
	}
	var pods []v1.Pod
	for _, pod := range unfiltered {
		if _, ok := endpointPods[pod.Name]; ok {
			pods = append(pods, pod)
		}
	}
	return pods
}
