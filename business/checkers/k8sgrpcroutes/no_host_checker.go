package k8sgrpcroutes

import (
	"fmt"
	"strings"

	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	K8sGRPCRoute       *k8s_networking_v1.GRPCRoute
	K8sReferenceGrants []*k8s_networking_v1beta1.ReferenceGrant
	Namespaces         models.Namespaces
	RegistryServices   []*kubernetes.RegistryService
}

func (n NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true

	for k, grpcRoute := range n.K8sGRPCRoute.Spec.Rules {
		for i, ref := range grpcRoute.BackendRefs {
			if ref.Kind == nil || string(*ref.Kind) != "Service" {
				continue
			}
			namespace := n.K8sGRPCRoute.Namespace
			if ref.Namespace != nil && string(*ref.Namespace) != "" {
				namespace = string(*ref.Namespace)
			}
			fqdn := kubernetes.GetHost(string(ref.Name), namespace, n.Namespaces.GetNames())
			// service name should not be set in fqdn format
			// if the grpc route is referencing to a service from the same namespace, then service should exist there
			// if the grpc route is referencing to a service from other namespace, then a ReferenceGrant should exist to cross namespace reference, and the service should exist in remote namespace
			if strings.Contains(string(ref.Name), ".") ||
				(namespace == n.K8sGRPCRoute.Namespace && !n.checkDestination(fqdn.String(), namespace)) ||
				(namespace != n.K8sGRPCRoute.Namespace && (!n.checkReferenceGrant(n.K8sGRPCRoute.Namespace, namespace) || !n.checkDestination(fqdn.String(), namespace))) {
				path := fmt.Sprintf("spec/rules[%d]/backendRefs[%d]/name", k, i)
				validation := models.Build("k8sroutes.nohost.namenotfound", path)
				validations = append(validations, &validation)
				valid = false
			}
		}
	}

	return validations, valid
}

func (n NoHostChecker) checkDestination(sHost string, itemNamespace string) bool {
	// Use RegistryService to check destinations that may not be covered with previous check
	// i.e. Multi-cluster or Federation validations
	return kubernetes.HasMatchingRegistryService(itemNamespace, sHost, n.RegistryServices)
}

func (n NoHostChecker) checkReferenceGrant(fromNamespace string, toNamespace string) bool {
	// Use ReferenceGrant objects to check if cross namespace reference exists
	return kubernetes.HasMatchingReferenceGrant(fromNamespace, toNamespace, kubernetes.K8sActualGRPCRouteType, kubernetes.ServiceType, n.K8sReferenceGrants)
}
