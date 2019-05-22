package virtual_services

import (
	"fmt"
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	Namespace         string
	ServiceNames      []string
	VirtualService    kubernetes.IstioObject
	ServiceEntryHosts map[string][]string
}

func (n NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true

	routeProtocols := []string{"http", "tcp", "tls"}
	countOfDefinedProtocols := 0
	for _, protocol := range routeProtocols {
		if prot, ok := n.VirtualService.GetSpec()[protocol]; ok {
			countOfDefinedProtocols++
			if aHttp, ok := prot.([]interface{}); ok {
				for k, httpRoute := range aHttp {
					if mHttpRoute, ok := httpRoute.(map[string]interface{}); ok {
						if route, ok := mHttpRoute["route"]; ok {
							if aDestinationWeight, ok := route.([]interface{}); ok {
								for i, destination := range aDestinationWeight {
									host := parseHost(destination)
									if host == "" {
										continue
									}
									if !n.checkDestination(parseHost(destination), protocol) {
										fqdn := kubernetes.ParseHost(host, n.VirtualService.GetObjectMeta().Namespace, n.VirtualService.GetObjectMeta().ClusterName)
										path := fmt.Sprintf("spec/%s[%d]/route[%d]/destination/host", protocol, k, i)
										if fqdn.Namespace != n.VirtualService.GetObjectMeta().Namespace && fqdn.CompleteInput {
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
				}
			}
		}
	}

	if countOfDefinedProtocols < 1 {
		validation := models.Build("virtualservices.nohost.invalidprotocol", "")
		validations = append(validations, &validation)
		valid = false
	}

	return validations, valid
}

func parseHost(destination interface{}) string {
	if mDestination, ok := destination.(map[string]interface{}); ok {
		if destinationW, ok := mDestination["destination"]; ok {
			if mDestinationW, ok := destinationW.(map[string]interface{}); ok {
				if host, ok := mDestinationW["host"]; ok {
					if sHost, ok := host.(string); ok {
						return sHost
					}
				}
			}
		}
	}
	return ""
}

func (n NoHostChecker) checkDestination(sHost, protocol string) bool {
	fqdn := kubernetes.ParseHost(sHost, n.VirtualService.GetObjectMeta().Namespace, n.VirtualService.GetObjectMeta().ClusterName)
	if fqdn.Namespace == n.VirtualService.GetObjectMeta().Namespace {
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
	return false
}
