package threshold

import (
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
)

/*
  Group Request by label

	Return:
		- Count: Number of requests that apply the filter
		- Total: Number of requests
*/
func CountBy(requests *model.Vector, check config.ThresholdCheck) (count int, total int, err error) {
	filterSample := FilterRequests(requests, check)
	regex := GetRegex(check.Expression)
	count = 0
	total = len(*filterSample)
	for _, req := range *filterSample {
		if val, ok := req.Metric[model.LabelName(check.Label)]; ok {
			err, _ := CheckExpr(string(val), *regex)
			if err == nil {
				count += 1
			}
		} else {
			return -1, -1, err
		}
	}
	return count, total, nil
}
