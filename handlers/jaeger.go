package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
)

// Get JaegerInfo provides the Jaeger URL and other info
func GetJaegerInfo(w http.ResponseWriter, r *http.Request) {
	jaegerConfig := config.Get().ExternalServices.Tracing
	var info models.JaegerInfo
	if jaegerConfig.Enabled {
		info = models.JaegerInfo{
			Enabled:           true,
			Integration:       jaegerConfig.InClusterURL != "",
			URL:               jaegerConfig.URL,
			NamespaceSelector: jaegerConfig.NamespaceSelector,
		}
	} else {
		// 0-values would work, but let's be explicit
		info = models.JaegerInfo{
			Enabled:     false,
			Integration: false,
			URL:         "",
		}
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

func ErrorTraces(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Error Traces initialization error: "+err.Error())
		return
	}
	params := mux.Vars(r)
	namespace := params["namespace"]
	service := params["service"]
	queryParams := r.URL.Query()
	durationInSeconds := queryParams.Get("duration")
	conv, err := strconv.ParseInt(durationInSeconds, 10, 64)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Cannot parse parameter 'duration': "+err.Error())
		return
	}
	traces, err := business.Jaeger.GetErrorTraces(namespace, service, time.Second*time.Duration(conv))
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
