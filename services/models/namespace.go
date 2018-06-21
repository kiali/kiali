package models

import (
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"
)

// A Namespace is the main classification in kiali.
// It is used to describe a set of objects.
//
// swagger:parameters istioConfigList
type NamespaceParam struct {
	// The id of the namespace.
	//
	// in: path
	// required: true
	Name string `json:"namespace"`
}

// A Namespace is the main classification in kiali.
// It is used to describe a set of objects.
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

	services, err := istioClient.GetNamespaces()
	if err != nil {
		return nil, err
	}

	return CastNamespaceCollection(services), nil
}

func CastNamespaceCollection(nsl *v1.NamespaceList) []Namespace {
	namespaces := make([]Namespace, len(nsl.Items))
	for i, item := range nsl.Items {
		namespaces[i] = CastNamespace(item)
	}

	return namespaces
}

func CastNamespace(ns v1.Namespace) Namespace {
	namespace := Namespace{}
	namespace.Name = ns.Name

	return namespace
}
