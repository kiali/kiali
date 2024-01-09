package checkers

import (
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/business/checkers/k8sreferencegrants"
	"github.com/kiali/kiali/models"
)

const K8sReferenceGrantCheckerType = "k8sreferencegrant"

type K8sReferenceGrantChecker struct {
	Cluster            string
	K8sReferenceGrants []*k8s_networking_v1beta1.ReferenceGrant
	Namespaces         models.Namespaces
}

// Check runs checks for the all namespaces actions as well as for the single namespace validations
func (in K8sReferenceGrantChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	validations = validations.MergeValidations(in.runIndividualChecks())

	return validations
}

// Runs individual checks for each Reference Grant
func (in K8sReferenceGrantChecker) runIndividualChecks() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, rt := range in.K8sReferenceGrants {
		validations.MergeValidations(in.runChecks(rt))
	}

	return validations
}

func (in K8sReferenceGrantChecker) runChecks(rg *k8s_networking_v1beta1.ReferenceGrant) models.IstioValidations {
	key, validations := EmptyValidValidation(rg.Name, rg.Namespace, K8sReferenceGrantCheckerType, in.Cluster)

	enabledCheckers := []Checker{
		k8sreferencegrants.NamespaceChecker{
			Namespaces:     in.Namespaces,
			ReferenceGrant: *rg,
		},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	return models.IstioValidations{key: validations}
}
