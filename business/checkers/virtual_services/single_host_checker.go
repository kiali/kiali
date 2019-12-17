package virtual_services

import (
	"reflect"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type SingleHostChecker struct {
	Namespace       string
	Namespaces      models.Namespaces
	VirtualServices []kubernetes.IstioObject
}

func (s SingleHostChecker) Check() models.IstioValidations {
	hostCounter := make(map[string]map[string]map[string][]*kubernetes.IstioObject)
	validations := models.IstioValidations{}

	for _, vs := range s.VirtualServices {
		for _, host := range s.getHosts(vs) {
			storeHost(hostCounter, vs, host)
		}
	}

	for _, clusterCounter := range hostCounter {
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
					if hasGateways(virtualService) {
						continue
					}

					if targetSameHost {
						// Reference everything within serviceCounter
						multipleVirtualServiceCheck(*virtualService, validations, serviceCounter)
					}

					if isNamespaceWildcard && otherServiceHosts {
						// Reference the * or in case of * the other hosts inside namespace
						// or other stars
						refs := make([]*kubernetes.IstioObject, 0, len(namespaceCounter))
						for _, serviceCounter := range namespaceCounter {
							refs = append(refs, serviceCounter...)
						}
						multipleVirtualServiceCheck(*virtualService, validations, refs)
					}
				}
			}
		}
	}

	return validations
}

func multipleVirtualServiceCheck(virtualService kubernetes.IstioObject, validations models.IstioValidations, references []*kubernetes.IstioObject) {
	virtualServiceName := virtualService.GetObjectMeta().Name
	key := models.IstioValidationKey{Name: virtualServiceName, Namespace: virtualService.GetObjectMeta().Namespace, ObjectType: "virtualservice"}
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
		refKey := models.IstioValidationKey{Name: ref.GetObjectMeta().Name, Namespace: ref.GetObjectMeta().Namespace, ObjectType: "virtualservice"}
		if refKey != key {
			rrValidation.References = append(rrValidation.References, refKey)
		}
	}

	validations.MergeValidations(models.IstioValidations{key: rrValidation})
}

func storeHost(hostCounter map[string]map[string]map[string][]*kubernetes.IstioObject, vs kubernetes.IstioObject, host kubernetes.Host) {
	vsList := []*kubernetes.IstioObject{&vs}

	if hostCounter[host.Cluster] == nil {
		hostCounter[host.Cluster] = map[string]map[string][]*kubernetes.IstioObject{
			host.Namespace: {
				host.Service: vsList,
			},
		}
	} else if hostCounter[host.Cluster][host.Namespace] == nil {
		hostCounter[host.Cluster][host.Namespace] = map[string][]*kubernetes.IstioObject{
			host.Service: vsList,
		}
	} else if _, ok := hostCounter[host.Cluster][host.Namespace][host.Service]; !ok {
		hostCounter[host.Cluster][host.Namespace][host.Service] = vsList
	} else {
		hostCounter[host.Cluster][host.Namespace][host.Service] = append(hostCounter[host.Cluster][host.Namespace][host.Service], &vs)

	}
}

func (s SingleHostChecker) getHosts(virtualService kubernetes.IstioObject) []kubernetes.Host {
	namespace, clusterName := virtualService.GetObjectMeta().Namespace, virtualService.GetObjectMeta().ClusterName
	if clusterName == "" {
		clusterName = config.Get().ExternalServices.Istio.IstioIdentityDomain
	}

	hosts := virtualService.GetSpec()["hosts"]
	if hosts == nil {
		return []kubernetes.Host{}
	}

	slice := reflect.ValueOf(hosts)
	if slice.Kind() != reflect.Slice {
		return []kubernetes.Host{}
	}

	targetHosts := make([]kubernetes.Host, 0, slice.Len())

	for hostIdx := 0; hostIdx < slice.Len(); hostIdx++ {
		hostName, ok := slice.Index(hostIdx).Interface().(string)
		if !ok {
			continue
		}

		targetHosts = append(targetHosts, kubernetes.GetHost(hostName, namespace, clusterName, s.Namespaces.GetNames()))
	}

	return targetHosts
}

func hasGateways(virtualService *kubernetes.IstioObject) bool {
	if gateways, ok := (*virtualService).GetSpec()["gateways"]; ok {
		vsGateways, ok := (gateways).([]interface{})
		return ok && vsGateways != nil && len(vsGateways) > 0
	}
	return false
}
