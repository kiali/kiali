package checkers

import (
	"github.com/kiali/kiali/business/checkers/authorization"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

const ServiceRoleBindingCheckerType = "servicerolebinding"

type ServiceRoleBindChecker struct {
	RBACDetails kubernetes.RBACDetails
}

func (s ServiceRoleBindChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, roleBindings := range s.RBACDetails.ServiceRoleBindings {
		validations.MergeValidations(s.runChecks(roleBindings))
	}

	return validations

}

func (s ServiceRoleBindChecker) runChecks(roleBind kubernetes.IstioObject) models.IstioValidations {
	serviceRoleBindName := roleBind.GetObjectMeta().Name
	key := models.IstioValidationKey{Name: serviceRoleBindName, ObjectType: ServiceRoleBindingCheckerType}
	validations := &models.IstioValidation{
		Name:       key.Name,
		ObjectType: key.ObjectType,
		Valid:      true,
		Checks:     []*models.IstioCheck{},
	}

	enabledCheckers := []Checker{
		authorization.BindingChecker{
			ServiceRoleBinding: roleBind,
			ServiceRoles:       s.RBACDetails.ServiceRoles,
		},
	}

	for _, checker := range enabledCheckers {
		checks, valid := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && valid
	}

	return models.IstioValidations{key: validations}
}
