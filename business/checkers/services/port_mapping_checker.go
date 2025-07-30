package services

import (
	"fmt"
	"strings"

	apps_v1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
)

type PortMappingChecker struct {
	Service     corev1.Service
	Deployments []apps_v1.Deployment
	Pods        []corev1.Pod
}

func (p PortMappingChecker) Check() ([]*models.IstioCheck, bool) {
	validations := make([]*models.IstioCheck, 0)

	// Check Port naming for services in the service mesh
	if p.hasMatchingPodsWithSidecar(p.Service) {
		for portIndex, sp := range p.Service.Spec.Ports {
			if _, ok := p.Service.Labels["kiali_wizard"]; ok || strings.ToLower(string(sp.Protocol)) == "udp" {
				continue
			} else if sp.AppProtocol != nil {
				if !kubernetes.MatchPortAppProtocolWithValidProtocols(sp.AppProtocol) {
					validation := models.Build("port.appprotocol.mismatch", fmt.Sprintf("spec/ports[%d]", portIndex))
					validations = append(validations, &validation)
				}
			} else if !kubernetes.MatchPortNameWithValidProtocols(sp.Name) {
				validation := models.Build("port.name.mismatch", fmt.Sprintf("spec/ports[%d]", portIndex))
				validations = append(validations, &validation)
			}
		}
	}

	// Ignoring istio-system Services as some ports are used for debug purposes and not exposed in deployments
	if config.IsIstioNamespace(p.Service.Namespace) {
		log.Tracef("Skipping Port matching check for Service %s from Istio Namespace %s", p.Service.Name, p.Service.Namespace)
		return validations, len(validations) == 0
	}
	// Ignoring waypoint Services as auto-generated
	if config.IsWaypoint(p.Service.Labels) || config.IsGateway(p.Service.Labels, map[string]string{}) {
		log.Tracef("Skipping Port matching check for waypoint Service %s from Namespace %s", p.Service.Name, p.Service.Namespace)
		return validations, len(validations) == 0
	}
	if deployment := p.findMatchingDeployment(p.Service.Spec.Selector); deployment != nil {
		p.matchPorts(&p.Service, deployment, &validations)
	}

	return validations, len(validations) == 0
}

func (p PortMappingChecker) hasMatchingPodsWithSidecar(service corev1.Service) bool {
	sPods := models.Pods{}
	sPods.Parse(kubernetes.FilterPodsByService(&service, p.Pods))
	return sPods.HasIstioSidecar()
}

func (p PortMappingChecker) findMatchingDeployment(selectors map[string]string) *apps_v1.Deployment {
	if len(selectors) == 0 {
		return nil
	}

	selector := labels.SelectorFromSet(labels.Set(selectors))

	for _, d := range p.Deployments {
		labelSet := labels.Set(d.Labels)

		if selector.Matches(labelSet) {
			return &d
		}
	}
	return nil
}

func (p PortMappingChecker) matchPorts(service *corev1.Service, deployment *apps_v1.Deployment, validations *[]*models.IstioCheck) {
Service:
	for portIndex, sp := range service.Spec.Ports {
		if sp.TargetPort.Type == intstr.String && sp.TargetPort.StrVal != "" {
			// Check port name in this case
			for _, c := range deployment.Spec.Template.Spec.Containers {
				for _, cp := range c.Ports {
					if cp.Name == sp.TargetPort.StrVal {
						continue Service
					}
				}
			}
		} else {
			portNumber := sp.Port
			if sp.TargetPort.Type == intstr.Int && sp.TargetPort.IntVal > 0 {
				// Check port number from here
				portNumber = sp.TargetPort.IntVal
			}
			for _, c := range deployment.Spec.Template.Spec.Containers {
				for _, cp := range c.Ports {
					if cp.ContainerPort == portNumber {
						continue Service
					}
				}
			}
		}
		validation := models.Build("service.deployment.port.mismatch", fmt.Sprintf("spec/ports[%d]", portIndex))
		*validations = append(*validations, &validation)
	}
}
