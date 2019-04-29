package models

import (
	"time"

	osproject_v1 "github.com/openshift/api/project/v1"
	core_v1 "k8s.io/api/core/v1"
)

// A Namespace provide a scope for names
// This type is used to describe a set of objects.
//
// swagger:model namespace
type Namespace struct {
	// The id of the namespace.
	//
	// example:  istio-system
	// required: true
	Name string `json:"name"`

	// Creation date of the namespace.
	// There is no need to export this through the API. So, this is
	// set to be ignored by JSON package.
	//
	// required: true
	CreationTimestamp time.Time `json:"-"`
}

func CastNamespaceCollection(ns []core_v1.Namespace) []Namespace {
	namespaces := make([]Namespace, len(ns))
	for i, item := range ns {
		namespaces[i] = CastNamespace(item)
	}

	return namespaces
}

func CastNamespace(ns core_v1.Namespace) Namespace {
	namespace := Namespace{}
	namespace.Name = ns.Name
	namespace.CreationTimestamp = ns.CreationTimestamp.Time

	return namespace
}

func CastProjectCollection(ps []osproject_v1.Project) []Namespace {
	namespaces := make([]Namespace, len(ps))
	for i, project := range ps {
		namespaces[i] = CastProject(project)
	}

	return namespaces
}

func CastProject(p osproject_v1.Project) Namespace {
	namespace := Namespace{}
	namespace.Name = p.Name
	namespace.CreationTimestamp = p.CreationTimestamp.Time

	return namespace
}
