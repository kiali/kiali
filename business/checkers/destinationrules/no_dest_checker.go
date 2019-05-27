package destinationrules

import (
	"strconv"
	"strings"

	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoDestinationChecker struct {
	Namespace       string
	WorkloadList    models.WorkloadList
	DestinationRule kubernetes.IstioObject
	ServiceEntries  map[string][]string
	Services        []core_v1.Service
}

// Check parses the DestinationRule definitions and verifies that they point to an existing service, including any subset definitions
func (n NoDestinationChecker) Check() ([]*models.IstioCheck, bool) {
	valid := true
	validations := make([]*models.IstioCheck, 0)

	if host, ok := n.DestinationRule.GetSpec()["host"]; ok {
		if dHost, ok := host.(string); ok {
			fqdn := kubernetes.ParseHost(dHost, n.DestinationRule.GetObjectMeta().Namespace, n.DestinationRule.GetObjectMeta().ClusterName)
			if !n.hasMatchingService(fqdn, n.DestinationRule.GetObjectMeta().Namespace) {
				if fqdn.Namespace != n.DestinationRule.GetObjectMeta().Namespace && fqdn.Namespace != "" {
					validation := models.Build("validation.unable.cross-namespace", "spec/host")
					valid = true
					validations = append(validations, &validation)
				} else {
					validation := models.Build("destinationrules.nodest.matchingregistry", "spec/host")
					valid = false
					validations = append(validations, &validation)
				}
			}
			if subsets, ok := n.DestinationRule.GetSpec()["subsets"]; ok {
				if dSubsets, ok := subsets.([]interface{}); ok {
					// Check that each subset has a matching workload somewhere..
					for i, subset := range dSubsets {
						if innerSubset, ok := subset.(map[string]interface{}); ok {
							if labels, ok := innerSubset["labels"]; ok {
								if dLabels, ok := labels.(map[string]interface{}); ok {
									stringLabels := make(map[string]string, len(dLabels))
									for k, v := range dLabels {
										if s, ok := v.(string); ok {
											stringLabels[k] = s
										}
									}
									if !n.hasMatchingWorkload(fqdn.Service, stringLabels) {
										validation := models.Build("destinationrules.nodest.subsetlabels",
											"spec/subsets["+strconv.Itoa(i)+"]")
										validations = append(validations, &validation)
										valid = false
									}
								}
							}
						}
					}

				}
			}
		}
	}

	return validations, valid
}

func (n NoDestinationChecker) hasMatchingWorkload(service string, subsetLabels map[string]string) bool {
	// Check wildcard hosts - needs to match "*" and "*.suffix" also..
	if strings.HasPrefix(service, "*") {
		return true
	}

	var selectors map[string]string

	// Find the correct service
	for _, s := range n.Services {
		if s.Name == service {
			selectors = s.Spec.Selector
		}
	}

	// Check workloads
	if len(selectors) == 0 {
		return false
	}

	selector := labels.SelectorFromSet(labels.Set(selectors))

	subsetLabelSet := labels.Set(subsetLabels)
	subsetSelector := labels.SelectorFromSet(subsetLabelSet)

	for _, wl := range n.WorkloadList.Workloads {
		wlLabelSet := labels.Set(wl.Labels)
		if selector.Matches(wlLabelSet) {
			if subsetSelector.Matches(wlLabelSet) {
				return true
			}
		}
	}
	return false
}

func (n NoDestinationChecker) hasMatchingService(host kubernetes.Host, itemNamespace string) bool {
	appLabel := config.Get().IstioLabels.AppLabelName

	// Check wildcard hosts - needs to match "*" and "*.suffix" also..
	if strings.HasPrefix(host.Service, "*") {
		return true
	}

	if host.Namespace == itemNamespace {
		// Check Workloads
		for _, wl := range n.WorkloadList.Workloads {
			if host.Service == wl.Labels[appLabel] {
				return true
			}
		}
		// Check ServiceNames
		for _, s := range n.Services {
			if host.Service == s.Name {
				return true
			}
		}
	}

	// Check ServiceEntries
	for k := range n.ServiceEntries {
		hostKey := k
		if i := strings.Index(k, "*"); i > -1 {
			hostKey = k[i+1:]
		}
		if strings.HasSuffix(host.Service, hostKey) {
			return true
		}
	}

	if _, found := n.ServiceEntries[host.Service]; found {
		return true
	}
	return false
}
