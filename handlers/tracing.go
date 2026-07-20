package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers/queryparams"
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
				InternalURL:          tracingConfig.InternalURL, // This is needed for OSSMC distributed tracing redirection
				Provider:             string(tracingConfig.Provider),
				TempoConfig:          tracingConfig.TempoConfig,
				URL:                  tracingConfig.ExternalURL,
				NamespaceSelector:    tracingConfig.NamespaceSelector,
				UseWaypointName:      tracingConfig.UseWaypointName,
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

		q, err := queryparams.ParseTracingQuery(conf, r.URL.Query())
		if err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}
		cluster := q.Cluster
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
		q, err := queryparams.ParseTracingQuery(conf, r.URL.Query())
		if err != nil {
			RespondWithQueryParamError(w, err.Error())
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
		q, err := queryparams.ParseTracingQuery(conf, r.URL.Query())
		if err != nil {
			RespondWithQueryParamError(w, err.Error())
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
		duration, cluster, err := queryparams.ParseErrorTracesDuration(conf, queryParams)
		if err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}
		traces, err := business.Tracing.GetErrorTraces(r.Context(), cluster, namespace, app, duration)
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
		if !models.ValidTraceIDRe.MatchString(traceID) {
			RespondWithError(w, http.StatusBadRequest, "Invalid trace ID format")
			return
		}
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
		q, err := queryparams.ParseTracingQuery(conf, r.URL.Query())
		if err != nil {
			RespondWithQueryParamError(w, err.Error())
			return
		}
		cluster := q.Cluster
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
		q, err := queryparams.ParseTracingQuery(conf, r.URL.Query())
		if err != nil {
			RespondWithQueryParamError(w, err.Error())
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
		q, err := queryparams.ParseTracingQuery(conf, r.URL.Query())
		if err != nil {
			RespondWithQueryParamError(w, err.Error())
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
			RespondWithError(w, http.StatusInternalServerError, "TracingDiagnose getLayer error: "+err.Error())
			return
		}

		if !business.Namespace.HasMeshAccess(r.Context(), clientFactory.GetSAHomeClusterClient().ClusterInfo().Name) {
			RespondWithError(w, http.StatusInternalServerError, "TracingDiagnose unauthorized")
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
		body, err := boundedReadAll(r)
		if err != nil {
			RespondWithError(w, http.StatusBadRequest, "Update request with bad update patch: "+err.Error())
			return
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
			RespondWithError(w, http.StatusInternalServerError, "TracingConfigurationCheck getLayer error: "+err.Error())
			return
		}

		if !business.Namespace.HasMeshAccess(r.Context(), clientFactory.GetSAHomeClusterClient().ClusterInfo().Name) {
			RespondWithError(w, http.StatusInternalServerError, "TracingConfigurationCheck Unauthorized")
			return
		}

		status := business.Tracing.ValidateConfiguration(r.Context(), conf, &tracingConfig, clientFactory.GetSAHomeClusterClient().GetToken())
		RespondWithJSON(w, http.StatusOK, status)
	}
}
