package checkers

import (
	"github.com/kiali/kiali/business/checkers/services"
	"github.com/kiali/kiali/models"
	v1beta1 "k8s.io/api/apps/v1beta1"
	v1 "k8s.io/api/core/v1"
)

const ServiceCheckerType = "service"

type ServiceChecker struct {
	Services    []v1.Service
	Deployments []v1beta1.Deployment
}

func (sc ServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, s := range sc.Services {
		validations.MergeValidations(sc.runSingleChecks(s))
	}

	return validations
}

func (sc ServiceChecker) runSingleChecks(service v1.Service) models.IstioValidations {
	key, validations := EmptyValidValidation(service.GetObjectMeta().GetName(), ServiceCheckerType)

	enabledCheckers := []Checker{
		services.PortMappingChecker{Service: service, Deployments: sc.Deployments},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	return models.IstioValidations{key: validations}
}
