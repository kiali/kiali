package handlers

import (
	"errors"
	"net/http"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/status"
	"github.com/kiali/kiali/util/httputil"
)

// Get JaegerInfo provides the Jaeger URL and other info, first by checking if a config exists
// then (if not) by inspecting the Kubernetes Jaeger service in Istio installation namespace
func GetJaegerInfo(w http.ResponseWriter, r *http.Request) {
	requestToken, err := getToken(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Token initialization error: "+err.Error())
		return
	}

	info, code, err := getJaegerInfo(requestToken)
	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	RespondWithJSON(w, code, info)
}

func getJaegerInfo(requestToken string) (*models.JaegerInfo, int, error) {
	jaegerConfig := config.Get().ExternalServices.Tracing

	if !jaegerConfig.Enabled {
		return nil, http.StatusNoContent, nil
	}

	apiURL := status.DiscoverJaeger()
	if apiURL == "" {
		return nil, http.StatusServiceUnavailable, errors.New("Jaeger URL is not set in Kiali configuration")
	}

	// Check if URL is valid
	_, err := validateURL(apiURL)
	if err != nil {
		return nil, http.StatusServiceUnavailable, errors.New("wrong format for Jaeger URL: " + err.Error())
	}

	// Be sure to copy config.Auth and not modify the existing
	auth := jaegerConfig.Auth
	if auth.UseKialiToken {
		auth.Token = requestToken
	}

	if ha, err := canAccessURL(apiURL, &auth); !ha {
		return nil, http.StatusServiceUnavailable, err
	}

	info := &models.JaegerInfo{
		URL: apiURL,
	}

	return info, http.StatusOK, nil
}

func canAccessURL(url string, auth *config.Auth) (bool, error) {
	_, code, err := httputil.HttpGet(url, auth, 1000*time.Millisecond)
	return code == 200, err
}
