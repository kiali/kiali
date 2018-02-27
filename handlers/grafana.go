package handlers

import (
	"errors"
	"fmt"
	"net/http"

	"k8s.io/api/core/v1"

	"github.com/swift-sunshine/swscore/config"
	"github.com/swift-sunshine/swscore/kubernetes"
	"github.com/swift-sunshine/swscore/log"
	"github.com/swift-sunshine/swscore/models"
)

// GetGrafanaInfo provides the Grafana URL and other info, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Grafana service in namespace istio-system
func GetGrafanaInfo(w http.ResponseWriter, r *http.Request) {
	info, code, err := getGrafanaInfo(getGrafanaService)
	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	RespondWithJSON(w, code, info)
}

func getGrafanaService() (*v1.ServiceSpec, error) {
	client, err := kubernetes.NewClient()
	if err != nil {
		return nil, err
	}
	details, err := client.GetServiceDetails("istio-system", "grafana")
	if err != nil {
		return nil, err
	}
	return &details.Service.Spec, nil
}

// getGrafanaInfo returns the Grafana URL and other info, the HTTP status code (int) and eventually an error
func getGrafanaInfo(serviceSupplier func() (*v1.ServiceSpec, error)) (*models.GrafanaInfo, int, error) {
	suffix := config.Get().IstioIdentityDomain
	configURL := config.Get().GrafanaServiceURL
	if configURL != "" {
		return &models.GrafanaInfo{
			URL:             configURL,
			VariablesSuffix: suffix}, http.StatusOK, nil
	}

	spec, err := serviceSupplier()
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	if spec.ClusterIP == "" || spec.ClusterIP == "None" {
		return nil, http.StatusNotFound, errors.New("Unable to find Grafana URL: clusterIP not defined on service 'grafana'")
	}
	if len(spec.Ports) == 0 || spec.Ports[0].Port == 0 {
		return nil, http.StatusNotFound, errors.New("Unable to find Grafana URL: no port defined on service 'grafana'")
	}

	if len(spec.Ports) > 1 {
		log.Warning("Several ports found for service 'grafana', only the first will be used")
	}

	// detect https?
	url := fmt.Sprintf("http://%s:%d", spec.ClusterIP, spec.Ports[0].Port)
	return &models.GrafanaInfo{
		URL:             url,
		VariablesSuffix: suffix}, http.StatusOK, nil
}
