package handlers

import (
	"errors"
	"fmt"
	"net/http"

	"k8s.io/api/core/v1"

	"github.com/kiali/swscore/config"
	"github.com/kiali/swscore/log"
	"github.com/kiali/swscore/models"
)

type osRouteSupplier func(string, string) (string, error)
type serviceSupplier func(string, string) (*v1.ServiceSpec, error)

// GetGrafanaInfo provides the Grafana URL and other info, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Grafana service in namespace istio-system
func GetGrafanaInfo(w http.ResponseWriter, r *http.Request) {
	info, code, err := getGrafanaInfo(getOpenshiftRouteURL, getService)
	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	RespondWithJSON(w, code, info)
}

// getGrafanaInfo returns the Grafana URL and other info, the HTTP status code (int) and eventually an error
func getGrafanaInfo(osRouteSupplier osRouteSupplier, serviceSupplier serviceSupplier) (*models.GrafanaInfo, int, error) {
	suffix := config.Get().IstioIdentityDomain
	grafanaConfig := config.Get().Grafana
	if !grafanaConfig.DisplayLink {
		return nil, http.StatusNoContent, nil
	}
	grafanaInfo := models.GrafanaInfo{
		URL:              grafanaConfig.URL,
		VariablesSuffix:  suffix,
		Dashboard:        grafanaConfig.Dashboard,
		VarServiceSource: grafanaConfig.VarServiceSource,
		VarServiceDest:   grafanaConfig.VarServiceDest}
	if grafanaInfo.URL != "" {
		return &grafanaInfo, http.StatusOK, nil
	}

	url, err := osRouteSupplier(grafanaConfig.ServiceNamespace, grafanaConfig.Service)
	if err == nil {
		grafanaInfo.URL = url
		return &grafanaInfo, http.StatusOK, nil
	}
	// Else on error, silently continue. Might not be running on OpenShift.

	spec, err := serviceSupplier(grafanaConfig.ServiceNamespace, grafanaConfig.Service)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	if len(spec.ExternalIPs) == 0 {
		return nil, http.StatusNotFound, errors.New("Unable to find Grafana URL: no route defined. ExternalIPs not defined on service 'grafana'")
	}
	var port int32
	port = 80

	if len(spec.ExternalIPs) > 1 {
		log.Warning("Several IPs found for service 'grafana', only the first will be used")
	}
	if len(spec.Ports) > 0 {
		port = spec.Ports[0].Port
		if len(spec.Ports) > 1 {
			log.Warning("Several ports found for service 'grafana', only the first will be used")
		}
	}

	// detect https?
	grafanaInfo.URL = fmt.Sprintf("http://%s:%d", spec.ExternalIPs[0], port)
	return &grafanaInfo, http.StatusOK, nil
}
