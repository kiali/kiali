package mcp

import (
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
			if parsed, err := time.Parse(time.RFC3339, value); err == nil {
				return parsed
			}
		}
	}
	return time.Time{}
}
