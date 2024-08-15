package k8shttproutes

import (
	"fmt"
	"strings"

	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	K8sHTTPRoute       *k8s_networking_v1.HTTPRoute
	K8sReferenceGrants []*k8s_networking_v1beta1.ReferenceGrant
	Namespaces         models.Namespaces
	RegistryServices   []*kubernetes.RegistryService
}

func (n NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true

	for i, ref := range n.K8sHTTPRoute.Spec.ParentRefs {
		if ref.Kind == nil || string(*ref.Kind) != kubernetes.ServiceType {
			continue
		}
		valid = n.checkReference(ref.Namespace, ref.Name, &validations, fmt.Sprintf("spec/parentRefs[%d]/name", i)) && valid
	}

	for k, httpRoute := range n.K8sHTTPRoute.Spec.Rules {
		for i, ref := range httpRoute.BackendRefs {
			if ref.Kind == nil || string(*ref.Kind) != kubernetes.ServiceType {
				continue
			}
			valid = n.checkReference(ref.Namespace, ref.Name, &validations, fmt.Sprintf("spec/rules[%d]/backendRefs[%d]/name", k, i)) && valid
		}
	}

	return validations, valid
}

func (n NoHostChecker) checkReference(refNamespace *k8s_networking_v1.Namespace, refName k8s_networking_v1.ObjectName, validations *[]*models.IstioCheck, location string) bool {
	namespace := n.K8sHTTPRoute.Namespace
	if refNamespace != nil && string(*refNamespace) != "" {
		namespace = string(*refNamespace)
	}
	fqdn := kubernetes.GetHost(string(refName), namespace, n.Namespaces.GetNames())
	//service name should not be set in fqdn format
	// if the http route is referencing to a service from the same namespace, then service should exist there
	// if the http route is referencing to a service from other namespace, then a ReferenceGrant should exist to cross namespace reference, and the service should exist in remote namespace
	if strings.Contains(string(refName), ".") ||
		(namespace == n.K8sHTTPRoute.Namespace && !n.checkDestination(fqdn.String(), namespace)) ||
		(namespace != n.K8sHTTPRoute.Namespace && (!n.checkReferenceGrant(n.K8sHTTPRoute.Namespace, namespace) || !n.checkDestination(fqdn.String(), namespace))) {
		validation := models.Build("k8sroutes.nohost.namenotfound", location)
		*validations = append(*validations, &validation)
		return false
	}
	return true
}

func (n NoHostChecker) checkDestination(sHost string, itemNamespace string) bool {
	// Use RegistryService to check destinations that may not be covered with previous check
	// i.e. Multi-cluster or Federation validations
	return kubernetes.HasMatchingRegistryService(itemNamespace, sHost, n.RegistryServices)
}

func (n NoHostChecker) checkReferenceGrant(fromNamespace string, toNamespace string) bool {
	// Use ReferenceGrant objects to check if cross namespace reference exists
	return kubernetes.HasMatchingReferenceGrant(fromNamespace, toNamespace, kubernetes.K8sHTTPRouteType, kubernetes.ServiceType, n.K8sReferenceGrants)
}
