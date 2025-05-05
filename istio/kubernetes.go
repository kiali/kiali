package istio

// Where you should put kubernetes related utilities.
// Some of these are here simply because they would
// cause circular imports if they went in the top
// level kubernetes package.

import (
	"context"

	"golang.org/x/exp/maps"

	corev1 "k8s.io/api/core/v1"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

func GetHealthyIstiodPods(kubeCache ctrlclient.Reader, revision string, namespace string) ([]*corev1.Pod, error) {
	podLabels := map[string]string{
		config.IstioAppLabel:      istiodAppLabelValue,
		config.IstioRevisionLabel: revision,
	}

	podList := &corev1.PodList{}
	err := kubeCache.List(context.Background(), podList, ctrlclient.InNamespace(namespace), ctrlclient.MatchingLabels(podLabels))
	if err != nil {
		return nil, err
	}
	istiods := podList.Items

	healthyIstiods := make([]*corev1.Pod, 0, len(istiods))
	for i, istiod := range istiods {
		if istiod.Status.Phase == corev1.PodRunning {
			healthyIstiods = append(healthyIstiods, &istiods[i])
		}
	}

	return healthyIstiods, nil
}

func GetHealthyIstiodRevisions(kubeCache ctrlclient.Reader, namespace string) ([]string, error) {
	podLabels := map[string]string{
		config.IstioAppLabel: istiodAppLabelValue,
	}

	podList := &corev1.PodList{}
	err := kubeCache.List(context.Background(), podList, ctrlclient.InNamespace(namespace), ctrlclient.MatchingLabels(podLabels))
	if err != nil {
		return nil, err
	}
	istiods := podList.Items

	healthyRevisions := make(map[string]bool)
	for i, istiod := range istiods {
		if istiod.Status.Phase == corev1.PodRunning {
			if revision, ok := istiods[i].Labels[config.IstioRevisionLabel]; ok {
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
	const maistraMemberOfLabel = "maistra.io/member-of"
	const maistraIgnoreNamespaceLabel = "maistra.io/ignore-namespace"
	if _, hasMaistraIgnoreLabel := namespace.Labels[maistraIgnoreNamespaceLabel]; !hasMaistraIgnoreLabel {
		if memberOf, hasMemberOfLabel := namespace.Labels[maistraMemberOfLabel]; hasMemberOfLabel {
			return memberOf
		}
	}
	rev, hasRevLabel := namespace.Labels[config.IstioRevisionLabel]
	injectionEnabled := namespace.Labels[models.IstioInjectionLabel] == models.IstioInjectionEnabledLabelValue
	// Injection label takes precedence over revision label.
	// Or if there's no rev label and ambient is enabled then set to default.
	// TODO: Factor in exclude namespaces for cni for ambient.
	if injectionEnabled || (!hasRevLabel && namespace.IsAmbient) {
		rev = "default"
	}

	return rev
}
