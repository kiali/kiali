package references

import (
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type GatewayReferences struct {
	Gateways              []*networking_v1beta1.Gateway
	VirtualServices       []*networking_v1beta1.VirtualService
	WorkloadsPerNamespace map[string]models.WorkloadList
}

func (n GatewayReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, gw := range n.Gateways {
		if gw.Name == "mesh" {
			continue
		}
		key := models.IstioReferenceKey{Namespace: gw.Namespace, Name: gw.Name, ObjectType: models.ObjectTypeSingular[kubernetes.Gateways]}
		references := &models.IstioReferences{}
		references.WorkloadReferences = n.getWorkloadReferences(gw)
		references.ObjectReferences = n.getConfigReferences(gw)
		ir := make(models.IstioReferencesMap)
		ir[key] = references
		result.MergeReferencesMap(ir)
	}

	return result
}

func (n GatewayReferences) getWorkloadReferences(gw *networking_v1beta1.Gateway) []models.WorkloadReference {
	result := make([]models.WorkloadReference, 0)
	selector := labels.SelectorFromSet(gw.Spec.Selector)

	// Gateway searches Workloads from all namespace
	for _, wls := range n.WorkloadsPerNamespace {
		for _, wl := range wls.Workloads {
			wlLabelSet := labels.Set(wl.Labels)
			if selector.Matches(wlLabelSet) {
				result = append(result, models.WorkloadReference{Name: wl.Name, Namespace: wls.Namespace.Name})
			}
		}
	}
	return result
}

func (n GatewayReferences) getConfigReferences(gw *networking_v1beta1.Gateway) []models.IstioReference {
	keys := make(map[string]bool)
	result := make([]models.IstioReference, 0)
	allVSs := make([]models.IstioReference, 0)
	for _, vs := range n.VirtualServices {
		namespace := vs.Namespace
		if len(vs.Spec.Gateways) > 0 && isGatewayListed(gw, vs.Spec.Gateways, namespace) {
			allVSs = append(allVSs, models.IstioReference{Name: vs.Name, Namespace: vs.Namespace, ObjectType: models.ObjectTypeSingular[kubernetes.VirtualServices]})
		}
		if len(vs.Spec.Http) > 0 {
			for _, httpRoute := range vs.Spec.Http {
				if httpRoute != nil {
					for _, match := range httpRoute.Match {
						if match != nil && isGatewayListed(gw, match.Gateways, namespace) {
							allVSs = append(allVSs, models.IstioReference{Name: vs.Name, Namespace: vs.Namespace, ObjectType: models.ObjectTypeSingular[kubernetes.VirtualServices]})
						}
					}
				}
			}
		}
		if len(vs.Spec.Tls) > 0 {
			for _, tlsRoute := range vs.Spec.Tls {
				if tlsRoute != nil {
					for _, match := range tlsRoute.Match {
						if match != nil && isGatewayListed(gw, match.Gateways, namespace) {
							allVSs = append(allVSs, models.IstioReference{Name: vs.Name, Namespace: vs.Namespace, ObjectType: models.ObjectTypeSingular[kubernetes.VirtualServices]})
						}
					}
				}
			}
		}
		// TODO TCPMatch is not completely supported in Istio yet
	}
	// filter unique references
	for _, vs := range allVSs {
		if !keys[vs.Name+"."+vs.Namespace+"/"+vs.ObjectType] {
			result = append(result, vs)
			keys[vs.Name+"."+vs.Namespace+"/"+vs.ObjectType] = true
		}
	}
	return result
}

func isGatewayListed(gw *networking_v1beta1.Gateway, gateways []string, namespace string) bool {
	hostname := kubernetes.ParseGatewayAsHost(gw.Name, gw.Namespace)
	for _, gate := range gateways {
		gwHostname := kubernetes.ParseGatewayAsHost(gate, namespace)
		if hostname.String() == gwHostname.String() {
			return true
		}
	}
	return false
}
