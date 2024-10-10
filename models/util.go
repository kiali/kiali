package models

import (
	"time"
)

func formatTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}
