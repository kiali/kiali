package istio

// Where you should put kubernetes related utilities.
// Some of these are here simply because they would
// cause circular imports if they went in the top
// level kubernetes package.

import (
	"golang.org/x/exp/maps"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/models"
)

func GetHealthyIstiodPods(kubeCache cache.KubeCache, revision string, namespace string) ([]*corev1.Pod, error) {
	podLabels := map[string]string{
		"app":          "istiod",
		"istio.io/rev": revision,
	}

	istiods, err := kubeCache.GetPods(namespace, labels.Set(podLabels).String())
	if err != nil {
		return nil, err
	}

	healthyIstiods := make([]*corev1.Pod, 0, len(istiods))
	for i, istiod := range istiods {
		if istiod.Status.Phase == corev1.PodRunning {
			healthyIstiods = append(healthyIstiods, &istiods[i])
		}
	}

	return healthyIstiods, nil
}

func GetHealthyIstiodRevisions(kubeCache cache.KubeCache, namespace string) ([]string, error) {
	podLabels := map[string]string{
		"app": "istiod",
	}

	istiods, err := kubeCache.GetPods(namespace, labels.Set(podLabels).String())
	if err != nil {
		return nil, err
	}

	healthyRevisions := make(map[string]bool)
	for i, istiod := range istiods {
		if istiod.Status.Phase == corev1.PodRunning {
			if revision, ok := istiods[i].Labels["istio.io/rev"]; ok {
				healthyRevisions[revision] = true
			}
		}
	}

	return maps.Keys(healthyRevisions), nil
}

func GetLatestPod(pods []*corev1.Pod) *corev1.Pod {
	if len(pods) == 0 {
		return nil
	}

	latestPod := pods[0]
	for _, pod := range pods {
		if pod.CreationTimestamp.After(latestPod.CreationTimestamp.Time) {
			latestPod = pod
		}
	}

	return latestPod
}

// GetRevision returns the revision of the controlplane that manages this namespace.
// If this namespace is in the mesh, meaning it either has an injection label,
// a revision label, or an ambient label, then it returns the revision label.
// When a namespace has an injection label or an ambient label with no rev label,
// it is managed by the default revision.
// If a namespace is out of the mesh, then the empty string is returned.
func GetRevision(namespace models.Namespace) string {
	rev, hasRevLabel := namespace.Labels[models.IstioRevisionLabel]
	injectionEnabled := namespace.Labels[models.IstioInjectionLabel] == models.IstioInjectionEnabledLabelValue
	// Injection label takes precedence over revision label.
	// Or if there's no rev label and ambient is enabled then set to default.
	// TODO: Factor in exclude namespaces for cni for ambient.
	if injectionEnabled || (!hasRevLabel && namespace.IsAmbient) {
		rev = "default"
	}

	return rev
}
