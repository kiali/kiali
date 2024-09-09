package models

import (
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

func formatTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

func GVKToQueryString(gvk schema.GroupVersionKind) string {
	return fmt.Sprintf("%s.%s.%s", gvk.Group, gvk.Version, gvk.Kind)
}
