package business

import (
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

// getDiscoverySelectorsForCluster will return the discovery selectors applicable for the named cluster.
// If the cluster has overrides defined in the Kiali config, those overrides will be returned.
// If there are no overrides, but default discovery selectors are defined in the Kiali config, those will be returned.
// If there are no selectors defined in the Kiali config, the fallback will be to obtain Istio's own discovery selectors
// (Istio's discovery selectors will be found in the given mesh argument)
// If no discovery selectors are defined anywhere (in neither Kiali config nor Istio), nil is returned.
// kialiConfig and mesh may be nil - if so, they are ignored.
func getDiscoverySelectorsForCluster(cluster string, kialiConfig *config.Config, mesh *models.Mesh) (ds config.DiscoverySelectorsType) {
	if ds = getKialiDiscoverySelectors(cluster, kialiConfig); ds == nil {
		ds = getIstioDiscoverySelectors(mesh)
	}
	return ds
}

// getKialiDiscoverySelectors will return the discovery selectors applicable for the named cluster as configured
// in the Kiali config (this func does nothing with Istio discovery selectors - it is only concerned with the Kiali config).
// If the cluster has overrides defined in the Kiali config, those overrides will be returned.
// If there are no overrides, but default discovery selectors are defined in the Kiali config, those will be returned.
// If there are no selectors defined in the Kiali config, nil is returned.
// If selectors are defined, this function will always return one more than what was configured - this extra selector
// will select the control plane namespace as defined in the Kiali config in order to assure Kiali will always match
// the control plane namespace (Kiali should always see that namespace).
// NOTE: You probably don't want to use this func; instead, see getDiscoverySelectorsForCluster()
func getKialiDiscoverySelectors(cluster string, cfg *config.Config) config.DiscoverySelectorsType {

	if cfg == nil {
		return nil
	}

	cpNamespaceSelector := config.DiscoverySelectorsType{
		&config.DiscoverySelectorType{
			MatchLabels: map[string]string{
				"kubernetes.io/metadata.name": cfg.IstioNamespace,
			},
		},
	}

	dsConfig := cfg.Deployment.DiscoverySelectors

	// if the cluster has its own overrides, we use those
	dsOverrides := dsConfig.Overrides
	if dsOverrides != nil {
		if dsCluster, ok := dsOverrides[cluster]; ok {
			return append(cpNamespaceSelector, dsCluster...)
		}
	}

	// there are no overrides for the given cluster, see if we have defaults that we can fallback to
	dsDefault := dsConfig.Default
	if dsDefault != nil {
		return append(cpNamespaceSelector, dsDefault...)
	}

	// there are no discovery selectors configured within the Kiali config; return nil to indicate this
	return nil
}

// getIstioDiscoverySelectors will return all discovery selectors configured in the Istio mesh config across all clusters.
// If there are no discovery selectors configured, nil is returned.
// If there are discovery selectors, this function will return additional selectors that selects the control plane namespaces
// so that Kiali will be assured to always match the control plane namespaces.
// NOTE: You probably don't want to use this func; instead, see getDiscoverySelectorsForCluster()
func getIstioDiscoverySelectors(mesh *models.Mesh) config.DiscoverySelectorsType {

	if mesh == nil {
		return nil
	}

	selectors := make(config.DiscoverySelectorsType, 0)

	for _, cp := range mesh.ControlPlanes {
		if len(cp.Config.DiscoverySelectors) > 0 {
			// Kiali always needs access to the control plane namespace - so add a selector for it to ensure it will always match
			selectors = append(selectors, &config.DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": cp.IstiodNamespace}})
			selectors = append(selectors, cp.Config.DiscoverySelectors...)
		}
	}

	if len(selectors) == 0 {
		return nil
	}

	return selectors
}

// filterNamespacesWithDiscoverySelectors will look at the given list of namespaces and return a list
// containing only those namespaces that match the given discovery selectors. If there are no discoverySelectors,
// then the full list of namespaces is returned as-is.
func filterNamespacesWithDiscoverySelectors(namespaces []models.Namespace, discoverySelectors config.DiscoverySelectorsType) []models.Namespace {

	if len(namespaces) == 0 || len(discoverySelectors) == 0 {
		return namespaces
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
