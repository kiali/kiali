package references

import (
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

type K8sGRPCRouteReferences struct {
	Conf               *config.Config
	K8sGRPCRoutes      []*k8s_networking_v1.GRPCRoute
	K8sReferenceGrants []*k8s_networking_v1beta1.ReferenceGrant
	Namespaces         []string
}

func (n K8sGRPCRouteReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, rt := range n.K8sGRPCRoutes {
		key := models.IstioReferenceKey{Namespace: rt.Namespace, Name: rt.Name, ObjectGVK: kubernetes.K8sGRPCRoutes}
		references := &models.IstioReferences{}
		references.ServiceReferences = n.getServiceReferences(rt)
		references.ObjectReferences = n.getConfigReferences(rt)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (n K8sGRPCRouteReferences) getServiceReferences(rt *k8s_networking_v1.GRPCRoute) []models.ServiceReference {
	keys := make(map[string]bool)
	allServices := make([]models.ServiceReference, 0)
	result := make([]models.ServiceReference, 0)

	for _, grpcRoute := range rt.Spec.Rules {
		for _, ref := range grpcRoute.BackendRefs {
			if ref.Kind == nil || string(*ref.Kind) != "Service" {
				continue
			}
			namespace := rt.Namespace
			if ref.Namespace != nil && string(*ref.Namespace) != "" {
				namespace = string(*ref.Namespace)
			}
			fqdn := kubernetes.GetHost(string(ref.Name), namespace, n.Namespaces, n.Conf)
			if !fqdn.IsWildcard() {
				allServices = append(allServices, models.ServiceReference{Name: fqdn.Service, Namespace: fqdn.Namespace})
			}
		}
	}

	// filter unique references
	for _, sv := range allServices {
		key := util.BuildNameNSKey(sv.Name, sv.Namespace)
		if !keys[key] {
			result = append(result, sv)
			keys[key] = true
		}
	}
	return result
}

func (n K8sGRPCRouteReferences) getConfigReferences(rt *k8s_networking_v1.GRPCRoute) []models.IstioReference {
	keys := make(map[string]bool)
	result := make([]models.IstioReference, 0)
	allGateways := getAllK8sGateways(rt.Spec.ParentRefs, rt.Namespace, n.Conf)
	// filter unique references
	for _, gw := range allGateways {
		key := util.BuildNameNSTypeKey(gw.Name, gw.Namespace, gw.ObjectGVK)
		if !keys[key] {
			result = append(result, gw)
			keys[key] = true
		}
	}
	result = append(result, n.getAllK8sReferenceGrants(rt)...)
	return result
}

func (n K8sGRPCRouteReferences) getAllK8sReferenceGrants(rt *k8s_networking_v1.GRPCRoute) []models.IstioReference {
	allGrants := make([]models.IstioReference, 0)
	for _, rGrant := range n.K8sReferenceGrants {
		if len(rGrant.Spec.From) > 0 &&
			string(rGrant.Spec.From[0].Namespace) == rt.Namespace &&
			string(rGrant.Spec.From[0].Kind) == kubernetes.K8sGRPCRoutes.Kind {
			allGrants = append(allGrants, getK8sGrantReference(rGrant.Name, rGrant.Namespace))
		}
	}

	return allGrants
}
