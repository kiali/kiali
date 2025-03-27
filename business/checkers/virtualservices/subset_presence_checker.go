package virtualservices

import (
	"fmt"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type SubsetPresenceChecker struct {
	Conf           *config.Config
	DRSubsets      models.DestinationRuleSubsets
	Namespaces     []string
	VirtualService *networking_v1.VirtualService
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
	vsHost := kubernetes.GetHost(host, checker.VirtualService.Namespace, checker.Namespaces, checker.Conf)

	if subsets, exists := checker.DRSubsets[vsHost.String()]; exists {
		if drHost, hostExists := subsets[subset]; hostExists {
			if kubernetes.FilterByHost(vsHost.String(), vsHost.Namespace, drHost.Service, drHost.Namespace, checker.Conf) {
				return true
			}
		}
	}

	return false
}
