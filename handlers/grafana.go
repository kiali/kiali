package handlers

import (
	"errors"
	"fmt"
	"net/http"

	"k8s.io/api/core/v1"

	"github.com/swift-sunshine/swscore/config"
	"github.com/swift-sunshine/swscore/kubernetes"
	"github.com/swift-sunshine/swscore/log"
)

// GetGrafanaURL provides the Grafana URL, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Grafana service in namespace istio-system
func GetGrafanaURL(w http.ResponseWriter, r *http.Request) {
	url, code, err := getGrafanaURL(getGrafanaService)
	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	RespondWithJSON(w, code, url)
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

// getGrafanaURL returns the URL (string), the HTTP status code (int) and eventually an error
func getGrafanaURL(serviceSupplier func() (*v1.ServiceSpec, error)) (string, int, error) {
	configURL := config.Get().GrafanaServiceURL
	if configURL != "" {
		return configURL, http.StatusOK, nil
	}

	spec, err := serviceSupplier()
	if err != nil {
		return "", http.StatusInternalServerError, err
	}

	if spec.ClusterIP == "" || spec.ClusterIP == "None" {
		return "", http.StatusNotFound, errors.New("Unable to find Grafana URL: clusterIP not defined on service 'grafana'")
	}
	if len(spec.Ports) == 0 || spec.Ports[0].Port == 0 {
		return "", http.StatusNotFound, errors.New("Unable to find Grafana URL: no port defined on service 'grafana'")
	}

	if len(spec.Ports) > 1 {
		log.Warning("Several ports found for service 'grafana', only the first will be used")
	}

	// detect https?
	url := fmt.Sprintf("http://%s:%d", spec.ClusterIP, spec.Ports[0].Port)
	return url, http.StatusOK, nil
}
