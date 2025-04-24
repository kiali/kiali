package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	"gopkg.in/yaml.v2"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
)

const (
	defaultPrometheusGlobalScrapeInterval       = 15                // seconds
	defaultPrometheusGlobalStorageTSDBRetention = 15 * 24 * 60 * 60 // Prometheus default is 15d
)

type IstioAnnotations struct {
	AmbientAnnotation        string `json:"ambientAnnotation,omitempty"`
	AmbientAnnotationEnabled string `json:"ambientAnnotationEnabled,omitempty"`
	IstioInjectionAnnotation string `json:"istioInjectionAnnotation,omitempty"`
}

// PrometheusConfig holds actual Prometheus configuration that is useful to Kiali.
// All durations are in seconds.
type PrometheusConfig struct {
	GlobalScrapeInterval int64 `json:"globalScrapeInterval,omitempty"`
	StorageTsdbRetention int64 `json:"storageTsdbRetention,omitempty"`
}

type DeploymentConfig struct {
	ViewOnlyMode bool `json:"viewOnlyMode,omitempty"`
}

// PublicConfig is a subset of Kiali configuration that can be exposed to clients to
// help them interact with the system.
type PublicConfig struct {
	AuthStrategy        string                        `json:"authStrategy,omitempty"`
	AmbientEnabled      bool                          `json:"ambientEnabled,omitempty"`
	Clusters            map[string]models.KubeCluster `json:"clusters,omitempty"`
	ClusterWideAccess   bool                          `json:"clusterWideAccess,omitempty"`
	Deployment          DeploymentConfig              `json:"deployment,omitempty"`
	GatewayAPIClasses   []config.GatewayAPIClass      `json:"gatewayAPIClasses,omitempty"`
	GatewayAPIEnabled   bool                          `json:"gatewayAPIEnabled,omitempty"`
	HealthConfig        config.HealthConfig           `json:"healthConfig,omitempty"`
	InstallationTag     string                        `json:"installationTag,omitempty"`
	IstioAnnotations    IstioAnnotations              `json:"istioAnnotations,omitempty"`
	IstioConfigMap      string                        `json:"istioConfigMap"`
	IstioIdentityDomain string                        `json:"istioIdentityDomain,omitempty"`
	IstioLabels         config.IstioLabels            `json:"istioLabels,omitempty"`
	IstioNamespace      string                        `json:"istioNamespace,omitempty"`
	IstioStatusEnabled  bool                          `json:"istioStatusEnabled,omitempty"`
	KialiFeatureFlags   config.KialiFeatureFlags      `json:"kialiFeatureFlags,omitempty"`
	LogLevel            string                        `json:"logLevel,omitempty"`
	Prometheus          PrometheusConfig              `json:"prometheus,omitempty"`
}

// Config is a REST http.HandlerFunc serving up the Kiali configuration made public to clients.
func Config(conf *config.Config, cache cache.KialiCache, discovery istio.MeshDiscovery, clientFactory kubernetes.ClientFactory, prom prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer handlePanic(w)

		log.FromRequest(r).Debug().Msg("Kiali configuration has been requested")

		// Note that we determine the Prometheus config at request time because it is not
		// guaranteed to remain the same during the Kiali lifespan.
		promConfig := getPrometheusConfig(conf, prom)
		publicConfig := PublicConfig{
			AuthStrategy:      conf.Auth.Strategy,
			Clusters:          make(map[string]models.KubeCluster),
			ClusterWideAccess: conf.Deployment.ClusterWideAccess,
			Deployment: DeploymentConfig{
				ViewOnlyMode: conf.Deployment.ViewOnlyMode,
			},
			InstallationTag: conf.InstallationTag,
			IstioAnnotations: IstioAnnotations{
				AmbientAnnotation:        config.AmbientAnnotation,
				AmbientAnnotationEnabled: config.AmbientAnnotationEnabled,
				IstioInjectionAnnotation: conf.ExternalServices.Istio.IstioInjectionAnnotation,
			},
			HealthConfig:        conf.HealthConfig,
			IstioStatusEnabled:  conf.ExternalServices.Istio.ComponentStatuses.Enabled,
			IstioIdentityDomain: conf.ExternalServices.Istio.IstioIdentityDomain,
			IstioNamespace:      conf.IstioNamespace,
			IstioLabels:         conf.IstioLabels,
			IstioConfigMap:      conf.ExternalServices.Istio.ConfigMapName,
			KialiFeatureFlags:   conf.KialiFeatureFlags,
			LogLevel:            log.GetLogLevel(),
			Prometheus: PrometheusConfig{
				GlobalScrapeInterval: promConfig.GlobalScrapeInterval,
				StorageTsdbRetention: promConfig.StorageTsdbRetention,
			},
		}

		userClients, err := getUserClients(r, clientFactory)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Unable to convert session token into user client: "+err.Error())
			return
		}

		// @TODO hardcoded home cluster
		if client := userClients[conf.KubernetesConfig.ClusterName]; client != nil {
			publicConfig.GatewayAPIEnabled = client.IsGatewayAPI()
		}
		publicConfig.AmbientEnabled = cache.IsAmbientEnabled(conf.KubernetesConfig.ClusterName)
		publicConfig.GatewayAPIClasses = kubernetes.GatewayAPIClasses(publicConfig.AmbientEnabled, conf)

		// Fetch the list of all clusters in the mesh
		// One usage of this data is to cross-link Kiali instances, when possible.
		clusters, err := discovery.Clusters()
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Failure while listing clusters in the mesh: "+err.Error())
			return
		}

		for _, cluster := range clusters {
			publicConfig.Clusters[cluster.Name] = cluster
		}

		RespondWithJSONIndent(w, http.StatusOK, publicConfig)
	}
}

type PrometheusPartialConfig struct {
	Global struct {
		Scrape_interval string
	}
}

func getPrometheusConfig(conf *config.Config, client prometheus.ClientInterface) PrometheusConfig {
	promConfig := PrometheusConfig{
		GlobalScrapeInterval: defaultPrometheusGlobalScrapeInterval,
		StorageTsdbRetention: defaultPrometheusGlobalStorageTSDBRetention,
	}
	// Check if thanosProxy
	thanosConf := conf.ExternalServices.Prometheus.ThanosProxy
	if thanosConf.Enabled {
		scrapeInterval, err := model.ParseDuration(thanosConf.ScrapeInterval)
		if checkErr(err, fmt.Sprintf("Invalid scrape interval in ThanosProxy configuration [%s]", scrapeInterval)) {
			promConfig.GlobalScrapeInterval = int64(time.Duration(scrapeInterval).Seconds())
		}
		retention, err := model.ParseDuration(thanosConf.RetentionPeriod)
		if checkErr(err, fmt.Sprintf("Invalid retention period in ThanosProxy configuration [%s]", retention)) {
			promConfig.StorageTsdbRetention = int64(time.Duration(retention).Seconds())
		}
	} else {
		configResult, err := client.GetConfiguration()
		if checkErr(err, "Failed to fetch Prometheus configuration") {
			var config PrometheusPartialConfig
			if checkErr(yaml.Unmarshal([]byte(configResult.YAML), &config), "Failed to unmarshal Prometheus configuration") {
				scrapeIntervalString := config.Global.Scrape_interval
				scrapeInterval, err := model.ParseDuration(scrapeIntervalString)
				if checkErr(err, fmt.Sprintf("Invalid global scrape interval [%s]", scrapeIntervalString)) {
					promConfig.GlobalScrapeInterval = int64(time.Duration(scrapeInterval).Seconds())
				}
			}
		}

		promRuntimeinfoResults, err := client.GetRuntimeinfo()
		if checkErr(err, "Failed to fetch Prometheus runtime info") {
			// the storage retention as reported by Prometheus endpoint /api/v1/status/runtimeinfo
			// It will either be time-based (e.g. "1d") or size-based (e.g "10GB") or both (e.g "1d or 10GB").
			// see: https://prometheus.io/docs/prometheus/latest/command-line/prometheus/
			//      https://prometheus.io/docs/prometheus/latest/storage/
			retentionStr := promRuntimeinfoResults.StorageRetention
			// if specified with both time-based and size-base durations, strip off the size-based one that appears after the space
			if strings.Contains(retentionStr, " ") {
				retentionStr = (strings.Fields(retentionStr))[0]
			}
			// if retention is only size-based (defined in bytes), then we will fallback to the Prometheus default
			if !strings.Contains(strings.ToLower(retentionStr), "b") {
				retentionPeriod, err := model.ParseDuration(retentionStr)
				if checkErr(err, "Cannot parse Promtheus retention period: "+retentionStr) {
					promConfig.StorageTsdbRetention = int64(time.Duration(retentionPeriod).Seconds())
				}
			}
		} else {
			log.Warning("Cannot determine Prometheus retention period; ignoring...")
		}
	}

	return promConfig
}

type KialiCrippledFeatures struct {
	RequestSize             bool `json:"requestSize"`
	RequestSizeAverage      bool `json:"requestSizeAverage"`
	RequestSizePercentiles  bool `json:"requestSizePercentiles"`
	ResponseSize            bool `json:"responseSize"`
	ResponseSizeAverage     bool `json:"responseSizeAverage"`
	ResponseSizePercentiles bool `json:"responseSizePercentiles"`
	ResponseTime            bool `json:"responseTime"`
	ResponseTimeAverage     bool `json:"responseTimeAverage"`
	ResponseTimePercentiles bool `json:"responseTimePercentiles"`
}

func CrippledFeatures(client prometheus.ClientInterface) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer handlePanic(w)

		requiredMetrics := []string{
			"istio_request_bytes_bucket",
			"istio_request_bytes_count",
			"istio_request_bytes_sum",
			"istio_request_duration_milliseconds_bucket",
			"istio_request_duration_milliseconds_count",
			"istio_request_duration_milliseconds_sum",
			"istio_requests_total",
			"istio_response_bytes_bucket",
			"istio_response_bytes_count",
			"istio_response_bytes_sum",
		}

		// assume nothing crippled on error
		crippledFeatures := KialiCrippledFeatures{}

		existingMetrics, err := client.GetExistingMetricNames(requiredMetrics)
		if !checkErr(err, "") {
			log.Error(err)
			RespondWithJSONIndent(w, http.StatusOK, crippledFeatures)
		}

		// if we have all of the metrics then nothing is crippled, just return
		// if we have no metrics then we have no requests (note that we check for istio_request_totals), nothing is known to be crippled
		if len(existingMetrics) == len(requiredMetrics) || len(existingMetrics) == 0 {
			RespondWithJSONIndent(w, http.StatusOK, crippledFeatures)
		}

		exists := make(map[string]bool, len(existingMetrics))
		for _, metric := range existingMetrics {
			exists[metric] = true
		}

		crippledFeatures.RequestSize = !exists["istio_request_bytes_sum"]
		crippledFeatures.RequestSizeAverage = crippledFeatures.RequestSize || !exists["istio_request_bytes_count"]
		crippledFeatures.RequestSizePercentiles = crippledFeatures.RequestSizeAverage || !exists["istio_request_bytes_bucket"]

		crippledFeatures.ResponseSize = !exists["istio_response_bytes_sum"]
		crippledFeatures.ResponseSizeAverage = crippledFeatures.ResponseSize || !exists["istio_response_bytes_count"]
		crippledFeatures.ResponseSizePercentiles = crippledFeatures.ResponseSizeAverage || !exists["istio_response_bytes_bucket"]

		crippledFeatures.ResponseTime = !exists["istio_request_duration_milliseconds_sum"]
		crippledFeatures.ResponseTimeAverage = crippledFeatures.ResponseTime || !exists["istio_request_duration_milliseconds_count"]
		crippledFeatures.ResponseTimePercentiles = crippledFeatures.ResponseTimeAverage || !exists["istio_request_duration_milliseconds_bucket"]

		RespondWithJSONIndent(w, http.StatusOK, crippledFeatures)
	}
}

func checkErr(err error, message string) bool {
	if err != nil {
		log.Errorf("%s: %v", message, err)
		return false
	}
	return true
}
