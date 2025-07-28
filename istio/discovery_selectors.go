package istio

import (
	"regexp"

	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/sliceutil"
)

var systemNamespaceRegex = regexp.MustCompile(`^(kube-.*|openshift.*|ibm.*|kiali-operator|istio-operator)`)

// getDiscoverySelectorsForCluster will return the discovery selectors applicable for the named cluster.
// If the cluster has overrides defined in the Kiali config, those overrides will be returned.
// If there are no overrides, but default discovery selectors are defined in the Kiali config, those will be returned.
// If there are no selectors defined in the Kiali config, nil is returned (Istio's own discovery selectors will be ignored).
// kialiConf argument may be nil - if so, they are ignored and nil is returned.
func GetDiscoverySelectorsForCluster(discovery MeshDiscovery, cluster string, kialiConf *config.Config) config.DiscoverySelectorsType {
	if kialiConf == nil {
		return nil
	}

	cpNamespaces := discovery.GetControlPlaneNamespaces(cluster)
	ds := GetKialiDiscoverySelectors(cpNamespaces, cluster, kialiConf)
	return ds
}

// GetKialiDiscoverySelectors will return the discovery selectors applicable for the named cluster as configured
// in the Kiali config (this func does nothing with Istio discovery selectors - it is only concerned with the Kiali config).
// If the cluster has overrides defined in the Kiali config, those overrides will be returned.
// If there are no overrides, but default discovery selectors are defined in the Kiali config, those will be returned.
// If there are no selectors defined in the Kiali config, nil is returned.
// If selectors are defined, the function will return the selectors, and as a convenience, additional selectors for
// any provided cpNamespaces (for a set that ensures we always have access to control-plane namespaces).
// NOTE: This is mainly a test hook, You probably want to use getDiscoverySelectorsForCluster()
func GetKialiDiscoverySelectors(cpNamespaces []string, cluster string, conf *config.Config) config.DiscoverySelectorsType {
	if conf == nil {
		return nil
	}

	cpNamespaceSelectors := sliceutil.Map(cpNamespaces, func(ns string) *config.DiscoverySelectorType {
		return &config.DiscoverySelectorType{
			MatchLabels: map[string]string{
				"kubernetes.io/metadata.name": ns,
			},
		}
	})

	dsConfig := conf.Deployment.DiscoverySelectors

	// if the cluster has its own overrides, we use those
	dsOverrides := dsConfig.Overrides
	if dsOverrides != nil {
		if dsCluster, ok := dsOverrides[cluster]; ok {
			return append(cpNamespaceSelectors, dsCluster...)
		}
	}

	// there are no overrides for the given cluster, see if we have defaults that we can fallback to
	dsDefault := dsConfig.Default
	if dsDefault != nil {
		return append(cpNamespaceSelectors, dsDefault...)
	}

	// there are no discovery selectors configured within the Kiali config; return nil to indicate this
	return nil
}

// filterNamespacesWithDiscoverySelectors will look at the given list of namespaces and return a list
// containing only those namespaces that match the given discovery selectors. If there are no discoverySelectors,
// then the full list of namespaces is returned minus the system namespaces.
func FilterNamespacesWithDiscoverySelectors(namespaces []models.Namespace, discoverySelectors config.DiscoverySelectorsType) []models.Namespace {
	if len(namespaces) == 0 || len(discoverySelectors) == 0 {
		// We have no discovery selectors set. We want to provide all namespaces, but filter out system namespaces
		// since in all likelihood the user does not want to see them. If for some reason they do want to see one or
		// more system namespaces, the user simply needs to define their own discovery selectors to include all
		// the namespaces they want to see, including any system namespaces.
		var nonSystemNamespaces []models.Namespace
		for _, ns := range namespaces {
			if !systemNamespaceRegex.MatchString(ns.Name) {
				nonSystemNamespaces = append(nonSystemNamespaces, ns)
			}
		}
		return nonSystemNamespaces
	}

	// convert LabelSelectors to Selectors
	selectors := make([]labels.Selector, 0)
	for _, selector := range discoverySelectors {
		ls, err := meta_v1.LabelSelectorAsSelector((*meta_v1.LabelSelector)(selector))
		if err != nil {
			log.Errorf("skipping invalid discovery selector: %v", err)
		} else {
			selectors = append(selectors, ls)
		}
	}

	// range over all namespaces and keep only those that match; notice each selector result is ORed (as per Istio convention)
	matchedNamespaces := make([]models.Namespace, 0)
	for _, ns := range namespaces {
		for _, selector := range selectors {
			if selector.Matches(labels.Set(ns.Labels)) {
				matchedNamespaces = append(matchedNamespaces, ns)
				break
			}
		}
	}

	return matchedNamespaces
}
