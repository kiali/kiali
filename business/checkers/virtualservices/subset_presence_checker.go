package virtualservices

import (
	"fmt"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type SubsetPresenceChecker struct {
	Namespaces       []string
	DestinationRules []*networking_v1.DestinationRule
	VirtualService   *networking_v1.VirtualService
}

func (checker SubsetPresenceChecker) Check() ([]*models.IstioCheck, bool) {
	valid := true
	validations := make([]*models.IstioCheck, 0)

	for routeIdx, httpRoute := range checker.VirtualService.Spec.Http {
		if httpRoute == nil {
			continue
		}
		for destWeightIdx, destinationWeight := range httpRoute.Route {
			if destinationWeight == nil && destinationWeight.Destination == nil {
				continue
			}
			host := destinationWeight.Destination.Host
			if host == "" {
				continue
			}
			subset := destinationWeight.Destination.Subset
			if subset == "" {
				continue
			}
			if !checker.subsetPresent(host, subset) {
				path := fmt.Sprintf("spec/http[%d]/route[%d]/destination", routeIdx, destWeightIdx)
				validation := models.Build("virtualservices.subsetpresent.subsetnotfound", path)
				validations = append(validations, &validation)
			}
		}
	}

	for routeIdx, tcpRoute := range checker.VirtualService.Spec.Tcp {
		if tcpRoute == nil {
			continue
		}
		for destWeightIdx, destinationWeight := range tcpRoute.Route {
			if destinationWeight == nil && destinationWeight.Destination == nil {
				continue
			}
			host := destinationWeight.Destination.Host
			if host == "" {
				continue
			}
			subset := destinationWeight.Destination.Subset
			if subset == "" {
				continue
			}
			if !checker.subsetPresent(host, subset) {
				path := fmt.Sprintf("spec/tcp[%d]/route[%d]/destination", routeIdx, destWeightIdx)
				validation := models.Build("virtualservices.subsetpresent.subsetnotfound", path)
				validations = append(validations, &validation)
			}
		}

	}

	for routeIdx, tlsRoute := range checker.VirtualService.Spec.Tls {
		if tlsRoute == nil {
			continue
		}
		for destWeightIdx, destinationWeight := range tlsRoute.Route {
			if destinationWeight == nil && destinationWeight.Destination == nil {
				continue
			}
			host := destinationWeight.Destination.Host
			if host == "" {
				continue
			}
			subset := destinationWeight.Destination.Subset
			if subset == "" {
				continue
			}
			if !checker.subsetPresent(host, subset) {
				path := fmt.Sprintf("spec/tls[%d]/route[%d]/destination", routeIdx, destWeightIdx)
				validation := models.Build("virtualservices.subsetpresent.subsetnotfound", path)
				validations = append(validations, &validation)
			}
		}
	}
	return validations, valid
}

func (checker SubsetPresenceChecker) subsetPresent(host string, subset string) bool {
	destinationRules, ok := checker.getDestinationRules(host)
	if !ok || destinationRules == nil || len(destinationRules) == 0 {
		return false
	}

	for _, dr := range destinationRules {
		if hasSubsetDefined(dr, subset) {
			return true
		}
	}
	return false
}

func (checker SubsetPresenceChecker) getDestinationRules(virtualServiceHost string) ([]*networking_v1.DestinationRule, bool) {
	drs := make([]*networking_v1.DestinationRule, 0, len(checker.DestinationRules))

	for _, destinationRule := range checker.DestinationRules {
		host := destinationRule.Spec.Host

		drHost := kubernetes.GetHost(host, destinationRule.Namespace, checker.Namespaces)
		vsHost := kubernetes.GetHost(virtualServiceHost, checker.VirtualService.Namespace, checker.Namespaces)

		// TODO Host could be in another namespace (FQDN)
		if kubernetes.FilterByHost(vsHost.String(), vsHost.Namespace, drHost.Service, drHost.Namespace) {
			drs = append(drs, destinationRule)
		}
	}

	return drs, len(drs) > 0
}

func hasSubsetDefined(destinationRule *networking_v1.DestinationRule, subsetTarget string) bool {
	for _, subset := range destinationRule.Spec.Subsets {
		if subset == nil {
			continue
		}
		if subset.Name == subsetTarget {
			return true
		}
	}
	return false
}
