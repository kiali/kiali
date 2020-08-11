package virtual_services

import (
	"fmt"
	"reflect"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
)

type SubsetPresenceChecker struct {
	Namespace        string
	Namespaces       []string
	DestinationRules []kubernetes.IstioObject
	VirtualService   kubernetes.IstioObject
}

func (checker SubsetPresenceChecker) Check() ([]*models.IstioCheck, bool) {
	valid := true
	validations := make([]*models.IstioCheck, 0)

	protocols := [3]string{"http", "tcp", "tls"}
	for _, protocol := range protocols {
		specProtocol := checker.VirtualService.GetSpec()[protocol]
		if specProtocol == nil {
			continue
		}

		// Getting a []HTTPRoute, []TLSRoute, []TCPRoute
		slice := reflect.ValueOf(specProtocol)
		if slice.Kind() != reflect.Slice {
			continue
		}

		for routeIdx := 0; routeIdx < slice.Len(); routeIdx++ {
			httpRoute, ok := slice.Index(routeIdx).Interface().(map[string]interface{})
			if !ok || httpRoute["route"] == nil {
				continue
			}

			// Getting a []DestinationWeight
			destinationWeights := reflect.ValueOf(httpRoute["route"])
			if destinationWeights.Kind() != reflect.Slice {
				return validations, valid
			}

			for destWeightIdx := 0; destWeightIdx < destinationWeights.Len(); destWeightIdx++ {
				destinationWeight, ok := destinationWeights.Index(destWeightIdx).Interface().(map[string]interface{})
				if !ok || destinationWeight["destination"] == nil {
					continue
				}

				destination, ok := destinationWeight["destination"].(map[string]interface{})
				if !ok {
					continue
				}

				host, ok := destination["host"].(string)
				if !ok {
					continue
				}

				subset, ok := destination["subset"].(string)
				if !ok {
					continue
				}

				if !checker.subsetPresent(host, subset) {
					path := fmt.Sprintf("spec/%s[%d]/route[%d]/destination", protocol, routeIdx, destWeightIdx)
					validation := models.Build("virtualservices.subsetpresent.subsetnotfound", path)
					validations = append(validations, &validation)
				}
			}
		}
	}

	return validations, valid
}

func (checker SubsetPresenceChecker) subsetPresent(host string, subset string) bool {
	destinationRules, ok := checker.getDestinationRules(host)
	if !ok || destinationRules == nil || len(destinationRules) == 0 {
		return false
	}

	for _, dr := range destinationRules {
		if hasSubsetDefined(dr, subset) {
			return true
		}
	}

	return false
}

func (checker SubsetPresenceChecker) getDestinationRules(virtualServiceHost string) ([]kubernetes.IstioObject, bool) {
	drs := make([]kubernetes.IstioObject, 0, len(checker.DestinationRules))

	for _, destinationRule := range checker.DestinationRules {
		host, ok := destinationRule.GetSpec()["host"]
		if !ok {
			continue
		}

		sHost, ok := host.(string)
		if !ok {
			continue
		}

		drHost := kubernetes.GetHost(sHost, destinationRule.GetObjectMeta().Namespace, destinationRule.GetObjectMeta().ClusterName, checker.Namespaces)
		vsHost := kubernetes.GetHost(virtualServiceHost, checker.Namespace, checker.VirtualService.GetObjectMeta().ClusterName, checker.Namespaces)

		// TODO Host could be in another namespace (FQDN)
		if kubernetes.FilterByHost(vsHost.String(), drHost.Service, drHost.Namespace) {
			drs = append(drs, destinationRule)
		}
	}

	return drs, len(drs) > 0
}

func hasSubsetDefined(destinationRule kubernetes.IstioObject, subsetTarget string) bool {
	if subsets, ok := destinationRule.GetSpec()["subsets"]; ok {
		if dSubsets, ok := subsets.([]interface{}); ok {
			for _, subset := range dSubsets {
				if innerSubset, ok := subset.(map[string]interface{}); ok {
					if sSubsetName := innerSubset["name"]; ok {
						subsetName := sSubsetName.(string)
						if subsetName == subsetTarget {
							return true
						}
					}
				}
			}
		}
	}
	return false
}
