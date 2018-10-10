package checkers

import (
	"github.com/kiali/kiali/business/checkers/destination_rules"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type DestinationRulesChecker struct {
	DestinationRules []kubernetes.IstioObject
}

func (in DestinationRulesChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	enabledDRCheckers := []GroupChecker{
		destination_rules.MultiMatchChecker{in.DestinationRules},
	}

	for _, checker := range enabledDRCheckers {
		validations = validations.MergeValidations(checker.Check())
	}

	return validations
}
