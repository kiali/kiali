package route_rules

import (
	"reflect"
	"strconv"

	"k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
)

type VersionPresenceChecker struct {
	Namespace string
	PodList   []v1.Pod
	RouteRule kubernetes.IstioObject
}

func (checker VersionPresenceChecker) Check() ([]*models.IstioCheck, bool) {
	valid := true
	validations := make([]*models.IstioCheck, 0)

	slice := reflect.ValueOf(checker.RouteRule.GetSpec()["route"])
	if slice.Kind() != reflect.Slice {
		return validations, valid
	}

	for i := 0; i < slice.Len(); i++ {
		route, ok := slice.Index(i).Interface().(map[string]interface{})
		if !ok || route["labels"] == nil {
			continue
		}

		routeSelector := getSelector(checker.RouteRule, route["labels"])
		if routeSelector == nil || !checker.hasMatchingPod(routeSelector) {
			valid = false
			validation := models.BuildCheck("No pods found for this selector", "warning",
				"spec/route["+strconv.Itoa(i)+"]/labels")
			validations = append(validations, &validation)
		}

	}

	return validations, valid
}

func (checker VersionPresenceChecker) hasMatchingPod(selector labels.Selector) bool {
	podFound := false

	for _, pod := range checker.PodList {
		podFound = selector.Matches(labels.Set(pod.ObjectMeta.Labels))
		if podFound {
			break
		}
	}

	return podFound
}

func getSelector(routeRule kubernetes.IstioObject, rawLabels interface{}) labels.Selector {
	routeLabels := map[string]string{}

	castedLabels, ok := rawLabels.(map[string]interface{})
	if !ok {
		return nil
	}

	for key, value := range castedLabels {
		routeLabels[key] = value.(string)
	}

	routeLabels[config.Get().ServiceFilterLabelName] = getServiceName(routeRule)
	return labels.Set(routeLabels).AsSelector()
}

func getServiceName(routeRule kubernetes.IstioObject) string {
	serviceName := ""

	spec := routeRule.GetSpec()
	if spec == nil {
		return ""
	}

	if destination, ok := spec["destination"]; ok {
		dest, ok := destination.(map[string]interface{})
		if ok {
			serviceName = dest["name"].(string)
		}
	}

	return serviceName
}
