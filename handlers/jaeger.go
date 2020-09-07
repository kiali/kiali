package handlers

import (
	"fmt"
	"net/http"
	"net/url"
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
			Enabled:              true,
			Integration:          jaegerConfig.InClusterURL != "",
			URL:                  jaegerConfig.URL,
			NamespaceSelector:    jaegerConfig.NamespaceSelector,
			WhiteListIstioSystem: jaegerConfig.WhiteListIstioSystem,
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

func AppTraces(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "AppTraces initialization error: "+err.Error())
		return
	}
	params := mux.Vars(r)
	namespace := params["namespace"]
	app := params["app"]
	q, err := readQuery(r.URL.Query())
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	traces, err := business.Jaeger.GetAppTraces(namespace, app, q)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, traces)
}

func ServiceTraces(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "ServiceTraces initialization error: "+err.Error())
		return
	}
	params := mux.Vars(r)
	namespace := params["namespace"]
	service := params["service"]
	q, err := readQuery(r.URL.Query())
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	traces, err := business.Jaeger.GetServiceTraces(namespace, service, q)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, traces)
}

func WorkloadTraces(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "WorkloadTraces initialization error: "+err.Error())
		return
	}
	params := mux.Vars(r)
	namespace := params["namespace"]
	workload := params["workload"]
	q, err := readQuery(r.URL.Query())
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	traces, err := business.Jaeger.GetWorkloadTraces(namespace, workload, q)
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
	app := params["app"]
	queryParams := r.URL.Query()
	durationInSeconds := queryParams.Get("duration")
	conv, err := strconv.ParseInt(durationInSeconds, 10, 64)
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, "Cannot parse parameter 'duration': "+err.Error())
		return
	}
	traces, err := business.Jaeger.GetErrorTraces(namespace, app, time.Second*time.Duration(conv))
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
	trace, err := business.Jaeger.GetJaegerTraceDetail(traceID)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	RespondWithJSON(w, http.StatusOK, trace)
}

// AppSpans is the API handler to fetch Jaeger spans of a specific service
func AppSpans(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	params := mux.Vars(r)
	namespace := params["namespace"]
	app := params["app"]
	q, err := readQuery(r.URL.Query())
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	spans, err := business.Jaeger.GetJaegerSpans(namespace, app, q)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, spans)
}

func readQuery(values url.Values) (models.TracingQuery, error) {
	startMicros := values.Get("startMicros")
	endMicros := values.Get("endMicros")
	tags := values.Get("tags")
	strLimit := values.Get("limit")
	limit := 100
	if strLimit != "" {
		var err error
		limit, err = strconv.Atoi(strLimit)
		if err != nil {
			return models.TracingQuery{}, fmt.Errorf("Cannot parse parameter 'limit': " + err.Error())
		}
	}
	minDuration := values.Get("minDuration")
	return models.TracingQuery{
		StartMicros: startMicros,
		EndMicros:   endMicros,
		Tags:        tags,
		Limit:       limit,
		MinDuration: minDuration,
	}, nil
}
