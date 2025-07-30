package checkers

import (
	apps_v1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business/checkers/services"
	"github.com/kiali/kiali/models"
)

const ServiceCheckerType = "service"

type ServiceChecker struct {
	Services    []corev1.Service
	Deployments []apps_v1.Deployment
	Pods        []corev1.Pod
	Cluster     string
}

func (sc ServiceChecker) Check() models.IstioValidations {
	validations := models.IstioValidations{}

	for _, s := range sc.Services {
		validations.MergeValidations(sc.runSingleChecks(s))
	}

	return validations
}

func (sc ServiceChecker) runSingleChecks(service corev1.Service) models.IstioValidations {
	// TODO for now a hacky way
	key, validations := EmptyValidValidation(service.GetObjectMeta().GetName(), service.GetObjectMeta().GetNamespace(), schema.GroupVersionKind{Group: "", Version: "", Kind: ServiceCheckerType}, sc.Cluster)

	enabledCheckers := []Checker{
		services.PortMappingChecker{Service: service, Deployments: sc.Deployments, Pods: sc.Pods},
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	return models.IstioValidations{key: validations}
}
