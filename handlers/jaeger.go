package handlers

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

// Get JaegerInfo provides the Jaeger URL and other info
func GetJaegerInfo(w http.ResponseWriter, r *http.Request) {
	jaegerConfig := config.Get().ExternalServices.Tracing
	info := &models.JaegerInfo{
		Enabled:           jaegerConfig.Enabled,
		URL:               jaegerConfig.URL,
		NamespaceSelector: jaegerConfig.NamespaceSelector,
	}
	RespondWithJSON(w, http.StatusOK, info)
}

func TraceServiceDetails(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Trace Service Details initialization error: "+err.Error())
		return
	}
	params := mux.Vars(r)
	namespace := params["namespace"]
	service := params["service"]
	traces, err := business.Jaeger.GetJaegerTraces(namespace, service, r.URL.RawQuery)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, traces)
}

func TraceDetails(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Trace Detail initialization error: "+err.Error())
		return
	}
	params := mux.Vars(r)
	traceID := params["traceID"]
	traces, err := business.Jaeger.GetJaegerTraceDetail(traceID)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, traces)
}

// ServiceSpans is the API handler to fetch Jaeger spans of a specific service
func ServiceSpans(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	params := mux.Vars(r)
	namespace := params["namespace"]
	service := params["service"]
	queryParams := r.URL.Query()
	startMicros := queryParams.Get("startMicros")
	endMicros := queryParams.Get("endMicros")

	spans, err := business.Jaeger.GetJaegerSpans(namespace, service, startMicros, endMicros)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, spans)
}
