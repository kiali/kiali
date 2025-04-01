package references

import (
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

type SidecarReferences struct {
	Conf                  *config.Config
	Namespace             string
	Namespaces            models.Namespaces
	RegistryServices      []*kubernetes.RegistryService
	ServiceEntries        []*networking_v1.ServiceEntry
	Sidecars              []*networking_v1.Sidecar
	WorkloadsPerNamespace map[string]models.Workloads
}

func (n SidecarReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, sc := range n.Sidecars {
		namespace := sc.Namespace
		key := models.IstioReferenceKey{Namespace: namespace, Name: sc.Name, ObjectGVK: kubernetes.Sidecars}
		references := &models.IstioReferences{}
		for _, ei := range sc.Spec.Egress {
			if ei == nil {
				continue
			}
			if len(ei.Hosts) > 0 {
				for _, h := range ei.Hosts {
					hostNs, dnsName, _ := getHostComponents(h)
					if hostNs == "*" || hostNs == "~" || hostNs == "." || dnsName == "*" {
						continue
					}
					fqdn := kubernetes.ParseHost(dnsName, hostNs, n.Conf)

					configRef := n.getConfigReferences(fqdn, hostNs)
					references.ObjectReferences = append(references.ObjectReferences, configRef...)
					// if No ServiceEntry or VS is found, look into Services as RegistryServices contains all
					if len(configRef) == 0 {
						references.ServiceReferences = append(references.ServiceReferences, n.getServiceReferences(fqdn, namespace)...)
					}
				}
			}
		}
		references.WorkloadReferences = append(references.WorkloadReferences, n.getWorkloadReferences(sc)...)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func getHostComponents(host string) (string, string, bool) {
	hParts := strings.Split(host, "/")

	if len(hParts) != 2 {
		return "", "", false
	}

	return hParts[0], hParts[1], true
}

func (n SidecarReferences) getServiceReferences(host kubernetes.Host, itemNamespace string) []models.ServiceReference {
	result := make([]models.ServiceReference, 0)
	if kubernetes.HasMatchingRegistryService(itemNamespace, host.String(), n.RegistryServices) {
		result = append(result, models.ServiceReference{Name: host.Service, Namespace: host.Namespace})
	}
	return result
}

func (n SidecarReferences) getConfigReferences(host kubernetes.Host, hostNs string) []models.IstioReference {
	keys := make(map[string]bool)
	result := make([]models.IstioReference, 0)
	allSEs := make([]models.IstioReference, 0)
	for _, se := range n.ServiceEntries {
		if se.Namespace != hostNs {
			continue
		}
		for _, seHost := range se.Spec.Hosts {
			if seHost == host.String() {
				allSEs = append(allSEs, models.IstioReference{Name: se.Name, Namespace: se.Namespace, ObjectGVK: kubernetes.ServiceEntries})
				break
			}
		}
	}
	// filter unique references
	for _, vs := range allSEs {
		key := util.BuildNameNSTypeKey(vs.Name, vs.Namespace, vs.ObjectGVK)
		if !keys[key] {
			result = append(result, vs)
			keys[key] = true
		}
	}
	return result
}

func (n SidecarReferences) getWorkloadReferences(sc *networking_v1.Sidecar) []models.WorkloadReference {
	result := make([]models.WorkloadReference, 0)
	if sc.Spec.WorkloadSelector != nil {
		selector := labels.SelectorFromSet(sc.Spec.WorkloadSelector.Labels)

		// Sidecar searches Workloads from own namespace
		for _, w := range n.WorkloadsPerNamespace[sc.Namespace] {
			wlLabelSet := labels.Set(w.Labels)
			if selector.Matches(wlLabelSet) {
				result = append(result, models.WorkloadReference{Name: w.Name, Namespace: sc.Namespace})
			}
		}
	}
	return result
}
