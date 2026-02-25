package references

import (
	"context"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type AuthorizationPolicyReferences struct {
	AuthorizationPolicies []*security_v1.AuthorizationPolicy
	Cluster               string
	Conf                  *config.Config
	Discovery             istio.MeshDiscovery
	KubeServiceHosts      kubernetes.KubeServiceHosts
	Namespace             string
	Namespaces            []string
	ServiceEntries        []*networking_v1.ServiceEntry
	VirtualServices       []*networking_v1.VirtualService
	WorkloadsPerNamespace map[string]models.Workloads
}

// NewAuthorizationPolicyReferences creates a new AuthorizationPolicyReferences with all required fields
func NewAuthorizationPolicyReferences(
	authorizationPolicies []*security_v1.AuthorizationPolicy,
	conf *config.Config,
	cluster string,
	discovery istio.MeshDiscovery,
	namespace string,
	namespaces []string,
	serviceEntries []*networking_v1.ServiceEntry,
	virtualServices []*networking_v1.VirtualService,
	kubeServiceHosts kubernetes.KubeServiceHosts,
	workloadsPerNamespace map[string]models.Workloads,
) AuthorizationPolicyReferences {
	return AuthorizationPolicyReferences{
		AuthorizationPolicies: authorizationPolicies,
		Cluster:               cluster,
		Conf:                  conf,
		Discovery:             discovery,
		KubeServiceHosts:      kubeServiceHosts,
		Namespace:             namespace,
		Namespaces:            namespaces,
		ServiceEntries:        serviceEntries,
		VirtualServices:       virtualServices,
		WorkloadsPerNamespace: workloadsPerNamespace,
	}
}

func (n AuthorizationPolicyReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, ap := range n.AuthorizationPolicies {
		namespace := ap.Namespace
		key := models.IstioReferenceKey{Namespace: namespace, Name: ap.Name, ObjectGVK: kubernetes.AuthorizationPolicies}
		references := &models.IstioReferences{}
		for _, rule := range ap.Spec.Rules {
			if rule == nil {
				continue
			}
			if len(rule.To) > 0 {
				for _, t := range rule.To {
					if t == nil || t.Operation == nil || len(t.Operation.Hosts) == 0 {
						continue
					}
					for _, h := range t.Operation.Hosts {
						fqdn := kubernetes.GetHost(h, namespace, n.Namespaces, n.Conf)
						if !fqdn.IsWildcard() {
							configRef := n.getConfigReferences(fqdn)
							references.ObjectReferences = append(references.ObjectReferences, configRef...)
							// if no ServiceEntry or VS is found, look into K8s Services via FQDN map
							if len(configRef) == 0 {
								references.ServiceReferences = append(references.ServiceReferences, n.getServiceReferences(fqdn, namespace)...)
							}
						}
					}
				}
			}
		}
		references.WorkloadReferences = append(references.WorkloadReferences, n.getWorkloadReferences(ap)...)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (n AuthorizationPolicyReferences) getServiceReferences(host kubernetes.Host, itemNamespace string) []models.ServiceReference {
	result := make([]models.ServiceReference, 0)
	if n.KubeServiceHosts.IsValidForNamespace(host.String(), itemNamespace) {
		result = append(result, models.ServiceReference{Name: host.Service, Namespace: host.Namespace})
	}
	return result
}

func (n AuthorizationPolicyReferences) getConfigReferences(host kubernetes.Host) []models.IstioReference {
	result := make([]models.IstioReference, 0)
	for _, se := range n.ServiceEntries {
		for _, seHost := range se.Spec.Hosts {
			if seHost == host.String() {
				result = append(result, models.IstioReference{Name: se.Name, Namespace: se.Namespace, ObjectGVK: kubernetes.ServiceEntries})
				continue
			}
		}
	}
	for _, vs := range n.VirtualServices {
		for hostIdx := 0; hostIdx < len(vs.Spec.Hosts); hostIdx++ {
			vHost := vs.Spec.Hosts[hostIdx]

			hostS := kubernetes.ParseHost(vHost, vs.Namespace, n.Conf)
			if hostS.String() == host.String() {
				result = append(result, models.IstioReference{Name: vs.Name, Namespace: vs.Namespace, ObjectGVK: kubernetes.VirtualServices})
				continue
			}
		}
	}
	return result
}

func (n AuthorizationPolicyReferences) getWorkloadReferences(ap *security_v1.AuthorizationPolicy) []models.WorkloadReference {
	result := make([]models.WorkloadReference, 0)
	if ap.Spec.Selector != nil {
		selector := labels.SelectorFromSet(ap.Spec.Selector.MatchLabels)

		// AuthPolicy searches Workloads from own namespace, or from all namespaces when AuthPolicy is in root namespace
		for ns, workloads := range n.WorkloadsPerNamespace {
			rootNamespace := n.Discovery.GetRootNamespace(context.TODO(), n.Cluster, ap.Namespace)
			if rootNamespace != ap.Namespace && ns != ap.Namespace {
				continue
			}
			for _, wl := range workloads {
				wlLabelSet := labels.Set(wl.Labels)
				if selector.Matches(wlLabelSet) {
					result = append(result, models.WorkloadReference{Name: wl.Name, Namespace: ns})
				}
			}
		}
	}
	return result
}
