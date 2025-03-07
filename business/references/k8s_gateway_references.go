package references

import (
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type K8sGatewayReferences struct {
	K8sGateways           []*k8s_networking_v1.Gateway
	K8sHTTPRoutes         []*k8s_networking_v1.HTTPRoute
	K8sGRPCRoutes         []*k8s_networking_v1.GRPCRoute
	WorkloadsPerNamespace map[string]models.Workloads
}

func (g K8sGatewayReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, gw := range g.K8sGateways {
		key := models.IstioReferenceKey{Namespace: gw.Namespace, Name: gw.Name, ObjectGVK: kubernetes.K8sGateways}
		references := &models.IstioReferences{}
		references.WorkloadReferences = g.getWorkloadReferences(gw)
		references.ObjectReferences = g.getConfigReferences(gw)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (g K8sGatewayReferences) getWorkloadReferences(gw *k8s_networking_v1.Gateway) []models.WorkloadReference {
	result := make([]models.WorkloadReference, 0)

	// Gateway searches Workloads from own namespace and Gateway Label
	for _, w := range g.WorkloadsPerNamespace[gw.Namespace] {
		if gw.Name == w.Labels[config.Get().IstioLabels.AmbientWaypointGatewayLabel] {
			result = append(result, models.WorkloadReference{Name: w.Name, Namespace: gw.Namespace})
		}
	}
	return result
}

func (g K8sGatewayReferences) getConfigReferences(gw *k8s_networking_v1.Gateway) []models.IstioReference {
	result := make([]models.IstioReference, 0)

	gvk := kubernetes.K8sGateways

	for _, rt := range g.K8sHTTPRoutes {
		for _, pr := range rt.Spec.ParentRefs {
			if string(pr.Name) == gw.Name && string(*pr.Kind) == gvk.Kind && string(*pr.Group) == gvk.Group {
				ref := models.IstioReference{Name: rt.Name, Namespace: rt.Namespace, ObjectGVK: kubernetes.K8sHTTPRoutes}
				result = append(result, ref)
			}
		}
	}

	for _, rt := range g.K8sGRPCRoutes {
		for _, pr := range rt.Spec.ParentRefs {
			if string(pr.Name) == gw.Name && string(*pr.Kind) == gvk.Kind && string(*pr.Group) == gvk.Group {
				ref := models.IstioReference{Name: rt.Name, Namespace: rt.Namespace, ObjectGVK: kubernetes.K8sGRPCRoutes}
				result = append(result, ref)
			}
		}
	}

	return result
}
