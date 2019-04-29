package checkers

import (
	"github.com/kiali/kiali/business/checkers/services"
	"github.com/kiali/kiali/models"
	apps_v1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
)

const ServiceCheckerType = "service"

type ServiceChecker struct {
	Services    []v1.Service
	Deployments []apps_v1.Deployment
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
