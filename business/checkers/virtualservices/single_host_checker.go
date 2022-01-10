package virtualservices

import (
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type SingleHostChecker struct {
	Namespace               string
	Namespaces              models.Namespaces
	ExportedVirtualServices []networking_v1alpha3.VirtualService
}

func (s SingleHostChecker) Check() models.IstioValidations {
	hostCounter := make(map[string]map[string]map[string]map[string][]*networking_v1alpha3.VirtualService)
	validations := models.IstioValidations{}

	for _, vs := range s.ExportedVirtualServices {
		for _, host := range s.getHosts(vs) {
			storeHost(hostCounter, vs, host)
		}
	}

	for _, gateways := range hostCounter {
		for _, clusterCounter := range gateways {
			for _, namespaceCounter := range clusterCounter {
				for _, serviceCounter := range namespaceCounter {
					isNamespaceWildcard := len(namespaceCounter["*"]) > 0
					targetSameHost := len(serviceCounter) > 1
					otherServiceHosts := len(namespaceCounter) > 1
					for _, virtualService := range serviceCounter {
						// Marking virtualService as invalid if:
						// - there is more than one virtual service per a host
						// - there is one virtual service with wildcard and there are other virtual services pointing
						//   a host for that namespace
						if targetSameHost {
							// Reference everything within serviceCounter
							multipleVirtualServiceCheck(*virtualService, validations, serviceCounter)
						}

						if isNamespaceWildcard && otherServiceHosts {
							// Reference the * or in case of * the other hosts inside namespace
							// or other stars
							refs := make([]*networking_v1alpha3.VirtualService, 0, len(namespaceCounter))
							for _, serviceCounter := range namespaceCounter {
								refs = append(refs, serviceCounter...)
							}
							multipleVirtualServiceCheck(*virtualService, validations, refs)
						}
					}
				}
			}
		}
	}

	return validations
}

func multipleVirtualServiceCheck(virtualService networking_v1alpha3.VirtualService, validations models.IstioValidations, references []*networking_v1alpha3.VirtualService) {
	virtualServiceName := virtualService.Name
	key := models.IstioValidationKey{Name: virtualServiceName, Namespace: virtualService.Namespace, ObjectType: "virtualservice"}
	checks := models.Build("virtualservices.singlehost", "spec/hosts")
	rrValidation := &models.IstioValidation{
		Name:       virtualServiceName,
		ObjectType: "virtualservice",
		Valid:      true,
		Checks: []*models.IstioCheck{
			&checks,
		},
		References: make([]models.IstioValidationKey, 0, len(references)),
	}

	for _, ref := range references {
		ref := *ref
		refKey := models.IstioValidationKey{Name: ref.Name, Namespace: ref.Namespace, ObjectType: "virtualservice"}
		if refKey != key {
			rrValidation.References = append(rrValidation.References, refKey)
		}
	}

	validations.MergeValidations(models.IstioValidations{key: rrValidation})
}

func storeHost(hostCounter map[string]map[string]map[string]map[string][]*networking_v1alpha3.VirtualService, vs networking_v1alpha3.VirtualService, host kubernetes.Host) {
	vsList := []*networking_v1alpha3.VirtualService{&vs}

	gwList := vs.Spec.Gateways
	if len(gwList) == 0 {
		gwList = []string{"no-gateway"}
	}

	if !host.CompleteInput {
		host.Cluster = config.Get().ExternalServices.Istio.IstioIdentityDomain
		host.Namespace = vs.Namespace
	}

	for _, gw := range gwList {
		if hostCounter[gw] == nil {
			hostCounter[gw] = map[string]map[string]map[string][]*networking_v1alpha3.VirtualService{
				host.Cluster: {
					host.Namespace: {
						host.Service: vsList,
					},
				},
			}
		} else if hostCounter[gw][host.Cluster] == nil {
			hostCounter[gw][host.Cluster] = map[string]map[string][]*networking_v1alpha3.VirtualService{
				host.Namespace: {
					host.Service: vsList,
				},
			}
		} else if hostCounter[gw][host.Cluster][host.Namespace] == nil {
			hostCounter[gw][host.Cluster][host.Namespace] = map[string][]*networking_v1alpha3.VirtualService{
				host.Service: vsList,
			}
		} else if _, ok := hostCounter[gw][host.Cluster][host.Namespace][host.Service]; !ok {
			hostCounter[gw][host.Cluster][host.Namespace][host.Service] = vsList
		} else {
			hostCounter[gw][host.Cluster][host.Namespace][host.Service] = append(hostCounter[gw][host.Cluster][host.Namespace][host.Service], &vs)
		}
	}
}

func (s SingleHostChecker) getHosts(virtualService networking_v1alpha3.VirtualService) []kubernetes.Host {
	namespace, clusterName := virtualService.Namespace, virtualService.ClusterName
	if clusterName == "" {
		clusterName = config.Get().ExternalServices.Istio.IstioIdentityDomain
	}

	if len(virtualService.Spec.Hosts) == 0 {
		return []kubernetes.Host{}
	}

	targetHosts := make([]kubernetes.Host, 0, len(virtualService.Spec.Hosts))

	for _, hostName := range virtualService.Spec.Hosts {
		targetHosts = append(targetHosts, kubernetes.GetHost(hostName, namespace, clusterName, s.Namespaces.GetNames()))
	}
	return targetHosts
}
