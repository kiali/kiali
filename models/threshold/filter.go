package threshold

import (
	"regexp"
	"strings"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
)

/*
	FilterRequests
    Filter the requests by Prometheus options set in ThresholdCheck/Filter
      - sample => Requests from Prometheus
      - check => ThresholdCheck to apply to requests
    Return
      - result => Request that match the prometheus Filter
*/
func FilterRequests(sample *model.Vector, check config.ThresholdCheck) (result *model.Vector) {
	if check.Filter.OptProm != nil {
		result := model.Vector{}
		for _, request := range *sample {
			if FilterByLabel(*check.Filter.OptProm, request.Metric) {
				result = append(result, request)
			}
		}
		return &result
	}
	return sample
}

/*
     FilterBy
     Filter a list of ThresholdCheck that match with the ns, resource, kind of resource and labels of resource
		 - configs => The list of ThresholdHealth to filter
		 - ns => namespace of resource
		 - resource => name of resource
		 - kind => Type of resource (workload, service, app...)
		 - labels => labels of resource
	Return
         - ret => List of ThresholdCheck that match the filter options
*/
func FilterBy(configs []config.ThresholdHealth, ns string, resource string, kind string, labels map[string]string) (ret []config.ThresholdCheck) {
	thresHoldToApply := []config.ThresholdCheck{}
	for _, conf := range configs {
		if checkIfKind(conf.Namespace, ns) {
			// We can apply this alert to the namespace
			for _, alert := range conf.ThresholdChecks {
				/*
					Check if Kind match the resource
					Check if match labels
					Check if there is a regex and apply the resource name
				*/
				if checkIfKind(alert.Kind, kind) && FilterByLabel(*alert.Filter.LabelFilter, labels) && checkIfRegex(alert.Filter.Regex, resource) {
					thresHoldToApply = append(thresHoldToApply, alert)
				}

			}
		}
	}

	return thresHoldToApply
}

/*
	FilterByLabel the interface (Metrics or map)
		- filter => ThresholdLabelFilter to match
        - sample => interface to match
    Return
 		- bool => true if match the filter, otherwise false

*/
func FilterByLabel(filter config.ThresholdLabelFilter, sample interface{}) bool {
	isAnd := true
	if filter.Operation != "" {
		isAnd = filter.Operation == "and"
	}
	if filter.LabelFilter == nil {
		return FilterByORAndLabel(isAnd, filter.Labels, sample)
	}
	andResult := true
	orResult := false
	for _, v := range *filter.LabelFilter {
		if FilterByLabel(v, sample) {
			orResult = true
		} else {
			andResult = false
		}
		if (isAnd && !andResult) || (!isAnd && orResult) {
			return isAnd
		}
	}
	if isAnd {
		return andResult
	}
	return orResult
}

/*
	FilterByORAndLabel
		- and => true if operator is and, false if is or
        - labels => labels to filter
        - sample =>  interface (Metrics or map) to match
    Return
 		- bool => true if match the labels with and/or operation for sample, otherwise false

*/
func FilterByORAndLabel(and bool, labels map[string]string, sample interface{}) bool {
	isOr := false
	isAnd := true
	for k, v := range labels {
		regex := GetRegex(v)
		err, _ := CheckExpr(sample.(map[string]string)[k], *regex)
		// Check if apply for OR/AND operation
		if err == nil {
			isOr = true
		} else {
			isAnd = false
		}
		// Break in condition case to avoid continue
		if (and && !isAnd) || (!and && isOr) {
			return and
		}
	}
	// Return if apply with the operator param provided
	if and {
		return isAnd
	}
	return isOr
}

// Check if match kind of resource
func checkIfKind(filter string, kind string) bool {
	if strings.Contains(filter, kind) || filter == "**" || filter == "" {
		return true
	}
	return false
}

// Check if match labels of resource
func checkIfLabels(filter map[string]string, labels map[string]string) bool {
	for k, v := range filter {
		if labels[k] != v {
			return false
		}
	}
	return true
}

// Check if match regex
func checkIfRegex(regex string, resource string) bool {
	if regex != "" {
		reg := regexp.MustCompile(regex)
		if !reg.MatchString(resource) {
			return false
		}
	}
	return true
}
