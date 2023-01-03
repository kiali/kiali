package references

import (
	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"
	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type K8sGatewayReferences struct {
	K8sGateways           []*k8s_networking_v1alpha2.Gateway
	VirtualServices       []*networking_v1beta1.VirtualService
	WorkloadsPerNamespace map[string]models.WorkloadList
}

func (n K8sGatewayReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, gw := range n.K8sGateways {
		if gw.Name == "mesh" {
			continue
		}
		key := models.IstioReferenceKey{Namespace: gw.Namespace, Name: gw.Name, ObjectType: models.ObjectTypeSingular[kubernetes.K8sGateways]}
		references := &models.IstioReferences{}
		references.ObjectReferences = n.getConfigReferences(gw)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (n K8sGatewayReferences) getConfigReferences(gw *k8s_networking_v1alpha2.Gateway) []models.IstioReference {
	keys := make(map[string]bool)
	result := make([]models.IstioReference, 0)
	allVSs := make([]models.IstioReference, 0)
	for _, vs := range n.VirtualServices {
		namespace := vs.Namespace
		if len(vs.Spec.Gateways) > 0 && isk8sGatewayListed(gw, vs.Spec.Gateways, namespace) {
			allVSs = append(allVSs, models.IstioReference{Name: vs.Name, Namespace: vs.Namespace, ObjectType: models.ObjectTypeSingular[kubernetes.VirtualServices]})
		}
		if len(vs.Spec.Http) > 0 {
			for _, httpRoute := range vs.Spec.Http {
				if httpRoute != nil {
					for _, match := range httpRoute.Match {
						if match != nil && isk8sGatewayListed(gw, match.Gateways, namespace) {
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
						if match != nil && isk8sGatewayListed(gw, match.Gateways, namespace) {
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

func isk8sGatewayListed(gw *k8s_networking_v1alpha2.Gateway, k8sgateways []string, namespace string) bool {
	hostname := kubernetes.ParseGatewayAsHost(gw.Name, gw.Namespace)
	for _, gate := range k8sgateways {
		gwHostname := kubernetes.ParseGatewayAsHost(gate, namespace)
		if hostname.String() == gwHostname.String() {
			return true
		}
	}
	return false
}
