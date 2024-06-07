package k8sgrpcroutes

import (
	"fmt"

	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoK8sGatewayChecker struct {
	K8sGRPCRoute *k8s_networking_v1.GRPCRoute
	GatewayNames map[string]struct{}
}

// Check validates that the GRPCRoute is pointing to an existing Gateway
func (s NoK8sGatewayChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	valid := s.ValidateGRPCRouteGateways(&validations)

	return validations, valid
}

// ValidateGRPCRouteGateways checks all GRPCRoute gateways and checks that they're found from the given list of gatewayNames. Also return index of missing gatways to show clearer error path in editor
func (s NoK8sGatewayChecker) ValidateGRPCRouteGateways(validations *[]*models.IstioCheck) bool {
	valid := true

	if len(s.K8sGRPCRoute.Spec.ParentRefs) > 0 {
		for index, parentRef := range s.K8sGRPCRoute.Spec.ParentRefs {
			if string(parentRef.Name) != "" && string(*parentRef.Kind) == kubernetes.K8sActualGatewayType && string(*parentRef.Group) == kubernetes.K8sNetworkingGroupVersionV1.Group {
				namespace := s.K8sGRPCRoute.Namespace
				if parentRef.Namespace != nil && string(*parentRef.Namespace) != "" {
					namespace = string(*parentRef.Namespace)
				}
				valid = s.checkGateway(string(parentRef.Name), namespace, validations, fmt.Sprintf("spec/parentRefs[%d]/name/%s", index, string(parentRef.Name))) && valid
			}
		}
	}
	return valid
}

func (s NoK8sGatewayChecker) checkGateway(name, namespace string, validations *[]*models.IstioCheck, location string) bool {
	hostname := kubernetes.ParseGatewayAsHost(name, namespace)
	for gw := range s.GatewayNames {
		gwHostname := kubernetes.ParseHost(gw, namespace)
		if found := kubernetes.FilterByHost(hostname.String(), hostname.Namespace, gw, gwHostname.Namespace); found {
			return true
		}
	}
	validation := models.Build("k8sroutes.nok8sgateway", location)
	*validations = append(*validations, &validation)
	return false
}
