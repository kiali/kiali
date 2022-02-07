package references

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type VirtualServiceReferences struct {
	Namespace       string
	Namespaces      models.Namespaces
	VirtualServices []networking_v1alpha3.VirtualService
}

func (n VirtualServiceReferences) References() models.IstioReferencesMap {
	result := models.IstioReferencesMap{}

	for _, vs := range n.VirtualServices {
		key := models.IstioReferenceKey{Namespace: vs.Namespace, Name: vs.Name, ObjectType: models.ObjectTypeSingular[kubernetes.VirtualServices]}
		references := &models.IstioReferences{}
		references.ServiceReferences = n.getServiceReferences(vs)
		references.ObjectReferences = n.getConfigReferences(vs)
		result.MergeReferencesMap(models.IstioReferencesMap{key: references})
	}

	return result
}

func (n VirtualServiceReferences) getServiceReferences(vs networking_v1alpha3.VirtualService) []models.ServiceReference {
	result := make([]models.ServiceReference, 0)
	namespace, clusterName := vs.Namespace, vs.ClusterName

	for _, httpRoute := range vs.Spec.Http {
		if httpRoute != nil {
			for _, dest := range httpRoute.Route {
				if dest != nil {
					host := dest.Destination.Host
					if host == "" {
						continue
					}
					fqdn := kubernetes.GetHost(host, namespace, clusterName, n.Namespaces.GetNames())
					if !fqdn.IsWildcard() {
						result = append(result, models.ServiceReference{Name: fqdn.Service, Namespace: fqdn.Namespace})
					}
				}
			}
		}
	}

	for _, tcpRoute := range vs.Spec.Tcp {
		if tcpRoute != nil {
			for _, dest := range tcpRoute.Route {
				if dest != nil {
					host := dest.Destination.Host
					if host == "" {
						continue
					}
					fqdn := kubernetes.GetHost(host, namespace, clusterName, n.Namespaces.GetNames())
					if !fqdn.IsWildcard() {
						result = append(result, models.ServiceReference{Name: fqdn.Service, Namespace: fqdn.Namespace})
					}
				}
			}
		}
	}

	for _, tlsRoute := range vs.Spec.Tls {
		if tlsRoute != nil {
			for _, dest := range tlsRoute.Route {
				if dest != nil {
					host := dest.Destination.Host
					if host == "" {
						continue
					}
					fqdn := kubernetes.GetHost(host, namespace, clusterName, n.Namespaces.GetNames())
					if !fqdn.IsWildcard() {
						result = append(result, models.ServiceReference{Name: fqdn.Service, Namespace: fqdn.Namespace})
					}
				}
			}
		}
	}
	return result
}

func (n VirtualServiceReferences) getConfigReferences(vs networking_v1alpha3.VirtualService) []models.IstioReference {
	result := make([]models.IstioReference, 0)
	namespace, clusterName := vs.Namespace, vs.ClusterName
	if len(vs.Spec.Gateways) > 0 {
		result = append(result, getGatewayReferences(vs.Spec.Gateways, namespace, clusterName)...)
	}
	if len(vs.Spec.Http) > 0 {
		for _, httpRoute := range vs.Spec.Http {
			if httpRoute != nil {
				for _, match := range httpRoute.Match {
					if match != nil {
						result = append(result, getGatewayReferences(match.Gateways, namespace, clusterName)...)
					}
				}
			}
		}
	}
	if len(vs.Spec.Tls) > 0 {
		for _, tlsRoute := range vs.Spec.Tls {
			if tlsRoute != nil {
				for _, match := range tlsRoute.Match {
					if match != nil {
						result = append(result, getGatewayReferences(match.Gateways, namespace, clusterName)...)
					}
				}
			}
		}
	}
	return result
}

func getGatewayReferences(gateways []string, namespace string, clusterName string) []models.IstioReference {
	result := make([]models.IstioReference, 0)
	for _, gate := range gateways {
		gw := kubernetes.ParseGatewayAsHost(gate, namespace, clusterName)
		if !gw.IsWildcard() {
			if gate == "mesh" {
				result = append(result, models.IstioReference{Name: gw.Service, ObjectType: models.ObjectTypeSingular[kubernetes.Gateways]})
			} else {
				result = append(result, models.IstioReference{Name: gw.Service, Namespace: gw.Namespace, ObjectType: models.ObjectTypeSingular[kubernetes.Gateways]})
			}
		}
	}
	return result
}
