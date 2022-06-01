package virtualservices

import (
	"fmt"
	"strings"

	networking_v1beta1 "istio.io/client-go/pkg/apis/networking/v1beta1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	Namespace         string
	Namespaces        models.Namespaces
	VirtualService    networking_v1beta1.VirtualService
	ServiceEntryHosts map[string][]string
	RegistryServices  []*kubernetes.RegistryService
}

func (n NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true
	namespace, clusterName := n.VirtualService.Namespace, n.VirtualService.ClusterName

	for k, httpRoute := range n.VirtualService.Spec.Http {
		if httpRoute != nil {
			for i, dest := range httpRoute.Route {
				if dest != nil {
					host := dest.Destination.Host
					if host == "" {
						continue
					}
					fqdn := kubernetes.GetHost(host, namespace, clusterName, n.Namespaces.GetNames())
					if !n.checkDestination(fqdn.String(), namespace) {
						path := fmt.Sprintf("spec/http[%d]/route[%d]/destination/host", k, i)
						validation := models.Build("virtualservices.nohost.hostnotfound", path)
						validations = append(validations, &validation)
						valid = false
					}
				}
			}
		}
	}

	for k, tcpRoute := range n.VirtualService.Spec.Tcp {
		if tcpRoute != nil {
			for i, dest := range tcpRoute.Route {
				if dest != nil {
					host := dest.Destination.Host
					if host == "" {
						continue
					}
					fqdn := kubernetes.GetHost(host, namespace, clusterName, n.Namespaces.GetNames())
					if !n.checkDestination(fqdn.String(), namespace) {
						path := fmt.Sprintf("spec/tcp[%d]/route[%d]/destination/host", k, i)
						validation := models.Build("virtualservices.nohost.hostnotfound", path)
						validations = append(validations, &validation)
						valid = false
					}
				}
			}
		}
	}

	for k, tlsRoute := range n.VirtualService.Spec.Tls {
		if tlsRoute != nil {
			for i, dest := range tlsRoute.Route {
				if dest != nil {
					host := dest.Destination.Host
					if host == "" {
						continue
					}
					fqdn := kubernetes.GetHost(host, namespace, clusterName, n.Namespaces.GetNames())
					if !n.checkDestination(fqdn.String(), namespace) {
						path := fmt.Sprintf("spec/tls[%d]/route[%d]/destination/host", k, i)
						validation := models.Build("virtualservices.nohost.hostnotfound", path)
						validations = append(validations, &validation)
						valid = false
					}
				}
			}
		}
	}

	return validations, valid
}

func (n NoHostChecker) checkDestination(sHost string, itemNamespace string) bool {
	// Check ServiceEntries
	for k := range n.ServiceEntryHosts {
		hostKey := k
		if i := strings.Index(k, "*"); i > -1 {
			hostKey = k[i+1:]
		}
		if strings.HasSuffix(sHost, hostKey) {
			return true
		}
	}

	// Use RegistryService to check destinations that may not be covered with previous check
	// i.e. Multi-cluster or Federation validations
	return kubernetes.HasMatchingRegistryService(itemNamespace, sHost, n.RegistryServices)
}
