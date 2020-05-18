package threshold

import (
	"errors"
	"github.com/prometheus/common/model"
	"strconv"

	"github.com/kiali/kiali/config"
)

func CountBy(sample *model.Vector, alert config.ThresholdCheck) (count int, total int, err error) {
	filterSample := FilterRequests(sample, alert)
	switch alert.Label {
	case "response_code":
		return countByResponseCode(filterSample, alert)
	default:
		return countByOtherCode(filterSample, alert)
	}
}

/*
  Group Request by Other Code

	Return:
		- Count: Number of requests that apply the filter
		- Total: Number of requests
*/
func countByOtherCode(requests *model.Vector, ThAlert config.ThresholdCheck) (count int, total int, err error) {
	regex := GetRegex(ThAlert.Expression)
	count = 0
	total = len(*requests)
	for _, req := range *requests {
		if val, ok := req.Metric[model.LabelName(ThAlert.Label)]; ok {
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

/*
  Group Request by ResponseCode

	Return:
		- Count: Number of requests that apply the filter
		- Total: Number of requests
*/
func countByResponseCode(requests *model.Vector, ThAlert config.ThresholdCheck) (count int, total int, err error) {
	err, steps := CheckExpr(ThAlert.Expression, *responseCodeRegex)
	count = -1
	total = -1
	if err != nil {
		return -1, -1, err
	}
	if CheckVariable(ThAlert.Expression, 1) {
		requestsByStatus, total := groupBy(requests, ThAlert.Label)
		// Check the expression cases
		if len(steps) == 4 {
			// Case nnn < X
			num := 0
			firstCode := false
			// Check if case the code to compare is before operator or after
			if num, err = strconv.Atoi(steps[1]); err == nil {
				firstCode = true
			} else if num, err = strconv.Atoi(steps[3]); err != nil {
			} else if num, err = strconv.Atoi(steps[3]); err != nil {
				err = errors.New("Regular Expression not match with an integer")
				return -1, -1, err
			}
			count = 0
			for code, c := range requestsByStatus {
				if (firstCode && Compare(num, steps[2], code)) ||
					(!firstCode && Compare(code, steps[2], num)) {
					count += c
				}
			}
		} else if len(steps) == 6 {
			// Case nnn < X < yyy
			numA, errA := strconv.Atoi(steps[1])
			numB, errB := strconv.Atoi(steps[5])
			if errA == nil && errB == nil {
				count = 0
				for code, c := range requestsByStatus {
					if Compare(numA, steps[2], code) &&
						Compare(code, steps[4], numB) {
						count += c
					}
				}
			} else {
				err = errors.New("Regular Expression not match with an integer")
				return -1, -1, err
			}

		}
		return count, total, err
	}
	err = errors.New("No variable X in expression " + ThAlert.Expression)
	return -1, -1, err
}

/*
	Group requests by a specific metric.
	Return:
		- Map with key the possible values and Value the number of times that this value is in requests
*/
func groupBy(requests *model.Vector, label string) (map[int]int, int) {
	result := map[int]int{}
	for _, sample := range *requests {
		stcode, _ := strconv.Atoi(string(sample.Metric[model.LabelName(label)]))
		if _, ok := result[stcode]; ok {
			//do something here
			result[stcode] += 1
		} else {
			result[stcode] = 1
		}
	}
	return result, len(*requests)
}
