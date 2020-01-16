package virtual_services

import (
	"fmt"
	"reflect"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util/intutil"
)

type RouteChecker struct {
	Route kubernetes.IstioObject
}

// Check returns both an array of IstioCheck and a boolean indicating if the current route rule is valid.
// The array of IstioChecks contains the result of running the following validations:
// 1. All weights with a numeric number.
// 2. All weights have value between 0 and 100.
// 3. Sum of all weights are 100 (if only one weight, then it assumes that is 100).
// 4. All the route has to have weight label.
func (route RouteChecker) Check() ([]*models.IstioCheck, bool) {
	checks, valid := make([]*models.IstioCheck, 0), true
	protocols := []string{"http", "tcp", "tls"}

	for _, protocol := range protocols {
		cs, v := route.checkRoutesFor(protocol)
		checks = append(checks, cs...)
		valid = valid && v
	}

	return checks, valid
}

func (route RouteChecker) checkRoutesFor(kind string) ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)
	valid := true

	http := route.Route.GetSpec()[kind]
	if http == nil {
		return validations, valid
	}

	// Getting a []HTTPRoute
	slice := reflect.ValueOf(http)
	if slice.Kind() != reflect.Slice {
		return validations, valid
	}

	for routeIdx := 0; routeIdx < slice.Len(); routeIdx++ {
		route, ok := slice.Index(routeIdx).Interface().(map[string]interface{})
		if !ok || route["route"] == nil {
			continue
		}

		// Getting a []DestinationWeight
		destinationWeights := reflect.ValueOf(route["route"])
		if destinationWeights.Kind() != reflect.Slice {
			return validations, valid
		}

		if destinationWeights.Len() == 1 {
			destinationWeight, ok := destinationWeights.Index(0).Interface().(map[string]interface{})
			if !ok || destinationWeight["weight"] == nil {
				continue
			}

			if weight, err := intutil.Convert(destinationWeight["weight"]); err == nil && weight < 100 {
				valid = true
				path := fmt.Sprintf("spec/%s[%d]/route/weight", kind, routeIdx)
				validation := buildValidation("virtualservices.route.singleweight", path)
				validations = append(validations, &validation)
			}
		}
	}

	return validations, valid
}

func buildValidation(checkId string, path string) models.IstioCheck {
	validation := models.Build(checkId, path)
	log.Infof("%s Galley should be performing this validation but it isn't. "+
		"Make sure Galley is fully working.", checkId)
	return validation
}
