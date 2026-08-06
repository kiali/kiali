package queryparams

import (
	"fmt"
	"net/url"
	"strconv"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/util"
)

// ParamKind identifies how a query parameter is parsed and validated.
type ParamKind int

const (
	KindString ParamKind = iota
	KindBool
	KindTimestamp
	KindPromDuration
	KindCluster
	KindEnum
	// KindPresence accepts the parameter without typed parsing (used for allowlist-only keys
	// whose values are interpreted by specialized extractors).
	KindPresence
)

// Param declares a supported query parameter for an endpoint.
type Param struct {
	Name         string
	Kind         ParamKind
	DefaultBool  bool
	DefaultStr   string
	EnumValues   []string
	Required     bool
	DefaultTime  bool // when true and value empty, Timestamp defaults to util.Clock.Now()
	DefaultEmpty bool // when true, empty PromDuration uses DefaultStr
}

// StringParam accepts any string value (empty uses defaultValue).
func StringParam(name, defaultValue string) Param {
	return Param{Name: name, Kind: KindString, DefaultStr: defaultValue}
}

// BoolParam parses a boolean with the given default when absent.
func BoolParam(name string, defaultValue bool) Param {
	return Param{Name: name, Kind: KindBool, DefaultBool: defaultValue}
}

// TimestampParam parses a Unix timestamp; when absent, defaults to now.
func TimestampParam(name string) Param {
	return Param{Name: name, Kind: KindTimestamp, DefaultTime: true}
}

// PromDurationParam validates a Prometheus duration; when absent, uses defaultValue.
func PromDurationParam(name, defaultValue string) Param {
	return Param{Name: name, Kind: KindPromDuration, DefaultStr: defaultValue, DefaultEmpty: true}
}

// ClusterParam declares the clusterName query parameter.
func ClusterParam() Param {
	return Param{Name: "clusterName", Kind: KindCluster}
}

// EnumParam restricts a parameter to one of allowed values (empty is allowed unless Required).
func EnumParam(name string, allowed ...string) Param {
	return Param{Name: name, Kind: KindEnum, EnumValues: allowed}
}

// PresenceParam allows a query key without typed parsing (value handled elsewhere).
func PresenceParam(name string) Param {
	return Param{Name: name, Kind: KindPresence}
}

// Names returns the query parameter names declared by the schema (for RejectUnknown).
func Names(params []Param) []string {
	names := make([]string, 0, len(params))
	for _, p := range params {
		names = append(names, p.Name)
	}
	return names
}

// Result holds parsed query parameter values from ParseWithConfig.
type Result struct {
	bools      map[string]bool
	strings    map[string]string
	times      map[string]time.Time
	raw        url.Values
	cluster    string
	hasCluster bool
}

// Bool returns a parsed boolean parameter.
func (r Result) Bool(name string) bool {
	return r.bools[name]
}

// String returns a parsed string parameter (or empty).
func (r Result) String(name string) string {
	if v, ok := r.strings[name]; ok {
		return v
	}
	return r.raw.Get(name)
}

// Time returns a parsed timestamp parameter.
func (r Result) Time(name string) time.Time {
	return r.times[name]
}

// Duration returns a Prometheus duration string parameter.
func (r Result) Duration(name string) string {
	return r.String(name)
}

// Cluster returns the resolved cluster name (from ClusterParam).
func (r Result) Cluster() string {
	return r.cluster
}

// ParseWithConfig rejects unknown parameters and parses declared params.
func ParseWithConfig(query url.Values, conf *config.Config, params []Param) (Result, error) {
	if err := RejectUnknown(query, Names(params)...); err != nil {
		return Result{}, err
	}

	result := Result{
		bools:   make(map[string]bool),
		strings: make(map[string]string),
		times:   make(map[string]time.Time),
		raw:     query,
	}

	for _, p := range params {
		value := query.Get(p.Name)
		switch p.Kind {
		case KindString, KindPresence:
			if value == "" {
				result.strings[p.Name] = p.DefaultStr
			} else {
				result.strings[p.Name] = value
			}
		case KindBool:
			parsed, err := ParseBoolParam(value, p.Name, p.DefaultBool)
			if err != nil {
				return Result{}, err
			}
			result.bools[p.Name] = parsed
		case KindTimestamp:
			if value == "" {
				if p.DefaultTime {
					result.times[p.Name] = util.Clock.Now()
				}
				continue
			}
			parsed, err := ParseQueryTime(value)
			if err != nil {
				return Result{}, err
			}
			result.times[p.Name] = parsed
		case KindPromDuration:
			if value == "" {
				if p.DefaultEmpty {
					result.strings[p.Name] = p.DefaultStr
				}
				continue
			}
			if err := ValidatePromDuration(value, p.Name); err != nil {
				return Result{}, err
			}
			result.strings[p.Name] = value
		case KindCluster:
			result.cluster = ClusterName(conf, query)
			result.hasCluster = true
		case KindEnum:
			if p.Required && value == "" {
				return Result{}, fmt.Errorf("query parameter '%s' is required", p.Name)
			}
			if err := ValidateEnum(value, p.Name, p.EnumValues...); err != nil {
				return Result{}, err
			}
			result.strings[p.Name] = value
		default:
			return Result{}, fmt.Errorf("unsupported param kind for '%s'", p.Name)
		}
	}

	// Ensure cluster always has a value when ClusterParam is in the schema.
	if result.hasCluster && result.cluster == "" && conf != nil {
		result.cluster = conf.KubernetesConfig.ClusterName
	}

	return result, nil
}

// ParseIntParam parses an integer query value.
func ParseIntParam(value, paramName string) (int, error) {
	num, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("cannot parse parameter '%s': %s", paramName, err.Error())
	}
	return num, nil
}
