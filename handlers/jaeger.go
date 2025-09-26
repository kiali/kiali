package handlers

import (
	"encoding/json"
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
	traces, err := business.Jaeger.GetServiceTraces(r.Context(), namespace, service, q)
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
	traces, err := business.Jaeger.GetWorkloadTraces(r.Context(), namespace, workload, q)
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
	if trace == nil {
		// Trace not found
		RespondWithError(w, http.StatusNotFound, fmt.Sprintf("Trace %s not found", traceID))
		return
	}
	RespondWithJSON(w, http.StatusOK, trace)
}

// AppSpans is the API handler to fetch Jaeger spans of a specific app
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

	spans, err := business.Jaeger.GetAppSpans(namespace, app, q)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, spans)
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
	q, err := readQuery(r.URL.Query())
	if err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	spans, err := business.Jaeger.GetServiceSpans(r.Context(), namespace, service, q)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, spans)
}

// WorkloadSpans is the API handler to fetch Jaeger spans of a specific workload
func WorkloadSpans(w http.ResponseWriter, r *http.Request) {
	business, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
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

	spans, err := business.Jaeger.GetWorkloadSpans(r.Context(), namespace, workload, q)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, spans)
}

func readQuery(values url.Values) (models.TracingQuery, error) {
	q := models.TracingQuery{
		End:     time.Now(),
		Limit:   100,
		Tags:    make(map[string]string),
		Cluster: clusterNameFromQuery(values),
	}

	if v := values.Get("startMicros"); v != "" {
		if num, err := strconv.ParseInt(v, 10, 64); err == nil {
			q.Start = time.Unix(0, num*int64(time.Microsecond))
		} else {
			return models.TracingQuery{}, fmt.Errorf("Cannot parse parameter 'startMicros': %w", err)
		}
	}
	if v := values.Get("endMicros"); v != "" {
		if num, err := strconv.ParseInt(v, 10, 64); err == nil {
			q.End = time.Unix(0, num*int64(time.Microsecond))
		} else {
			return models.TracingQuery{}, fmt.Errorf("Cannot parse parameter 'endMicros': %w", err)
		}
	}
	if strLimit := values.Get("limit"); strLimit != "" {
		if num, err := strconv.Atoi(strLimit); err == nil {
			q.Limit = num
		} else {
			return models.TracingQuery{}, fmt.Errorf("Cannot parse parameter 'limit': %w", err)
		}
	}
	if rawTags := values.Get("tags"); rawTags != "" {
		var tags map[string]string
		err := json.Unmarshal([]byte(rawTags), &tags)
		if err != nil {
			return models.TracingQuery{}, fmt.Errorf("Cannot parse parameter 'tags': %w", err)
		}
		q.Tags = tags
	}
	if strMinD := values.Get("minDuration"); strMinD != "" {
		if num, err := strconv.Atoi(strMinD); err == nil {
			q.MinDuration = time.Duration(num) * time.Microsecond
		} else {
			return models.TracingQuery{}, fmt.Errorf("Cannot parse parameter 'minDuration': %w", err)
		}
	}

	for key, value := range config.Get().ExternalServices.Tracing.QueryScope {
		q.Tags[key] = value
	}

	return q, nil
}
