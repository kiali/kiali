package mcputil

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func GetStringArg(args map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := args[key].(string); ok {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func GetTimeArg(args map[string]interface{}, keys ...string) time.Time {
	for _, key := range keys {
		switch value := args[key].(type) {
		case time.Time:
			return value
		case string:
			if value == "" {
				continue
			}
			// Accept both RFC3339 and RFC3339Nano
			if parsed, err := time.Parse(time.RFC3339Nano, value); err == nil {
				return parsed
			}
			if parsed, err := time.Parse(time.RFC3339, value); err == nil {
				return parsed
			}
		}
	}
	return time.Time{}
}

func AsString(v interface{}) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case []byte:
		return string(t)
	case fmt.Stringer:
		return t.String()
	case float64:
		// Common for JSON numbers.
		return strconv.FormatFloat(t, 'f', -1, 64)
	case int:
		return strconv.Itoa(t)
	case int64:
		return strconv.FormatInt(t, 10)
	case uint64:
		return strconv.FormatUint(t, 10)
	case bool:
		if t {
			return "true"
		}
		return "false"
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", t))
	}
}

func AsBool(v interface{}) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		b, err := strconv.ParseBool(strings.TrimSpace(t))
		return err == nil && b
	default:
		return false
	}
}

func AsInt(v interface{}) int {
	switch t := v.(type) {
	case int:
		return t
	case int64:
		return int(t)
	case float64:
		return int(t)
	case string:
		i, err := strconv.Atoi(strings.TrimSpace(t))
		if err == nil {
			return i
		}
		return 0
	default:
		return 0
	}
}
