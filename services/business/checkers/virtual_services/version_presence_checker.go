package virtual_services

import (
	"k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"reflect"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
	"strconv"
	"strings"
)

type VersionPresenceChecker struct {
	Namespace        string
	PodList          []v1.Pod
	DestinationRules []kubernetes.IstioObject
	VirtualService   kubernetes.IstioObject
}

func (checker VersionPresenceChecker) Check() ([]*models.IstioCheck, bool) {
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

	for i := 0; i < slice.Len(); i++ {
		httpRoute, ok := slice.Index(i).Interface().(map[string]interface{})
		if !ok || httpRoute["route"] == nil {
			continue
		}

		// Getting a []DestinationWeight
		destinationWeights := reflect.ValueOf(httpRoute["route"])
		if destinationWeights.Kind() != reflect.Slice {
			return validations, valid
		}

		for j := 0; j < destinationWeights.Len(); j++ {
			destinationWeight, ok := destinationWeights.Index(j).Interface().(map[string]interface{})
			if !ok || destinationWeight["destination"] == nil {
				valid = false
				validation := models.BuildCheck("Destination field is mandatory", "error",
					"spec/http["+strconv.Itoa(i)+"]/route["+strconv.Itoa(j)+"]")
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

			// Are there pods for that host and subset
			subsetSelector := checker.getSelector(host, subset)
			if subsetSelector == nil {
				valid = false
				validation := models.BuildCheck("Subset not found", "warning",
					"spec/http["+strconv.Itoa(i)+"]/route["+strconv.Itoa(j)+"]/destination")
				validations = append(validations, &validation)
			} else if !checker.hasMatchingPod(subsetSelector) {
				valid = false
				validation := models.BuildCheck("No pods found for this selector", "warning",
					"spec/http["+strconv.Itoa(i)+"]/route["+strconv.Itoa(j)+"]/destination")
				validations = append(validations, &validation)
			}
		}
	}

	return validations, valid
}

func (checker VersionPresenceChecker) hasMatchingPod(selector labels.Selector) bool {
	podFound := false

	for _, pod := range checker.PodList {
		podFound = selector.Matches(labels.Set(pod.ObjectMeta.Labels)) &&
			pod.ObjectMeta.Namespace == checker.VirtualService.GetObjectMeta().Namespace
		if podFound {
			break
		}
	}

	return podFound
}

func (checker VersionPresenceChecker) getSelector(host string, subset string) labels.Selector {
	destinationRule, ok := checker.getDestinationRule(host)
	if !ok {
		return nil
	}

	labels, ok := GetSubsetLabel(destinationRule, subset)
	if !ok {
		return nil
	}

	return labels
}

func (checker VersionPresenceChecker) getDestinationRule(virtualServiceHost string) (kubernetes.IstioObject, bool) {
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

		if kubernetes.CheckHostnameService(virtualServiceHost, serviceName, namespace) {
			return destinationRule, true
		}
	}

	return nil, false
}

func GetSubsetLabel(destinationRule kubernetes.IstioObject, subsetTarget string) (labels.Selector, bool) {
	if subsets, ok := destinationRule.GetSpec()["subsets"]; ok {
		if dSubsets, ok := subsets.([]interface{}); ok {
			for _, subset := range dSubsets {
				if innerSubset, ok := subset.(map[string]interface{}); ok {
					subsetName := innerSubset["name"].(string)
					if subsetName == subsetTarget {
						if labels, ok := innerSubset["labels"]; ok {
							if dLabels, ok := labels.(map[string]interface{}); ok {
								return ParseLabels(dLabels), true
							}
						}
					}
				}
			}
		}
	}
	return nil, false
}

func ParseLabels(rawLabels map[string]interface{}) labels.Selector {
	routeLabels := map[string]string{}
	for key, value := range rawLabels {
		routeLabels[key] = value.(string)
	}
	return labels.Set(routeLabels).AsSelector()
}
