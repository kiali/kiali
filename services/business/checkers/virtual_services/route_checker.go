package virtual_services

import (
	"reflect"
	"strconv"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
	"github.com/kiali/kiali/util/intutil"
)

type RouteChecker struct{ kubernetes.IstioObject }

// Check returns both an array of IstioCheck and a boolean indicating if the current route rule is valid.
// The array of IstioChecks contains the result of running the following validations:
// 1. All weights with a numeric number.
// 2. All weights have value between 0 and 100.
// 3. Sum of all weights are 100 (if only one weight, then it assumes that is 100).
// 4. All the route has to have weight label.
func (route RouteChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	var weightSum int
	var weightCount int
	var valid = true

	http := route.GetSpec()["http"]
	if http == nil {
		return validations, valid
	}

	// Getting a []HTTPRoute
	slice := reflect.ValueOf(http)
	if slice.Kind() != reflect.Slice {
		return validations, valid
	}

	for i := 0; i < slice.Len(); i++ {
		httpRoute, ok := slice.Index(i).Interface().(map[string]interface{})
		if !ok || httpRoute["route"] == nil {
			continue
		}

		// Getting a []DestinationWeight
		destinationWeights := reflect.ValueOf(httpRoute["route"])
		if destinationWeights.Kind() != reflect.Slice {
			return validations, valid
		}

		for j := 0; j < destinationWeights.Len(); j++ {
			destinationWeight, ok := destinationWeights.Index(j).Interface().(map[string]interface{})
			if !ok || destinationWeight["weight"] == nil {
				continue
			}

			weightCount = weightCount + 1
			weight, err := intutil.Convert(destinationWeight["weight"])
			if err != nil {
				valid = false
				validation := models.BuildCheck("Weight must be a number",
					"error", "spec/http["+strconv.Itoa(i)+"]/route["+strconv.Itoa(j)+"]/weight/"+destinationWeight["weight"].(string))
				validations = append(validations, &validation)
			}

			if weight > 100 || weight < 0 {
				valid = false
				validation := models.BuildCheck("Weight should be between 0 and 100",
					"error", "spec/http["+strconv.Itoa(i)+"]/route["+strconv.Itoa(i)+"]/weight/"+strconv.Itoa(weight))
				validations = append(validations, &validation)
			}

			weightSum = weightSum + weight
		}

		if weightCount > 0 && weightSum != 100 {
			valid = false
			validation := models.BuildCheck("Weight sum should be 100", "error",
				"spec/http["+strconv.Itoa(i)+"]/route")
			validations = append(validations, &validation)
		}

		if weightCount > 0 && weightCount != destinationWeights.Len() {
			valid = false
			validation := models.BuildCheck("All routes should have weight", "error",
				"spec/http["+strconv.Itoa(i)+"]/route")
			validations = append(validations, &validation)
		}
	}

	return validations, valid
}
