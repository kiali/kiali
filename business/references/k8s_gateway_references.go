package references

import (
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type K8sGatewayReferences struct {
	K8sGateways   []*k8s_networking_v1.Gateway
	K8sHTTPRoutes []*k8s_networking_v1.HTTPRoute
}

func (g K8sGatewayReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, gw := range g.K8sGateways {
		key := models.IstioReferenceKey{Namespace: gw.Namespace, Name: gw.Name, ObjectType: models.ObjectTypeSingular[kubernetes.K8sGateways]}
		references := &models.IstioReferences{}
		references.ObjectReferences = g.getConfigReferences(gw)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (g K8sGatewayReferences) getConfigReferences(gw *k8s_networking_v1.Gateway) []models.IstioReference {
	result := make([]models.IstioReference, 0)

	for _, rt := range g.K8sHTTPRoutes {
		if len(rt.Spec.ParentRefs) > 0 {
			for _, pr := range rt.Spec.ParentRefs {
				if string(pr.Name) == gw.Name && string(*pr.Kind) == kubernetes.K8sActualGatewayType && string(*pr.Group) == kubernetes.K8sNetworkingGroupVersionV1.Group {
					ref := models.IstioReference{Name: rt.Name, Namespace: rt.Namespace, ObjectType: models.ObjectTypeSingular[kubernetes.K8sHTTPRoutes]}
					result = append(result, ref)
				}
			}
		}
	}

	return result
}
