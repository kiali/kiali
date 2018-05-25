package models

import (
	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"

	osv1 "github.com/openshift/api/project/v1"
)

type Namespace struct {
	Name string `json:"name"`
}

func GetNamespaces() ([]Namespace, error) {
	istioClient, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}

	// First try and see if we are running on OpenShift of Kubernetes with the kube-project component.
	// This will allow us to fetch the namespaces that only our serviceaccount has permission to access.
	//
	// If we encounter an error here, we are assuming its because the project.openshift.io component is unknown
	// and it means we are running in k8s without kube-projet. In that case, get the namespace list from Kubernetes
	// (which requires a higher permission level)
	projects, err := istioClient.GetProjects()
	if err == nil {
		// Everything is good, return the projects we got from OpenShift / kube-project
		return CastProjectCollection(projects), nil
	}

	// We encountered an error, try getting the namespaces list directly from K8S
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

func CastProjectCollection(pl *osv1.ProjectList) []Namespace {
	namespaces := make([]Namespace, len(pl.Items))
	for i, item := range pl.Items {
		namespaces[i] = CastProject(item)
	}

	return namespaces
}
func CastProject(p osv1.Project) Namespace {
	namespace := Namespace{}
	namespace.Name = p.Name

	return namespace
}
