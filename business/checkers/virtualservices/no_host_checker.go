package virtualservices

import (
	"fmt"
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	Conf              *config.Config
	Namespaces        models.Namespaces
	PolicyAllowAny    bool
	RegistryServices  []*kubernetes.RegistryService
	ServiceEntryHosts map[string][]string
	VirtualService    *networking_v1.VirtualService
}

func (n NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true
	namespace := n.VirtualService.Namespace

	for k, httpRoute := range n.VirtualService.Spec.Http {
		if httpRoute != nil {
			for i, dest := range httpRoute.Route {
				if dest != nil {
					host := dest.Destination.Host
					if host == "" {
						continue
					}
					fqdn := kubernetes.GetHost(host, namespace, n.Namespaces.GetNames(), n.Conf)
					if !n.checkDestination(fqdn.String(), namespace) {
						path := fmt.Sprintf("spec/http[%d]/route[%d]/destination/host", k, i)
						validation := models.Build("virtualservices.nohost.hostnotfound", path)
						if n.PolicyAllowAny {
							validation.Severity = models.WarningSeverity
						}
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
					fqdn := kubernetes.GetHost(host, namespace, n.Namespaces.GetNames(), n.Conf)
					if !n.checkDestination(fqdn.String(), namespace) {
						path := fmt.Sprintf("spec/tcp[%d]/route[%d]/destination/host", k, i)
						validation := models.Build("virtualservices.nohost.hostnotfound", path)
						if n.PolicyAllowAny {
							validation.Severity = models.WarningSeverity
						}
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
					fqdn := kubernetes.GetHost(host, namespace, n.Namespaces.GetNames(), n.Conf)
					if !n.checkDestination(fqdn.String(), namespace) {
						path := fmt.Sprintf("spec/tls[%d]/route[%d]/destination/host", k, i)
						validation := models.Build("virtualservices.nohost.hostnotfound", path)
						if n.PolicyAllowAny {
							validation.Severity = models.WarningSeverity
						}
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
