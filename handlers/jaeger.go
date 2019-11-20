package handlers

import (
	"errors"
	"github.com/gorilla/mux"
	"net/http"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
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

func GetJaegerServices(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	services, code, err := business.Jaeger.GetJaegerServices()
	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	RespondWithJSON(w, code, services)
}

func TraceServiceDetails(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	params := mux.Vars(r)
	namespace := params["namespace"]
	service := params["service"]
	traces, code, err := business.Jaeger.GetJaegerTraces(namespace, service, r.URL.RawQuery)
	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	RespondWithJSON(w, code, traces)

}

func TraceDetails(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}
	params := mux.Vars(r)
	traceID := params["traceID"]
	traces, code, err := business.Jaeger.GetJaegerTraceDetail(traceID)
	if err != nil {
		log.Error(err)
		RespondWithError(w, code, err.Error())
		return
	}
	RespondWithJSON(w, code, traces)

}

func getJaegerInfo(requestToken string) (*models.JaegerInfo, int, error) {
	jaegerConfig := config.Get().ExternalServices.Tracing

	if !jaegerConfig.Enabled {
		return nil, http.StatusNoContent, nil
	}

	externalUrl := jaegerConfig.URL
	if externalUrl == "" {
		return nil, http.StatusServiceUnavailable, errors.New("Jaeger URL is not set in Kiali configuration")
	}

	if jaegerConfig.InClusterURL == "" {
		return nil, http.StatusServiceUnavailable, errors.New("Jaeger URL in cluster is not set in Kiali configuration")
	}

	// Be sure to copy config.Auth and not modify the existing
	auth := jaegerConfig.Auth
	if auth.UseKialiToken {
		auth.Token = requestToken
	}

	if ha, err := canAccessURL(jaegerConfig.InClusterURL, &auth); !ha {
		return nil, http.StatusServiceUnavailable, errors.New("Kiali can't access to Jaeger " + err.Error())
	}

	info := &models.JaegerInfo{
		URL:               externalUrl,
		NamespaceSelector: jaegerConfig.NamespaceSelector,
	}

	return info, http.StatusOK, nil
}

func canAccessURL(url string, auth *config.Auth) (bool, error) {
	_, code, err := httputil.HttpGet(url, auth, 1000*time.Millisecond)
	return code == 200, err
}
