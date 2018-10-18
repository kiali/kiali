package handlers

import (
	"net/http"
	"net/url"

	"k8s.io/api/core/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
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

func checkNamespaceAccess(w http.ResponseWriter, k8s kubernetes.IstioClientInterface, prom prometheus.ClientInterface, namespace string) *models.Namespace {
	layer := business.NewWithBackends(k8s, prom)

	if nsInfo, err := layer.Namespace.GetNamespace(namespace); err != nil {
		RespondWithError(w, http.StatusForbidden, "Cannot access namespace data: "+err.Error())
		return nil
	} else {
		return nsInfo
	}
}
