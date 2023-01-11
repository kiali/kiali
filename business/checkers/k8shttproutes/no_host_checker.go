package k8shttproutes

import (
	"fmt"

	k8s_networking_v1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type NoHostChecker struct {
	Namespaces       models.Namespaces
	K8sHTTPRoute     *k8s_networking_v1alpha2.HTTPRoute
	RegistryServices []*kubernetes.RegistryService
}

func (n NoHostChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true
	namespace := n.K8sHTTPRoute.Namespace

	for k, httpRoute := range n.K8sHTTPRoute.Spec.Rules {
		for i, ref := range httpRoute.BackendRefs {
			if ref.Kind == nil || string(*ref.Kind) != "Service" {
				continue
			}
			if ref.Namespace != nil && string(*ref.Namespace) != "" {
				namespace = string(*ref.Namespace)
			}
			fqdn := kubernetes.GetHost(string(ref.Name), namespace, n.Namespaces.GetNames())
			if !n.checkDestination(fqdn.String(), namespace) {
				path := fmt.Sprintf("spec/rules[%d]/backendRefs[%d]/name", k, i)
				validation := models.Build("k8shttproutes.nohost.namenotfound", path)
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
