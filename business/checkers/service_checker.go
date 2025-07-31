package checkers

import (
	apps_v1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business/checkers/services"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/models"
)

const ServiceCheckerType = "service"

type ServiceChecker struct {
	Cluster       string
	Deployments   []apps_v1.Deployment
	MeshDiscovery istio.MeshDiscovery
	Pods          []corev1.Pod
	Services      []corev1.Service
}

func NewServiceChecker(cluster string, deployments []apps_v1.Deployment, meshDiscovery istio.MeshDiscovery, pods []corev1.Pod, services []corev1.Service) ServiceChecker {
	return ServiceChecker{
		Cluster:       cluster,
		Deployments:   deployments,
		MeshDiscovery: meshDiscovery,
		Pods:          pods,
		Services:      services,
	}
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
		services.NewPortMappingChecker(sc.Deployments, sc.MeshDiscovery, sc.Pods, service),
	}

	for _, checker := range enabledCheckers {
		checks, validChecker := checker.Check()
		validations.Checks = append(validations.Checks, checks...)
		validations.Valid = validations.Valid && validChecker
	}

	return models.IstioValidations{key: validations}
}
