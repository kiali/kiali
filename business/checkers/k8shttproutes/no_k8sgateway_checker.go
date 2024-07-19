package k8shttproutes

import (
	"fmt"

	"k8s.io/apimachinery/pkg/labels"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoK8sGatewayChecker struct {
	Cluster      string
	GatewayNames map[string]k8s_networking_v1.Gateway
	K8sHTTPRoute *k8s_networking_v1.HTTPRoute
	Namespaces   models.Namespaces
}

// Check validates that the HTTPRoute is pointing to an existing Gateway
func (s NoK8sGatewayChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	valid := s.ValidateHTTPRouteGateways(&validations)

	return validations, valid
}

// ValidateHTTPRouteGateways checks all HTTPRoute gateways and checks that they're found from the given list of gatewayNames. Also return index of missing gatways to show clearer error path in editor
func (s NoK8sGatewayChecker) ValidateHTTPRouteGateways(validations *[]*models.IstioCheck) bool {
	valid := true

	if len(s.K8sHTTPRoute.Spec.ParentRefs) > 0 {
		for index, parentRef := range s.K8sHTTPRoute.Spec.ParentRefs {
			if string(parentRef.Name) != "" && string(*parentRef.Kind) == kubernetes.K8sActualGatewayType && string(*parentRef.Group) == kubernetes.K8sNetworkingGroupVersionV1.Group {
				gwNs := s.K8sHTTPRoute.Namespace
				if parentRef.Namespace != nil && string(*parentRef.Namespace) != "" {
					gwNs = string(*parentRef.Namespace)
				}
				valid = CheckGateway(string(parentRef.Name), gwNs, s.K8sHTTPRoute.Namespace, s.Cluster, s.GatewayNames, s.Namespaces, validations, fmt.Sprintf("spec/parentRefs[%d]/name/%s", index, string(parentRef.Name))) && valid
			}
		}
	}
	return valid
}

func CheckGateway(gwName, gwNs, routeNs, cluster string, gatewayNames map[string]k8s_networking_v1.Gateway, nss models.Namespaces, validations *[]*models.IstioCheck, location string) bool {
	hostname := kubernetes.ParseGatewayAsHost(gwName, gwNs)
	for gw := range gatewayNames {
		gwHostname := kubernetes.ParseHost(gw, gwNs)
		if found := kubernetes.FilterByHost(hostname.String(), hostname.Namespace, gw, gwHostname.Namespace); found {
			if gwHostname.Namespace == routeNs {
				return true
			} else if IsGatewaySharedWithNS(routeNs, cluster, gatewayNames[gw], nss) {
				return true
			}
		}
	}
	validation := models.Build("k8sroutes.nok8sgateway", location)
	*validations = append(*validations, &validation)
	return false
}

// If K8sGateway's allowedRoutes selector matches the labels of given namespace
func IsGatewaySharedWithNS(namespace string, cluster string, gw k8s_networking_v1.Gateway, nss models.Namespaces) bool {
	ns := nss.GetNamespace(namespace, cluster)
	if ns == nil {
		return false
	}
	for _, l := range gw.Spec.Listeners {
		if *l.AllowedRoutes.Namespaces.From == "Selector" &&
			l.AllowedRoutes.Namespaces.Selector != nil &&
			labels.SelectorFromSet(labels.Set(l.AllowedRoutes.Namespaces.Selector.MatchLabels)).Matches(labels.Set(ns.Labels)) {
			return true
		}
	}
	return false
}
