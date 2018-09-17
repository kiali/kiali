package models

import (
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"
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
}

func GetNamespaces() ([]Namespace, error) {
	istioClient, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}

	namespaces, err := istioClient.GetNamespaces()
	if err != nil {
		return nil, err
	}

	return CastNamespaceCollection(namespaces), nil
}

func CastNamespaceCollection(ns []v1.Namespace) []Namespace {
	namespaces := make([]Namespace, len(ns))
	for i, item := range ns {
		namespaces[i] = CastNamespace(item)
	}

	return namespaces
}

func CastNamespace(ns v1.Namespace) Namespace {
	namespace := Namespace{}
	namespace.Name = ns.Name

	return namespace
}
