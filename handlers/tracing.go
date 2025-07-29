package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

// Get TracingInfo provides the Tracing URL and other info
func GetTracingInfo(conf *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tracingConfig := conf.ExternalServices.Tracing
		var info models.TracingInfo

		if tracingConfig.Enabled {
			info = models.TracingInfo{
				Enabled:              true,
				Integration:          tracingConfig.InternalURL != "",
				Provider:             string(tracingConfig.Provider),
				TempoConfig:          tracingConfig.TempoConfig,
				URL:                  tracingConfig.ExternalURL,
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
}

func AppTraces(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		params := mux.Vars(r)
		namespace := params["namespace"]
		app := params["app"]

		q, err := readQuery(conf, r.URL.Query())
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}
		cluster := clusterNameFromQuery(conf, r.URL.Query())
		tracingName := business.App.GetAppTracingName(r.Context(), cluster, namespace, app)
		traces, err := business.Tracing.GetAppTraces(r.Context(), namespace, tracingName.Lookup, app, q)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		RespondWithJSON(w, http.StatusOK, traces)
	}
}

func ServiceTraces(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}
		params := mux.Vars(r)
		namespace := params["namespace"]
		service := params["service"]
		q, err := readQuery(conf, r.URL.Query())
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
}

func WorkloadTraces(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		params := mux.Vars(r)
		namespace := params["namespace"]
		workload := params["workload"]
		q, err := readQuery(conf, r.URL.Query())
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
}

func ErrorTraces(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}
		params := mux.Vars(r)
		namespace := params["namespace"]
		app := params["app"]
		queryParams := r.URL.Query()
		durationInSeconds := queryParams.Get("duration")
		conv, err := strconv.ParseInt(durationInSeconds, 10, 64)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "cannot parse parameter 'duration': "+err.Error())
			return
		}
		traces, err := business.Tracing.GetErrorTraces(r.Context(), namespace, app, time.Second*time.Duration(conv))
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}
		RespondWithJSON(w, http.StatusOK, traces)
	}
}

func TraceDetails(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}
		params := mux.Vars(r)
		traceID := params["traceID"]
		trace, err := business.Tracing.GetTraceDetail(r.Context(), traceID)
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
}

// AppSpans is the API handler to fetch Tracing spans of a specific app
func AppSpans(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		params := mux.Vars(r)
		namespace := params["namespace"]
		app := params["app"]
		q, err := readQuery(conf, r.URL.Query())
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, err.Error())
			return
		}
		cluster := clusterNameFromQuery(conf, r.URL.Query())
		spans, err := business.Tracing.GetAppSpans(r.Context(), cluster, namespace, app, q)
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		RespondWithJSON(w, http.StatusOK, spans)
	}
}

// ServiceSpans is the API handler to fetch Tracing spans of a specific service
func ServiceSpans(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		params := mux.Vars(r)
		namespace := params["namespace"]
		service := params["service"]
		q, err := readQuery(conf, r.URL.Query())
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
}

// WorkloadSpans is the API handler to fetch Tracing spans of a specific workload
func WorkloadSpans(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		params := mux.Vars(r)
		namespace := params["namespace"]
		workload := params["workload"]
		q, err := readQuery(conf, r.URL.Query())
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
}

func readQuery(conf *config.Config, values url.Values) (models.TracingQuery, error) {
	q := models.TracingQuery{
		End:     time.Now(),
		Limit:   100,
		Tags:    make(map[string]string),
		Cluster: clusterNameFromQuery(conf, values),
	}

	if v := values.Get("startMicros"); v != "" {
		if num, err := strconv.ParseInt(v, 10, 64); err == nil {
			q.Start = time.Unix(0, num*int64(time.Microsecond))
		} else {
			return models.TracingQuery{}, fmt.Errorf("cannot parse parameter 'startMicros': %s", err.Error())
		}
	}
	if v := values.Get("endMicros"); v != "" {
		if num, err := strconv.ParseInt(v, 10, 64); err == nil {
			q.End = time.Unix(0, num*int64(time.Microsecond))
		} else {
			return models.TracingQuery{}, fmt.Errorf("cannot parse parameter 'endMicros': %s", err.Error())
		}
	}
	if strLimit := values.Get("limit"); strLimit != "" {
		if num, err := strconv.Atoi(strLimit); err == nil {
			q.Limit = num
		} else {
			return models.TracingQuery{}, fmt.Errorf("cannot parse parameter 'limit': %s", err.Error())
		}
	}
	if rawTags := values.Get("tags"); rawTags != "" {
		var tags map[string]string
		err := json.Unmarshal([]byte(rawTags), &tags)
		if err != nil {
			return models.TracingQuery{}, fmt.Errorf("cannot parse parameter 'tags': %s", err.Error())
		}
		q.Tags = tags
	}
	if strMinD := values.Get("minDuration"); strMinD != "" {
		if num, err := strconv.Atoi(strMinD); err == nil {
			q.MinDuration = time.Duration(num) * time.Microsecond
		} else {
			return models.TracingQuery{}, fmt.Errorf("cannot parse parameter 'minDuration': %s", err.Error())
		}
	}

	for key, value := range config.Get().ExternalServices.Tracing.QueryScope {
		q.Tags[key] = value
	}

	// 'cluster' in tags is used to query in tracing by cluster in multi-cluster
	// while 'Cluster' in models.TracingQuery can have default cluster
	if values.Get("clusterName") != "" {
		q.Tags[models.IstioClusterTag] = values.Get("clusterName")
	} else {
		q.Tags[models.IstioClusterTag] = q.Cluster
	}

	return q, nil
}

// TracingDiagnose is the API handler to diagnose Tracing configuration
func TracingDiagnose(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization getLayer error: "+err.Error())
			return
		}

		if !business.Namespace.HasMeshAccess(r.Context(), clientFactory.GetSAHomeClusterClient().ClusterInfo().Name) {
			RespondWithError(w, http.StatusInternalServerError, "Unauthorized")
			return
		}

		status, err := business.Tracing.TracingDiagnose(r.Context(), clientFactory.GetSAHomeClusterClient().GetToken())
		if err != nil {
			RespondWithError(w, http.StatusServiceUnavailable, err.Error())
			return
		}

		RespondWithJSON(w, http.StatusOK, status)
	}
}

// TracingConfigurationCheck is the API handler to test a Tracing configuration
func TracingConfigurationCheck(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	prom prometheus.ClientInterface,
	cpm business.ControlPlaneMonitor,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery *istio.Discovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Update request with bad update patch: "+err.Error())
		}
		testConfig := string(body)
		var tracingConfig config.TracingConfig
		err = json.Unmarshal([]byte(testConfig), &tracingConfig)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Tracing configuration is not valid: "+err.Error())
			return
		}

		business, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
			return
		}

		status := business.Tracing.ValidateConfiguration(r.Context(), conf, &tracingConfig, clientFactory.GetSAHomeClusterClient().GetToken())
		RespondWithJSON(w, http.StatusOK, status)
	}
}
