package virtualservices

import (
	"fmt"
	"strings"

	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	Namespace         string
	Namespaces        models.Namespaces
	ServiceNames      []string
	VirtualService    networking_v1alpha3.VirtualService
	ServiceEntryHosts map[string][]string
	RegistryServices  []*kubernetes.RegistryService
}

func (n NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true

	for k, httpRoute := range n.VirtualService.Spec.Http {
		if httpRoute != nil {
			for i, dest := range httpRoute.Route {
				if dest != nil {
					host := dest.Destination.Host
					if host == "" {
						continue
					}
					if !n.checkDestination(host) {
						fqdn := kubernetes.GetHost(host, n.VirtualService.Namespace, n.VirtualService.ClusterName, n.Namespaces.GetNames())
						path := fmt.Sprintf("spec/http[%d]/route[%d]/destination/host", k, i)
						if fqdn.Namespace != n.VirtualService.Namespace && fqdn.CompleteInput {
							validation := models.Build("validation.unable.cross-namespace", path)
							validations = append(validations, &validation)
						} else {
							validation := models.Build("virtualservices.nohost.hostnotfound", path)
							validations = append(validations, &validation)
							valid = false
						}
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
					if !n.checkDestination(host) {
						fqdn := kubernetes.GetHost(host, n.VirtualService.Namespace, n.VirtualService.ClusterName, n.Namespaces.GetNames())
						path := fmt.Sprintf("spec/tcp[%d]/route[%d]/destination/host", k, i)
						if fqdn.Namespace != n.VirtualService.Namespace && fqdn.CompleteInput {
							validation := models.Build("validation.unable.cross-namespace", path)
							validations = append(validations, &validation)
						} else {
							validation := models.Build("virtualservices.nohost.hostnotfound", path)
							validations = append(validations, &validation)
							valid = false
						}
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
					if !n.checkDestination(host) {
						fqdn := kubernetes.GetHost(host, n.VirtualService.Namespace, n.VirtualService.ClusterName, n.Namespaces.GetNames())
						path := fmt.Sprintf("spec/tls[%d]/route[%d]/destination/host", k, i)
						if fqdn.Namespace != n.VirtualService.Namespace && fqdn.CompleteInput {
							validation := models.Build("validation.unable.cross-namespace", path)
							validations = append(validations, &validation)
						} else {
							validation := models.Build("virtualservices.nohost.hostnotfound", path)
							validations = append(validations, &validation)
							valid = false
						}
					}
				}
			}
		}
	}

	if len(n.VirtualService.Spec.Http) == 0 && len(n.VirtualService.Spec.Tcp) == 0 && len(n.VirtualService.Spec.Tls) == 0 {
		validation := models.Build("virtualservices.nohost.invalidprotocol", "")
		validations = append(validations, &validation)
		valid = false
	}
	return validations, valid
}

func (n NoHostChecker) checkDestination(sHost string) bool {
	fqdn := kubernetes.GetHost(sHost, n.VirtualService.Namespace, n.VirtualService.ClusterName, n.Namespaces.GetNames())
	if fqdn.Namespace == n.VirtualService.Namespace {
		// We need to check for namespace equivalent so that two services from different namespaces do not collide
		for _, service := range n.ServiceNames {
			if kubernetes.FilterByHost(sHost, service, n.Namespace) {
				return true
			}
		}
	}
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
	return kubernetes.HasMatchingRegistryService(sHost, n.RegistryServices)
}
