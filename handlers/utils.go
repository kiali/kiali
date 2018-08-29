package handlers

import (
	"net/url"

	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"
)

func getOpenshiftRouteURL(namespace string, name string) (string, error) {
	client, err := kubernetes.NewOSRouteClient()
	if err != nil {
		return "", err
	}
	return client.GetRoute(namespace, name)
}

func getService(namespace string, service string) (*v1.ServiceSpec, error) {
	client, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}
	details, err := client.GetServiceDetails(namespace, service)
	if err != nil {
		return nil, err
	}
	return &details.Service.Spec, nil
}

func validateURL(serviceURL string) (*url.URL, error) {
	return url.ParseRequestURI(serviceURL)
}
