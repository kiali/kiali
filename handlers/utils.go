package handlers

import (
	"net/url"

	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/kubernetes"
)

func getService(namespace string, service string) (*v1.ServiceSpec, error) {
	client, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}
	svc, err := client.GetService(namespace, service)
	if err != nil {
		return nil, err
	}
	return &svc.Spec, nil
}

func validateURL(serviceURL string) (*url.URL, error) {
	return url.ParseRequestURI(serviceURL)
}
