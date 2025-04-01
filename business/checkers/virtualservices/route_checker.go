package virtualservices

import (
	"fmt"

	api_networking_v1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type RouteChecker struct {
	Conf           *config.Config
	Namespaces     []string
	VirtualService *networking_v1.VirtualService
}

// Check returns both an array of IstioCheck and a boolean indicating if the current route rule is valid.
// The array of IstioChecks contains the result of running the following validations:
// 1. All weights with a numeric number.
// 2. All weights have value between 0 and 100.
// 3. Sum of all weights are 100 (if only one weight, then it assumes that is 100).
// 4. All the route has to have weight label.
func (route RouteChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true

	cs, v := route.checkHttpRoutes()
	checks = append(checks, cs...)
	valid = valid && v

	cs, v = route.checkTcpRoutes()
	checks = append(checks, cs...)
	valid = valid && v

	cs, v = route.checkTlsRoutes()
	checks = append(checks, cs...)
	valid = valid && v

	return checks, valid
}

func (route RouteChecker) checkHttpRoutes() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true

	for routeIdx, httpRoute := range route.VirtualService.Spec.Http {
		if httpRoute == nil {
			continue
		}

		// Getting a []DestinationWeight
		destinationWeights := httpRoute.Route

		if len(destinationWeights) == 1 {
			if destinationWeights[0] == nil {
				continue
			}
			weight := destinationWeights[0].Weight
			// We can't rely on nil value as Weight is an integer that will be always present
			if weight > 0 && weight < 100 {
				valid = true
				path := fmt.Sprintf("spec/http[%d]/route[%d]/weight", routeIdx, 0)
				validation := models.Build("virtualservices.route.singleweight", path)
				validations = append(validations, &validation)
			}
		}

		route.trackHttpSubset(routeIdx, "http", destinationWeights, &validations)
	}

	return validations, valid
}

func (route RouteChecker) checkTcpRoutes() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true

	for routeIdx, tcpRoute := range route.VirtualService.Spec.Tcp {
		if tcpRoute == nil {
			continue
		}

		// Getting a []DestinationWeight
		destinationWeights := tcpRoute.Route

		if len(destinationWeights) == 1 {
			if destinationWeights[0] == nil {
				continue
			}
			weight := destinationWeights[0].Weight
			// We can't rely on nil value as Weight is an integer that will be always present
			if weight > 0 && weight < 100 {
				valid = true
				path := fmt.Sprintf("spec/tcp[%d]/route[%d]/weight", routeIdx, 0)
				validation := models.Build("virtualservices.route.singleweight", path)
				validations = append(validations, &validation)
			}
		}

		route.trackTcpTlsSubset(routeIdx, "tcp", destinationWeights, &validations)
	}

	return validations, valid
}

func (route RouteChecker) checkTlsRoutes() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true

	for routeIdx, tlsRoute := range route.VirtualService.Spec.Tls {
		if tlsRoute == nil {
			continue
		}

		// Getting a []DestinationWeight
		destinationWeights := tlsRoute.Route

		if len(destinationWeights) == 1 {
			if destinationWeights[0] == nil {
				continue
			}
			weight := destinationWeights[0].Weight
			// We can't rely on nil value as Weight is an integer that will be always present
			if weight > 0 && weight < 100 {
				valid = true
				path := fmt.Sprintf("spec/tls[%d]/route[%d]/weight", routeIdx, 0)
				validation := models.Build("virtualservices.route.singleweight", path)
				validations = append(validations, &validation)
			}
		}

		route.trackTcpTlsSubset(routeIdx, "tls", destinationWeights, &validations)
	}

	return validations, valid
}

func (route RouteChecker) trackHttpSubset(routeIdx int, kind string, destinationWeights []*api_networking_v1.HTTPRouteDestination, checks *[]*models.IstioCheck) {
	subsetCollitions := map[string][]int{}

	for destWeightIdx, destinationWeight := range destinationWeights {
		if destinationWeight == nil {
			continue
		}
		if destinationWeight.Destination == nil {
			return
		}
		fqdn := kubernetes.GetHost(destinationWeight.Destination.Host, route.VirtualService.Namespace, route.Namespaces, route.Conf)
		subset := destinationWeight.Destination.Subset
		key := fmt.Sprintf("%s%s", fqdn.String(), subset)
		collisions := subsetCollitions[key]
		if collisions == nil {
			collisions = make([]int, 0, len(destinationWeights))
		}
		subsetCollitions[key] = append(collisions, destWeightIdx)

	}
	appendSubsetDuplicity(routeIdx, kind, subsetCollitions, checks)
}

func (route RouteChecker) trackTcpTlsSubset(routeIdx int, kind string, destinationWeights []*api_networking_v1.RouteDestination, checks *[]*models.IstioCheck) {
	subsetCollitions := map[string][]int{}

	for destWeightIdx, destinationWeight := range destinationWeights {
		if destinationWeight == nil {
			continue
		}
		if destinationWeight.Destination == nil {
			return
		}
		fqdn := kubernetes.GetHost(destinationWeight.Destination.Host, route.VirtualService.Namespace, route.Namespaces, route.Conf)
		subset := destinationWeight.Destination.Subset
		key := fmt.Sprintf("%s%s", fqdn.String(), subset)
		collisions := subsetCollitions[key]
		if collisions == nil {
			collisions = make([]int, 0, len(destinationWeights))
		}
		subsetCollitions[key] = append(collisions, destWeightIdx)

	}
	appendSubsetDuplicity(routeIdx, kind, subsetCollitions, checks)
}

func appendSubsetDuplicity(routeIdx int, kind string, collistionsMap map[string][]int, checks *[]*models.IstioCheck) {
	for _, dups := range collistionsMap {
		if len(dups) > 1 {
			for _, dup := range dups {
				path := fmt.Sprintf("spec/%s[%d]/route[%d]/host", kind, routeIdx, dup)
				validation := models.Build("virtualservices.route.repeatedsubset", path)
				*checks = append(*checks, &validation)
			}
		}
	}
}
