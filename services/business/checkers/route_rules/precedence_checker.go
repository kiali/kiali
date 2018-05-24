package route_rules

import (
	"strconv"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
	"github.com/kiali/kiali/util/intutil"
)

type PrecedenceChecker struct{ kubernetes.IstioObject }

// Check returns both an array of IstioCheck objects and a boolean telling if the route rule is valid.
// Each IstioCheck represent an error or warning detected when validating the precedence field.
func (route PrecedenceChecker) Check() ([]*models.IstioCheck, bool) {
	valid := true
	validations := make([]*models.IstioCheck, 0)

	if route.GetSpec()["precedence"] == nil {
		return validations, valid
	}

	precedence, err := intutil.Convert(route.GetSpec()["precedence"])
	if err != nil {
		valid = false
		validation := models.BuildCheck("Precedence must be a number",
			"error", "spec/precedence/"+route.GetSpec()["precedence"].(string))
		validations = append(validations, &validation)
	}

	if precedence < 0 {
		valid = false
		validation := models.BuildCheck("Precedence should be greater than or equal to 0",
			"error", "spec/precedence/"+strconv.Itoa(int(precedence)))
		validations = append(validations, &validation)
	}

	return validations, valid
}
