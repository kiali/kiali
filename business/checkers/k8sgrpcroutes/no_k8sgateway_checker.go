package k8sgrpcroutes

import (
	"fmt"

	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/business/checkers/k8shttproutes"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoK8sGatewayChecker struct {
	Cluster      string
	Conf         *config.Config
	GatewayNames map[string]k8s_networking_v1.Gateway
	K8sGRPCRoute *k8s_networking_v1.GRPCRoute
	Namespaces   models.Namespaces
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

	gvk := kubernetes.K8sGateways

	if len(s.K8sGRPCRoute.Spec.ParentRefs) > 0 {
		for index, parentRef := range s.K8sGRPCRoute.Spec.ParentRefs {
			if string(parentRef.Name) != "" && string(*parentRef.Kind) == gvk.Kind && string(*parentRef.Group) == gvk.Group {
				namespace := s.K8sGRPCRoute.Namespace
				if parentRef.Namespace != nil && string(*parentRef.Namespace) != "" {
					namespace = string(*parentRef.Namespace)
				}
				valid = k8shttproutes.CheckGateway(string(parentRef.Name), namespace, s.K8sGRPCRoute.Namespace, s.Cluster, s.GatewayNames, s.Namespaces, validations, fmt.Sprintf("spec/parentRefs[%d]/name/%s", index, string(parentRef.Name)), s.Conf) && valid
			}
		}
	}
	return valid
}
