package virtual_services

import (
	"fmt"
	"strings"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoGatewayChecker struct {
	VirtualService kubernetes.IstioObject
	GatewayNames   map[string]struct{}
}

// Check validates that all the VirtualServices are pointing to an existing Gateway
func (s NoGatewayChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	valid := s.ValidateVirtualServiceGateways(s.VirtualService.GetSpec(), s.VirtualService.GetObjectMeta().Namespace, s.VirtualService.GetObjectMeta().ClusterName, &validations)

	return validations, valid
}

// ValidateVirtualServiceGateways checks all VirtualService gateways (except mesh, which is reserved word) and checks that they're found from the given list of gatewayNames. Also return index of missing gatways to show clearer error path in editor
func (s NoGatewayChecker) ValidateVirtualServiceGateways(spec map[string]interface{}, namespace, clusterName string, validations *[]*models.IstioCheck) bool {
	valid := true
	if clusterName == "" {
		clusterName = config.Get().ExternalServices.Istio.IstioIdentityDomain
	}
	if gatewaysSpec, found := spec["gateways"]; found {
		if gateways, ok := gatewaysSpec.([]interface{}); ok {
		GatewaySearch:
			for index, g := range gateways {
				if gate, ok := g.(string); ok {
					if gate == "mesh" {
						continue GatewaySearch
					}

					// Gateways should be using <namespace>/<gateway>
					checkNomenclature(gate, index, validations)

					hostname := kubernetes.ParseGatewayAsHost(gate, namespace, clusterName).String()
					for gw := range s.GatewayNames {
						if found := kubernetes.FilterByHost(hostname, gw, namespace); found {
							continue GatewaySearch
						}
					}
					path := fmt.Sprintf("spec/gateways[%d]", index)
					validation := models.Build("virtualservices.nogateway", path)
					*validations = append(*validations, &validation)
					valid = false
				}
			}
		}
	}

	return valid
}

func checkNomenclature(gateway string, index int, validations *[]*models.IstioCheck) {
	if strings.Contains(gateway, ".") {
		path := fmt.Sprintf("spec/gateways[%d]", index)
		validation := models.Build("virtualservices.gateway.oldnomenclature", path)
		*validations = append(*validations, &validation)
	}
}
