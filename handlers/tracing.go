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

// Get TracingInfo provides the Tracing URL and other info
func GetTracingInfo(w http.ResponseWriter, r *http.Request) {
	tracingConfig := config.Get().ExternalServices.Tracing
	var info models.TracingInfo

	if tracingConfig.Enabled {
		info = models.TracingInfo{
			Enabled:              true,
			Integration:          tracingConfig.InClusterURL != "",
			Provider:             string(tracingConfig.Provider),
			TempoConfig:          tracingConfig.TempoConfig,
			URL:                  tracingConfig.URL,
			NamespaceSelector:    tracingConfig.NamespaceSelector,
			WhiteListIstioSystem: tracingConfig.WhiteListIstioSystem,
		}
	} else {
		// 0-values would work, but let's be explicit
		info = models.TracingInfo{
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
	traces, err := business.Tracing.GetAppTraces(namespace, app, q)
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
	traces, err := business.Tracing.GetServiceTraces(r.Context(), namespace, service, q)
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
	traces, err := business.Tracing.GetWorkloadTraces(r.Context(), namespace, workload, q)
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
	traces, err := business.Tracing.GetErrorTraces(namespace, app, time.Second*time.Duration(conv))
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
	trace, err := business.Tracing.GetTraceDetail(traceID)
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

// AppSpans is the API handler to fetch Tracing spans of a specific app
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

	spans, err := business.Tracing.GetAppSpans(namespace, app, q)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, spans)
}

// ServiceSpans is the API handler to fetch Tracing spans of a specific service
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

	spans, err := business.Tracing.GetServiceSpans(r.Context(), namespace, service, q)
	if err != nil {
		RespondWithError(w, http.StatusServiceUnavailable, err.Error())
		return
	}

	RespondWithJSON(w, http.StatusOK, spans)
}

// WorkloadSpans is the API handler to fetch Tracing spans of a specific workload
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

	spans, err := business.Tracing.GetWorkloadSpans(r.Context(), namespace, workload, q)
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
			return models.TracingQuery{}, fmt.Errorf("Cannot parse parameter 'startMicros': " + err.Error())
		}
	}
	if v := values.Get("endMicros"); v != "" {
		if num, err := strconv.ParseInt(v, 10, 64); err == nil {
			q.End = time.Unix(0, num*int64(time.Microsecond))
		} else {
			return models.TracingQuery{}, fmt.Errorf("Cannot parse parameter 'endMicros': " + err.Error())
		}
	}
	if strLimit := values.Get("limit"); strLimit != "" {
		if num, err := strconv.Atoi(strLimit); err == nil {
			q.Limit = num
		} else {
			return models.TracingQuery{}, fmt.Errorf("Cannot parse parameter 'limit': " + err.Error())
		}
	}
	if rawTags := values.Get("tags"); rawTags != "" {
		var tags map[string]string
		err := json.Unmarshal([]byte(rawTags), &tags)
		if err != nil {
			return models.TracingQuery{}, fmt.Errorf("Cannot parse parameter 'tags': " + err.Error())
		}
		q.Tags = tags
	}
	if strMinD := values.Get("minDuration"); strMinD != "" {
		if num, err := strconv.Atoi(strMinD); err == nil {
			q.MinDuration = time.Duration(num) * time.Microsecond
		} else {
			return models.TracingQuery{}, fmt.Errorf("Cannot parse parameter 'minDuration': " + err.Error())
		}
	}

	for key, value := range config.Get().ExternalServices.Tracing.QueryScope {
		q.Tags[key] = value
	}

	// 'cluster' in tags is used to query in tracing by cluster in multi-cluster mode
	// while 'Cluster' in models.TracingQuery can have default cluster
	if values.Get("clusterName") != "" {
		q.Tags["istio.cluster_id"] = values.Get("clusterName")
	}

	return q, nil
}
