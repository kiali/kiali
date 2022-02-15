package references

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type GatewayReferences struct {
	Gateways              []networking_v1alpha3.Gateway
	WorkloadsPerNamespace map[string]models.WorkloadList
}

func (n GatewayReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, gw := range n.Gateways {
		key := models.IstioReferenceKey{Namespace: gw.Namespace, Name: gw.Name, ObjectType: models.ObjectTypeSingular[kubernetes.Gateways]}
		references := &models.IstioReferences{}
		references.WorkloadReferences = n.getWorkloadReferences(gw)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (n GatewayReferences) getWorkloadReferences(gw networking_v1alpha3.Gateway) []models.WorkloadReference {
	result := make([]models.WorkloadReference, 0)
	selector := labels.SelectorFromSet(gw.Spec.Selector)

	for _, wls := range n.WorkloadsPerNamespace {
		for _, wl := range wls.Workloads {
			wlLabelSet := labels.Set(wl.Labels)
			if selector.Matches(wlLabelSet) {
				return []models.WorkloadReference{{Name: wl.Name, Namespace: wls.Namespace.Name}}
			}
		}
	}
	return result
}
