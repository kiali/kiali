package virtualservices

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type VirtualServiceReferences struct {
	Namespace      string
	Namespaces     models.Namespaces
	VirtualService networking_v1alpha3.VirtualService
}

func (n VirtualServiceReferences) References() models.IstioReferences {
	references := models.IstioReferences{}

	references.ServiceReferences = n.getServiceReferences()

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
