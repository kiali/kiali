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
	ServiceEntryHosts map[string]struct{}
}

func (n NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	routeProtocols := []string{"http", "tcp", "tls"}
	countOfDefinedProtocols := 0
	for _, protocol := range routeProtocols {
		if prot, ok := n.VirtualService.GetSpec()[protocol]; ok {
			countOfDefinedProtocols++
			if aHttp, ok := prot.([]interface{}); ok {
				for _, httpRoute := range aHttp {
					if mHttpRoute, ok := httpRoute.(map[string]interface{}); ok {
						if route, ok := mHttpRoute["route"]; ok {
							if aDestinationWeight, ok := route.([]interface{}); ok {
								for i, destination := range aDestinationWeight {
									if !n.checkDestination(destination, protocol) {
										validation := models.BuildCheck("DestinationWeight on route doesn't have a valid service (host not found)", "error", fmt.Sprintf("spec/%s/destination[%d]/host", protocol, i))
										validations = append(validations, &validation)
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
		validation := models.BuildCheck("VirtualService doesn't define any valid route protocol", "error", "")
		validations = append(validations, &validation)
	}

	return validations, len(validations) == 0
}

func (n NoHostChecker) checkDestination(destination interface{}, protocol string) bool {
	if mDestination, ok := destination.(map[string]interface{}); ok {
		if destinationW, ok := mDestination["destination"]; ok {
			if mDestinationW, ok := destinationW.(map[string]interface{}); ok {
				if host, ok := mDestinationW["host"]; ok {
					if sHost, ok := host.(string); ok {
						for _, service := range n.ServiceNames {
							if kubernetes.FilterByHost(sHost, service, n.Namespace) {
								return true
							}
						}
						if n.ServiceEntryHosts != nil {
							// We have ServiceEntry to check
							if _, found := n.ServiceEntryHosts[strings.ToLower(protocol)+sHost]; found {
								return true
							}
						}
					}
				}
			}
		}
	}
	return false
}
