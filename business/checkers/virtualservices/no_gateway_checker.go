package virtualservices

import (
	"fmt"
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoGatewayChecker struct {
	VirtualService *networking_v1.VirtualService
	GatewayNames   map[string]struct{}
}

// Check validates that all the VirtualServices are pointing to an existing Gateway
func (s NoGatewayChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	valid := s.ValidateVirtualServiceGateways(&validations)

	return validations, valid
}

// ValidateVirtualServiceGateways checks all VirtualService gateways (except mesh, which is reserved word) and checks that they're found from the given list of gatewayNames. Also return index of missing gatways to show clearer error path in editor
func (s NoGatewayChecker) ValidateVirtualServiceGateways(validations *[]*models.IstioCheck) bool {
	namespace := s.VirtualService.Namespace
	valid := true

	if len(s.VirtualService.Spec.Gateways) > 0 {
		valid = s.checkGateways(s.VirtualService.Spec.Gateways, namespace, validations, "spec")
	}
	if len(s.VirtualService.Spec.Http) > 0 {
		for index, httpRoute := range s.VirtualService.Spec.Http {
			if httpRoute != nil {
				for _, match := range httpRoute.Match {
					if match != nil {
						valid = valid && s.checkGateways(match.Gateways, namespace, validations, fmt.Sprintf("spec/http[%d]/match", index))
					}
				}
			}
		}
	}
	return valid
}

func (s NoGatewayChecker) checkGateways(gateways []string, namespace string, validations *[]*models.IstioCheck, location string) bool {
	result := true
GatewaySearch:
	for index, gate := range gateways {
		if gate == "mesh" {
			continue GatewaySearch
		}

		// Gateways should be using <namespace>/<gateway>
		checkNomenclature(gate, index, validations)

		hostname := kubernetes.ParseGatewayAsHost(gate, namespace)
		for gw := range s.GatewayNames {
			gwHostname := kubernetes.ParseHost(gw, namespace)
			if found := kubernetes.FilterByHost(hostname.String(), hostname.Namespace, gw, gwHostname.Namespace); found {
				continue GatewaySearch
			}
		}
		path := fmt.Sprintf("%s/gateways[%d]", location, index)
		validation := models.Build("virtualservices.nogateway", path)
		*validations = append(*validations, &validation)
		result = false
	}
	return result
}

func checkNomenclature(gateway string, index int, validations *[]*models.IstioCheck) {
	if strings.Contains(gateway, ".") {
		path := fmt.Sprintf("spec/gateways[%d]", index)
		validation := models.Build("virtualservices.gateway.oldnomenclature", path)
		*validations = append(*validations, &validation)
	}
}
