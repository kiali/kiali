package models

import (
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
)

// This is only here instead of kubernetes/filters.go because of circular imports.
// Until the circular imports are resolved, this can't go into kubernetes/filters.go.

// FilterByNamespaceNames filters a list of runtime.Objects by the provided namespace names.
// If the object's namespace is not in the provided list of namespaces, the object
// is filtered out.
func FilterByNamespaces[T runtime.Object](objects []T, namespaces []Namespace) []T {
	namespaceSet := make(map[string]bool)
	for _, ns := range namespaces {
		namespaceSet[ns.Name] = true
	}

	filtered := []T{}
	for _, obj := range objects {
		o, err := meta.Accessor(obj)
		// This shouldn't happen since we are using runtime.Object for T
		// and all the API objects should implement meta.Object.
		if err != nil {
			return filtered
		}

		if _, ok := namespaceSet[o.GetNamespace()]; ok {
			filtered = append(filtered, obj)
		}
	}
	return filtered
}
