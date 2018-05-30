package route_rules

import (
	"reflect"
	"strconv"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/services/models"
	"k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
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
		route := slice.Index(i).Interface().(map[string]interface{})
		if route["labels"] == nil {
			continue
		}

		routeSelector := labels.Set(route["labels"].(map[string]string)).AsSelector()
		if !checker.hasMatchingPod(routeSelector) {
			valid = false
			validation := models.BuildCheck("No pods found for the selector", "warning",
				"spec/route["+strconv.Itoa(i)+"]/labels")
			validations = append(validations, &validation)
		}

	}

	return validations, valid
}

func (checker VersionPresenceChecker) hasMatchingPod(selector labels.Selector) bool {
	podFound := false

	for _, pod := range checker.PodList {
		podFound = podFound || selector.Matches(labels.Set(pod.ObjectMeta.Labels))
		if podFound {
			break
		}
	}

	return podFound
}
