package virtual_services

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

type SubsetPresenceChecker struct {
	Namespace        string
	DestinationRules []kubernetes.IstioObject
	VirtualService   kubernetes.IstioObject
}

func (checker SubsetPresenceChecker) Check() ([]*models.IstioCheck, bool) {
	valid := true
	validations := make([]*models.IstioCheck, 0)

	http := checker.VirtualService.GetSpec()["http"]
	if http == nil {
		return validations, valid
	}

	// Getting a []HTTPRoute
	slice := reflect.ValueOf(http)
	if slice.Kind() != reflect.Slice {
		return validations, valid
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
				valid = false
				path := fmt.Sprintf("spec/http[%d]/route[%d]", routeIdx, destWeightIdx)
				validation := models.BuildCheck("Destination field is mandatory", "error", path)
				validations = append(validations, &validation)
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
				valid = false
				path := fmt.Sprintf("spec/http[%d]/route[%d]/destination", routeIdx, destWeightIdx)
				validation := models.BuildCheck("Subset not found", "warning", path)
				validations = append(validations, &validation)
			}
		}
	}

	return validations, valid
}

func (checker SubsetPresenceChecker) subsetPresent(host string, subset string) bool {
	destinationRule, ok := checker.getDestinationRule(host)
	if !ok || destinationRule == nil {
		return false
	}

	return hasSubsetDefined(destinationRule, subset)
}

func (checker SubsetPresenceChecker) getDestinationRule(virtualServiceHost string) (kubernetes.IstioObject, bool) {
	for _, destinationRule := range checker.DestinationRules {
		host, ok := destinationRule.GetSpec()["host"]
		if !ok {
			continue
		}

		sHost, ok := host.(string)
		if !ok {
			continue
		}

		domainParts := strings.Split(sHost, ".")
		serviceName := domainParts[0]
		namespace := checker.Namespace
		if len(domainParts) > 1 {
			namespace = domainParts[1]
		}

		if kubernetes.FilterByHost(virtualServiceHost, serviceName, namespace) {
			return destinationRule, true
		}
	}

	return nil, false
}

func hasSubsetDefined(destinationRule kubernetes.IstioObject, subsetTarget string) bool {
	if subsets, ok := destinationRule.GetSpec()["subsets"]; ok {
		if dSubsets, ok := subsets.([]interface{}); ok {
			for _, subset := range dSubsets {
				if innerSubset, ok := subset.(map[string]interface{}); ok {
					subsetName := innerSubset["name"].(string)
					if subsetName == subsetTarget {
						if labels, ok := innerSubset["labels"]; ok {
							if _, ok := labels.(map[string]interface{}); ok {
								return true
							}
						}
					}
				}
			}
		}
	}
	return false
}
