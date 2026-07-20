package queryparams

import (
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"time"

	"github.com/kiali/kiali/config"
)

// ErrorStatusCode is the HTTP status returned for invalid or unsupported query parameters.
const ErrorStatusCode = http.StatusConflict

// validPromDurationRe matches a valid Prometheus duration string (e.g. "5m", "30s", "1h").
var validPromDurationRe = regexp.MustCompile(`^[0-9]+(ms|s|m|h|d|w|y)$`)

// RejectUnknown returns an error when query contains parameters not in the allowed list.
func RejectUnknown(query url.Values, allowed ...string) error {
	if len(query) == 0 {
		return nil
	}
	allowedSet := make(map[string]struct{}, len(allowed))
	for _, name := range allowed {
		allowedSet[name] = struct{}{}
	}
	for key := range query {
		if _, ok := allowedSet[key]; !ok {
			return fmt.Errorf("unsupported query parameter '%s'", key)
		}
	}
	return nil
}

// ClusterName extracts the cluster name from query parameters, defaulting to the configured cluster.
func ClusterName(conf *config.Config, query url.Values) string {
	cluster := query.Get("clusterName")
	if cluster == "" {
		cluster = conf.KubernetesConfig.ClusterName
	}
	return cluster
}

// ParseQueryTime parses a Unix timestamp query parameter value.
func ParseQueryTime(value string) (time.Time, error) {
	unix, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return time.Time{}, fmt.Errorf("cannot parse query parameter 'queryTime'")
	}
	return time.Unix(unix, 0), nil
}

// ParseBoolParam parses a boolean query parameter, returning defaultValue when value is empty.
func ParseBoolParam(value, paramName string, defaultValue bool) (bool, error) {
	if value == "" {
		return defaultValue, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("cannot parse query parameter '%s'", paramName)
	}
	return parsed, nil
}

// ValidateEnum returns an error when value is non-empty and not in allowed.
func ValidateEnum(value, paramName string, allowed ...string) error {
	if value == "" {
		return nil
	}
	for _, candidate := range allowed {
		if value == candidate {
			return nil
		}
	}
	return fmt.Errorf("query parameter '%s' must be one of %v", paramName, allowed)
}

// ValidatePromDuration returns an error when value is non-empty and not a valid Prometheus duration.
func ValidatePromDuration(value, paramName string) error {
	if value == "" {
		return nil
	}
	if !validPromDurationRe.MatchString(value) {
		return fmt.Errorf("invalid '%s' value: %q", paramName, value)
	}
	return nil
}
