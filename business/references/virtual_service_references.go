package references

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const GatewayObjectType = "gateway"

type VirtualServiceReferences struct {
	Namespace      string
	Namespaces     models.Namespaces
	VirtualService networking_v1alpha3.VirtualService
}

func (n VirtualServiceReferences) References() models.IstioReferences {
	references := models.IstioReferences{}

	references.ServiceReferences = n.getServiceReferences()

	references.ObjectReferences = n.getConfigReferences()

	return references
}

func (n VirtualServiceReferences) getServiceReferences() []models.ServiceReference {
	result := make([]models.ServiceReference, 0)
	namespace, clusterName := n.VirtualService.Namespace, n.VirtualService.ClusterName

	for _, httpRoute := range n.VirtualService.Spec.Http {
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

	for _, tcpRoute := range n.VirtualService.Spec.Tcp {
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

	for _, tlsRoute := range n.VirtualService.Spec.Tls {
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

func (n VirtualServiceReferences) getConfigReferences() []models.IstioReference {
	result := make([]models.IstioReference, 0)
	namespace, clusterName := n.VirtualService.Namespace, n.VirtualService.ClusterName
	if len(n.VirtualService.Spec.Gateways) > 0 {
		result = append(result, getGagewayReferences(n.VirtualService.Spec.Gateways, namespace, clusterName)...)
	}
	if len(n.VirtualService.Spec.Http) > 0 {
		for _, httpRoute := range n.VirtualService.Spec.Http {
			if httpRoute != nil {
				for _, match := range httpRoute.Match {
					if match != nil {
						result = append(result, getGagewayReferences(match.Gateways, namespace, clusterName)...)
					}
				}
			}
		}
	}
	return result
}

func getGagewayReferences(gateways []string, namespace string, clusterName string) []models.IstioReference {
	result := make([]models.IstioReference, 0)
	for _, gate := range gateways {
		if gate == "mesh" {
			continue
		}
		gw := kubernetes.ParseGatewayAsHost(gate, namespace, clusterName)
		if !gw.IsWildcard() {
			result = append(result, models.IstioReference{Name: gw.Service, Namespace: gw.Namespace, ObjectType: GatewayObjectType})
		}
	}
	return result
}
