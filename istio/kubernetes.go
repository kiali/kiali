package istio

// Where you should put kubernetes related utilities.
// Some of these are here simply because they would
// cause circular imports if they went in the top
// level kubernetes package.

import (
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes/cache"
	"golang.org/x/exp/maps"
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
