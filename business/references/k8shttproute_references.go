package references

import (
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type K8sHTTPRouteReferences struct {
	Namespaces    models.Namespaces
	K8sHTTPRoutes []*k8s_networking_v1beta1.HTTPRoute
}

func (n K8sHTTPRouteReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, rt := range n.K8sHTTPRoutes {
		key := models.IstioReferenceKey{Namespace: rt.Namespace, Name: rt.Name, ObjectType: models.ObjectTypeSingular[kubernetes.K8sHTTPRoutes]}
		references := &models.IstioReferences{}
		references.ServiceReferences = n.getServiceReferences(rt)
		references.ObjectReferences = n.getConfigReferences(rt)
		ir := make(models.IstioReferencesMap)
		ir[key] = references
		result.MergeReferencesMap(ir)
	}

	return result
}

func (n K8sHTTPRouteReferences) getServiceReferences(rt *k8s_networking_v1beta1.HTTPRoute) []models.ServiceReference {
	keys := make(map[string]bool)
	allServices := make([]models.ServiceReference, 0)
	result := make([]models.ServiceReference, 0)

	for _, httpRoute := range rt.Spec.Rules {
		for _, ref := range httpRoute.BackendRefs {
			if ref.Kind == nil || string(*ref.Kind) != "Service" {
				continue
			}
			namespace := rt.Namespace
			if ref.Namespace != nil && string(*ref.Namespace) != "" {
				namespace = string(*ref.Namespace)
			}
			fqdn := kubernetes.GetHost(string(ref.Name), namespace, n.Namespaces.GetNames())
			if !fqdn.IsWildcard() {
				allServices = append(allServices, models.ServiceReference{Name: fqdn.Service, Namespace: fqdn.Namespace})
			}
		}
	}

	// filter unique references
	for _, sv := range allServices {
		if !keys[sv.Name+"."+sv.Namespace] {
			result = append(result, sv)
			keys[sv.Name+"."+sv.Namespace] = true
		}
	}
	return result
}

func (n K8sHTTPRouteReferences) getConfigReferences(rt *k8s_networking_v1beta1.HTTPRoute) []models.IstioReference {
	keys := make(map[string]bool)
	result := make([]models.IstioReference, 0)
	allGateways := getAllK8sGateways(rt)
	// filter unique references
	for _, gw := range allGateways {
		if !keys[gw.Name+"."+gw.Namespace+"/"+gw.ObjectType] {
			result = append(result, gw)
			keys[gw.Name+"."+gw.Namespace+"/"+gw.ObjectType] = true
		}
	}
	return result
}

func getAllK8sGateways(rt *k8s_networking_v1beta1.HTTPRoute) []models.IstioReference {
	allGateways := make([]models.IstioReference, 0)

	if len(rt.Spec.ParentRefs) > 0 {
		for _, parentRef := range rt.Spec.ParentRefs {
			if string(parentRef.Name) != "" && string(*parentRef.Kind) == kubernetes.K8sActualGatewayType && string(*parentRef.Group) == kubernetes.K8sNetworkingGroupVersionV1Beta1.Group {
				namespace := rt.Namespace
				if parentRef.Namespace != nil && string(*parentRef.Namespace) != "" {
					namespace = string(*parentRef.Namespace)
				}
				allGateways = append(allGateways, getK8sGatewayReference(string(parentRef.Name), namespace))
			}
		}
	}

	return allGateways
}

func getK8sGatewayReference(gateway string, namespace string) models.IstioReference {
	gw := kubernetes.ParseGatewayAsHost(gateway, namespace)
	return models.IstioReference{Name: gw.Service, Namespace: gw.Namespace, ObjectType: models.ObjectTypeSingular[kubernetes.K8sGateways]}
}
