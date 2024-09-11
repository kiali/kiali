package virtualservices

import (
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type SingleHostChecker struct {
	Cluster         string
	Namespaces      models.Namespaces
	VirtualServices []*networking_v1.VirtualService
}

func (s SingleHostChecker) Check() models.IstioValidations {
	hostCounter := make(map[string]map[string]map[string]map[string][]*networking_v1.VirtualService)
	validations := models.IstioValidations{}

	for _, vs := range s.VirtualServices {
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
							multipleVirtualServiceCheck(virtualService, validations, serviceCounter, s.Cluster)
						}

						if isNamespaceWildcard && otherServiceHosts {
							// Reference the * or in case of * the other hosts inside namespace
							// or other stars
							refs := make([]*networking_v1.VirtualService, 0, len(namespaceCounter))
							// here in case of a, b and *, references should be a -> *, b -> *, * -> q,b
							// * should be referenced to a,b
							if containsVirtualService(virtualService, namespaceCounter["*"]) {
								for _, _serviceCounter := range namespaceCounter {
									refs = append(refs, _serviceCounter...)
								}
							} else {
								// a or b referencing to *
								refs = append(refs, namespaceCounter["*"]...)
							}
							multipleVirtualServiceCheck(virtualService, validations, refs, s.Cluster)
						}
					}
				}
			}
		}
	}

	return validations
}

func containsVirtualService(vs *networking_v1.VirtualService, vss []*networking_v1.VirtualService) bool {
	for _, item := range vss {
		if vs.Name == item.Name && vs.Namespace == item.Namespace {
			return true
		}
	}
	return false
}

func multipleVirtualServiceCheck(virtualService *networking_v1.VirtualService, validations models.IstioValidations, references []*networking_v1.VirtualService, cluster string) {
	virtualServiceName := virtualService.Name
	key := models.IstioValidationKey{Name: virtualServiceName, Namespace: virtualService.Namespace, ObjectType: kubernetes.VirtualServices.String(), Cluster: cluster}
	checks := models.Build("virtualservices.singlehost", "spec/hosts")
	rrValidation := &models.IstioValidation{
		Cluster:    cluster,
		Name:       virtualServiceName,
		ObjectType: kubernetes.VirtualServices.String(),
		Valid:      true,
		Checks: []*models.IstioCheck{
			&checks,
		},
		References: make([]models.IstioValidationKey, 0, len(references)),
	}

	for _, ref := range references {
		refKey := models.IstioValidationKey{Name: ref.Name, Namespace: ref.Namespace, ObjectType: kubernetes.VirtualServices.String(), Cluster: cluster}
		if refKey != key {
			rrValidation.References = append(rrValidation.References, refKey)
		}
	}

	validations.MergeValidations(models.IstioValidations{key: rrValidation})
}

func storeHost(hostCounter map[string]map[string]map[string]map[string][]*networking_v1.VirtualService, vs *networking_v1.VirtualService, host kubernetes.Host) {
	vsList := []*networking_v1.VirtualService{vs}

	gwList := vs.Spec.Gateways
	if len(gwList) == 0 {
		gwList = []string{"no-gateway"}
	}

	cluster := host.Cluster
	namespace := host.Namespace
	service := host.Service

	for _, gw := range gwList {
		if hostCounter[gw] == nil {
			hostCounter[gw] = map[string]map[string]map[string][]*networking_v1.VirtualService{
				cluster: {
					namespace: {
						service: vsList,
					},
				},
			}
		} else if hostCounter[gw][cluster] == nil {
			hostCounter[gw][cluster] = map[string]map[string][]*networking_v1.VirtualService{
				namespace: {
					service: vsList,
				},
			}
		} else if hostCounter[gw][cluster][namespace] == nil {
			hostCounter[gw][cluster][namespace] = map[string][]*networking_v1.VirtualService{
				service: vsList,
			}
		} else if _, ok := hostCounter[gw][cluster][namespace][service]; !ok {
			hostCounter[gw][cluster][namespace][service] = vsList
		} else {
			hostCounter[gw][cluster][namespace][service] = append(hostCounter[gw][cluster][namespace][service], vs)
		}
	}
}

func (s SingleHostChecker) getHosts(virtualService *networking_v1.VirtualService) []kubernetes.Host {
	namespace := virtualService.Namespace

	if len(virtualService.Spec.Hosts) == 0 {
		return []kubernetes.Host{}
	}

	targetHosts := make([]kubernetes.Host, 0, len(virtualService.Spec.Hosts))

	for _, hostName := range virtualService.Spec.Hosts {
		targetHosts = append(targetHosts, kubernetes.GetHost(hostName, namespace, s.Namespaces.GetNames()))
	}
	return targetHosts
}
