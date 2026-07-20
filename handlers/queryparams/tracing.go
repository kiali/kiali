package queryparams

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

var tracingQueryParams = []string{
	"clusterName",
	"endMicros",
	"limit",
	"minDuration",
	"startMicros",
	"tags",
}

var errorTracesQueryParams = []string{
	"clusterName",
	"duration",
}

// ParseTracingQuery validates and parses tracing list/spans query parameters.
func ParseTracingQuery(conf *config.Config, values url.Values) (models.TracingQuery, error) {
	if err := RejectUnknown(values, tracingQueryParams...); err != nil {
		return models.TracingQuery{}, err
	}

	q := models.TracingQuery{
		End:     time.Now(),
		Limit:   100,
		Tags:    make(map[string]string),
		Cluster: ClusterName(conf, values),
	}

	if v := values.Get("startMicros"); v != "" {
		num, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return models.TracingQuery{}, fmt.Errorf("cannot parse parameter 'startMicros': %s", err.Error())
		}
		q.Start = time.Unix(0, num*int64(time.Microsecond))
	}
	if v := values.Get("endMicros"); v != "" {
		num, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return models.TracingQuery{}, fmt.Errorf("cannot parse parameter 'endMicros': %s", err.Error())
		}
		q.End = time.Unix(0, num*int64(time.Microsecond))
	}
	if strLimit := values.Get("limit"); strLimit != "" {
		num, err := strconv.Atoi(strLimit)
		if err != nil {
			return models.TracingQuery{}, fmt.Errorf("cannot parse parameter 'limit': %s", err.Error())
		}
		if num <= 0 {
			return models.TracingQuery{}, fmt.Errorf("parameter 'limit' must be positive")
		}
		if num > models.MaxTracingLimit {
			num = models.MaxTracingLimit
		}
		q.Limit = num
	}
	if rawTags := values.Get("tags"); rawTags != "" {
		var tags map[string]string
		if err := json.Unmarshal([]byte(rawTags), &tags); err != nil {
			return models.TracingQuery{}, fmt.Errorf("cannot parse parameter 'tags': %s", err.Error())
		}
		q.Tags = tags
	}
	if strMinD := values.Get("minDuration"); strMinD != "" {
		num, err := strconv.Atoi(strMinD)
		if err != nil {
			return models.TracingQuery{}, fmt.Errorf("cannot parse parameter 'minDuration': %s", err.Error())
		}
		q.MinDuration = time.Duration(num) * time.Microsecond
	}

	for key, value := range config.Get().ExternalServices.Tracing.QueryScope {
		q.Tags[key] = value
	}

	if values.Get("clusterName") != "" {
		q.Tags[models.IstioClusterTag] = values.Get("clusterName")
	} else {
		q.Tags[models.IstioClusterTag] = q.Cluster
	}

	return q, nil
}

// ParseErrorTracesDuration validates error-traces query parameters and returns the duration.
func ParseErrorTracesDuration(conf *config.Config, values url.Values) (time.Duration, string, error) {
	if err := RejectUnknown(values, errorTracesQueryParams...); err != nil {
		return 0, "", err
	}

	durationInSeconds := values.Get("duration")
	conv, err := strconv.ParseInt(durationInSeconds, 10, 64)
	if err != nil {
		return 0, "", fmt.Errorf("cannot parse parameter 'duration': %s", err.Error())
	}

	return time.Second * time.Duration(conv), ClusterName(conf, values), nil
}
