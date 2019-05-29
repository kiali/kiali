package virtual_services

import (
	"strconv"
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

	s.ValidateVirtualServiceGateways(s.VirtualService.GetSpec(), s.VirtualService.GetObjectMeta().Namespace, s.VirtualService.GetObjectMeta().ClusterName, &validations)

	return validations, len(validations) == 0
}

// ValidateVirtualServiceGateways checks all VirtualService gateways (except mesh, which is reserved word) and checks that they're found from the given list of gatewayNames. Also return index of missing gatways to show clearer error path in editor
func (s NoGatewayChecker) ValidateVirtualServiceGateways(spec map[string]interface{}, namespace, clusterName string, validations *[]*models.IstioCheck) {
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
					var hostname string
					if strings.Contains(gate, "/") {
						parts := strings.Split(gate, "/")
						hostname = kubernetes.Host{
							Service:   parts[1],
							Namespace: parts[0],
							Cluster:   clusterName,
						}.String()
					} else {
						hostname = kubernetes.ParseHost(gate, namespace, clusterName).String()
					}
					for gw := range s.GatewayNames {
						if found := kubernetes.FilterByHost(hostname, gw, namespace); found {
							continue GatewaySearch
						}
					}
					path := "spec/gateways[" + strconv.Itoa(index) + "]"
					validation := models.Build("virtualservices.nogateway", path)
					*validations = append(*validations, &validation)
				}
			}
		}
	}
}
