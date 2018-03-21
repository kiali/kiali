package models

import (
	"github.com/kiali/swscore/kubernetes"
	"k8s.io/api/core/v1"
)

type Namespace struct {
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
