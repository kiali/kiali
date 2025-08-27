package config

import (
	"crypto/x509"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	"github.com/kiali/kiali/config/dashboards"
	"github.com/kiali/kiali/config/security"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

// Files found in /kiali-override-secrets that override the ConfigMap yaml values
const (
	// External services auth
	SecretFileGrafanaUsername    = "grafana-username"
	SecretFileGrafanaPassword    = "grafana-password"
	SecretFileGrafanaToken       = "grafana-token"
	SecretFilePersesUsername     = "perses-username"
	SecretFilePersesPassword     = "perses-password"
	SecretFilePrometheusUsername = "prometheus-username"
	SecretFilePrometheusPassword = "prometheus-password"
	SecretFilePrometheusToken    = "prometheus-token"
	SecretFileTracingUsername    = "tracing-username"
	SecretFileTracingPassword    = "tracing-password"
	SecretFileTracingToken       = "tracing-token"

	// External services auth for custom dashboards
	SecretFileCustomDashboardsPrometheusUsername = "customdashboards-prometheus-username"
	SecretFileCustomDashboardsPrometheusPassword = "customdashboards-prometheus-password"
	SecretFileCustomDashboardsPrometheusToken    = "customdashboards-prometheus-token"

	// Login Token signing key used to prepare the token for user login
	SecretFileLoginTokenSigningKey = "login-token-signing-key"
)

// The valid auth strategies and values for cookie handling
const (
	AuthStrategyOpenshift = "openshift"
	AuthStrategyAnonymous = "anonymous"
	AuthStrategyToken     = "token"
	AuthStrategyOpenId    = "openid"
	AuthStrategyHeader    = "header"

	// These constants are used for external services auth (Prometheus, Grafana ...) ; not for Kiali auth
	AuthTypeBasic  = "basic"
	AuthTypeBearer = "bearer"
	AuthTypeNone   = "none"
)

const (
	IstioMultiClusterHostSuffix = "global"
	IstioNamespaceDefault       = "istio-system"
	OidcClientSecretFile        = "/kiali-secret/oidc-secret"
)

const (
	DashboardsDiscoveryEnabled = "true"
	DashboardsDiscoveryAuto    = "auto"
)

const (
	// DefaultClusterID is generally not for use outside of test-code. In general you should use conf.KubernetesConfig.ClusterName
	DefaultClusterID = "Kubernetes"
)

const (
	AmbientAnnotation         = "ambient.istio.io/redirection"
	AmbientAnnotationEnabled  = "enabled"
	GatewayLabel              = "gateway.networking.k8s.io/gateway-name" // On any k8s GW API gateway
	IstioAppLabel             = "app"                                    // we can assume istio components are labeled with "app"
	IstioInjectionAnnotation  = "sidecar.istio.io/inject"                // the standard annotation for sidecar injection
	IstioRevisionLabel        = "istio.io/rev"                           // the standard label key used to identify the istio revision.
	IstioSidecarAnnotation    = "sidecar.istio.io/status"                // the standard annotation for sidecar status
	IstioVersionLabel         = "version"                                // we can assume istio components are labeled with "version", if versioned
	KubernetesAppLabel        = "app.kubernetes.io/name"
	Waypoint                  = "waypoint"
	WaypointFor               = "istio.io/waypoint-for"
	WaypointForAll            = "all"
	WaypointForNone           = "none"
	WaypointForService        = "service"
	WaypointForWorkload       = "workload"
	WaypointLabel             = "gateway.istio.io/managed" // only identifies istio waypoint
	WaypointLabelValue        = "istio.io-mesh-controller" // only identifies istio waypoint
	WaypointUseLabel          = "istio.io/use-waypoint"
	WaypointNone              = "none"
	WaypointUseNamespaceLabel = "istio.io/use-waypoint-namespace"
	Ztunnel                   = "ztunnel"
)

const (
	additionalCABundle = "/kiali-cabundle/additional-ca-bundle.pem"
	openshiftServingCA = "/kiali-cabundle/service-ca.crt"
	// This is an alternate location for the openshift serving cert. It's unclear which
	// one to prefer so we try reading both.
	openshiftServingCAFromSA = "/var/run/secrets/kubernetes.io/serviceaccount/service-ca.crt"
)

// TracingProvider is the type of tracing provider that Kiali will connect to.
type TracingProvider string

const (
	JaegerProvider TracingProvider = "jaeger"
	TempoProvider  TracingProvider = "tempo"
)

// TracingCollectorType is the type of collector that Kiali will export traces to.
// These are traces that kiali generates for itself.
type TracingCollectorType string

const (
	OTELCollectorType TracingCollectorType = "otel"
)

var validPathRegEx = regexp.MustCompile(`^\/[a-zA-Z0-9\-\._~!\$&\'()\*\+\,;=:@%/]*$`)

// FeatureName is the enum type used for named features that can be disabled via KialiFeatureFlags.DisabledFeatures
type FeatureName string

const (
	FeatureLogView FeatureName = "logs-tab"
)

func (fn FeatureName) IsValid() error {
	switch fn {
	case FeatureLogView:
		return nil
	}
	return fmt.Errorf("invalid feature name: %v", fn)
}

// Global configuration for the application.
var (
	configuration Config
	rwMutex       sync.RWMutex
)

// Defines where the files are located that contain the secrets content
var overrideSecretsDir = "/kiali-override-secrets"

// Cluster is used to manually specify a cluster that there is no remote secret for.
type Cluster struct {
	// Name of the cluster. Must be unique and match what is in telemetry.
	Name string `yaml:"name,omitempty"`

	// SecretName is the name of the secret that contains the credentials necessary to connect to the remote cluster.
	// This secret must exist in the Kiali deployment namespace. If no secret name is provided, then it's
	// assumed that this cluster is inaccessible.
	SecretName string `yaml:"secret_name,omitempty"`
}

// Metrics provides metrics configuration for the Kiali server.
type Metrics struct {
	Enabled bool `yaml:"enabled,omitempty"`
	Port    int  `yaml:"port,omitempty"`
}

// OpenTelemetry collector configuration for tracing
type OtelCollector struct {
	CAName     string `yaml:"ca_name,omitempty"`
	Protocol   string `yaml:"protocol,omitempty"` // http or https or grpc
	SkipVerify bool   `yaml:"skip_verify,omitempty"`
	TLSEnabled bool   `yaml:"tls_enabled,omitempty"`
}

// Tracing provides tracing configuration for the Kiali server.
type Tracing struct {
	CollectorType TracingCollectorType `yaml:"collector_type,omitempty"` // Possible value "otel"
	CollectorURL  string               `yaml:"collector_url,omitempty"`  // Endpoint for Kiali server traces
	Enabled       bool                 `yaml:"enabled,omitempty"`
	Otel          OtelCollector        `yaml:"otel,omitempty"`
	// Sampling rate for Kiali server traces. >= 1.0 always samples and <= 0 never samples.
	SamplingRate float64 `yaml:"sampling_rate,omitempty"`
}

// Observability provides configuration for tracing and metrics exported by the Kiali server.
type Observability struct {
	Metrics Metrics `yaml:"metrics,omitempty"`
	Tracing Tracing `yaml:"tracing,omitempty"`
}

// Server configuration
type Server struct {
	Address        string        `yaml:",omitempty"`
	AuditLog       bool          `yaml:"audit_log,omitempty"` // When true, allows additional audit logging on Write operations
	CORSAllowAll   bool          `yaml:"cors_allow_all,omitempty"`
	GzipEnabled    bool          `yaml:"gzip_enabled,omitempty"`
	Observability  Observability `yaml:"observability,omitempty"`
	Port           int           `yaml:",omitempty"`
	Profiler       Profiler      `yaml:"profiler,omitempty"`
	RequireAuth    bool          `yaml:"require_auth,omitempty"` // when true, unauthenticated access to api/ endpoint is not allowed
	WebFQDN        string        `yaml:"web_fqdn,omitempty"`
	WebPort        string        `yaml:"web_port,omitempty"`
	WebRoot        string        `yaml:"web_root,omitempty"`
	WebHistoryMode string        `yaml:"web_history_mode,omitempty"`
	WebSchema      string        `yaml:"web_schema,omitempty"`
	WriteTimeout   time.Duration `yaml:"write_timeout,omitempty"`
}

// Auth provides authentication data for external services
type Auth struct {
	CAFile             string `yaml:"ca_file" json:"caFile"`
	InsecureSkipVerify bool   `yaml:"insecure_skip_verify" json:"insecureSkipVerify"`
	Password           string `yaml:"password" json:"password"`
	Token              string `yaml:"token" json:"token"`
	Type               string `yaml:"type" json:"type"`
	UseKialiToken      bool   `yaml:"use_kiali_token" json:"useKialiToken"`
	Username           string `yaml:"username" json:"username"`
}

func (a *Auth) Obfuscate() {
	a.Token = "xxx"
	a.Password = "xxx"
	a.Username = "xxx"
	a.CAFile = "xxx"
}

// ThanosProxy describes configuration of the Thanos proxy component
type ThanosProxy struct {
	Enabled         bool   `yaml:"enabled,omitempty" json:"enabled,omitempty"`
	RetentionPeriod string `yaml:"retention_period,omitempty" json:"retentionPeriod,omitempty"`
	ScrapeInterval  string `yaml:"scrape_interval,omitempty" json:"scrapeInterval,omitempty"`
}

// PrometheusConfig describes configuration of the Prometheus component
type PrometheusConfig struct {
	Auth            Auth              `yaml:"auth,omitempty" json:"auth,omitempty"`
	CacheDuration   int               `yaml:"cache_duration,omitempty" json:"cacheDuration,omitempty"`     // Cache duration per query expressed in seconds
	CacheEnabled    bool              `yaml:"cache_enabled,omitempty" json:"cacheEnabled,omitempty"`       // Enable cache for Prometheus queries
	CacheExpiration int               `yaml:"cache_expiration,omitempty" json:"cacheExpiration,omitempty"` // Global cache expiration expressed in seconds
	CustomHeaders   map[string]string `yaml:"custom_headers,omitempty" json:"customHeaders,omitempty"`
	HealthCheckUrl  string            `yaml:"health_check_url,omitempty" json:"healthCheckUrl,omitempty"`
	IsCore          bool              `yaml:"is_core,omitempty" json:"isCore,omitempty"`
	QueryScope      map[string]string `yaml:"query_scope,omitempty" json:"queryScope,omitempty"`
	ThanosProxy     ThanosProxy       `yaml:"thanos_proxy,omitempty" json:"thanosProxy,omitempty"`
	URL             string            `yaml:"url,omitempty" json:"url,omitempty"`
}

// CustomDashboardsConfig describes configuration specific to Custom Dashboards
type CustomDashboardsConfig struct {
	DiscoveryEnabled       string           `yaml:"discovery_enabled,omitempty" json:"discoveryEnabled,omitempty"`
	DiscoveryAutoThreshold int              `yaml:"discovery_auto_threshold,omitempty" json:"discoveryAutoThreshold,omitempty"`
	Enabled                bool             `yaml:"enabled,omitempty" json:"enabled,omitempty"`
	IsCore                 bool             `yaml:"is_core,omitempty" json:"isCore,omitempty"`
	NamespaceLabel         string           `yaml:"namespace_label,omitempty" json:"namespaceLabel,omitempty"`
	Prometheus             PrometheusConfig `yaml:"prometheus,omitempty" json:"prometheus,omitempty"`
}

// GrafanaConfig describes configuration used for Grafana links
type GrafanaConfig struct {
	Auth           Auth                     `yaml:"auth" json:"auth"`
	Dashboards     []GrafanaDashboardConfig `yaml:"dashboards" json:"dashboards"`
	DatasourceUID  string                   `yaml:"datasource_uid,omitempty" json:"datasourceUID,omitempty"`
	Enabled        bool                     `yaml:"enabled" json:"enabled"`          // Enable or disable Grafana support in Kiali
	ExternalURL    string                   `yaml:"external_url" json:"externalURL"` // replaces the old url
	HealthCheckUrl string                   `yaml:"health_check_url,omitempty" json:"healthCheckUrl,omitempty"`
	InternalURL    string                   `yaml:"internal_url" json:"internalURL"` // replaces the old in_cluster_url
	IsCore         bool                     `yaml:"is_core,omitempty" json:"isCore,omitempty"`
	XInClusterURL  string                   `yaml:"in_cluster_url,omitempty" json:"InClusterURL,omitempty"` // DEPRECATED!
	XURL           string                   `yaml:"url,omitempty" json:"URL,omitempty"`                     // DEPRECATED!
}

// Alias to keep the same name in Grafana but more generic (Used by Perses as well)
type GrafanaDashboardConfig = DashboardConfig
type GrafanaVariablesConfig = DashboardVariablesConfig

type DashboardConfig struct {
	Name      string                   `yaml:"name" json:"name"`
	Variables DashboardVariablesConfig `yaml:"variables" json:"variables"`
}

type DashboardVariablesConfig struct {
	App        string `yaml:"app" json:"app,omitempty"`
	Datasource string `yaml:"datasource" json:"datasource,omitempty"`
	Namespace  string `yaml:"namespace" json:"namespace,omitempty"`
	Service    string `yaml:"service" json:"service,omitempty"`
	Version    string `yaml:"version" json:"version,omitempty"`
	Workload   string `yaml:"workload" json:"workload,omitempty"`
}

// PersesConfig describes configuration used for Perses links
type PersesConfig struct {
	Auth           Auth              `yaml:"auth" json:"auth"`
	Dashboards     []DashboardConfig `yaml:"dashboards" json:"dashboards"`
	Enabled        bool              `yaml:"enabled" json:"enabled"`          // Enable or disable Perses support in Kiali
	ExternalURL    string            `yaml:"external_url" json:"externalURL"` // replaces the old url
	HealthCheckUrl string            `yaml:"health_check_url,omitempty" json:"healthCheckUrl,omitempty"`
	InternalURL    string            `yaml:"internal_url" json:"internalURL"` // replaces the old in_cluster_url
	IsCore         bool              `yaml:"is_core,omitempty" json:"isCore,omitempty"`
	Project        string            `yaml:"project,omitempty" json:"project,omitempty"`
}

type TempoConfig struct {
	CacheCapacity int    `yaml:"cache_capacity" json:"cacheCapacity,omitempty"`
	CacheEnabled  bool   `yaml:"cache_enabled" json:"cacheEnabled,omitempty"`
	DatasourceUID string `yaml:"datasource_uid" json:"datasourceUID,omitempty"`
	OrgID         string `yaml:"org_id" json:"orgID,omitempty"`
	URLFormat     string `yaml:"url_format" json:"urlFormat,omitempty"`
}

// TracingConfig describes configuration used for tracing links
type TracingConfig struct {
	Auth                 Auth              `yaml:"auth" json:"auth"`
	CustomHeaders        map[string]string `yaml:"custom_headers,omitempty" json:"customHeaders,omitempty"`
	DisableVersionCheck  bool              `yaml:"disable_version_check,omitempty" json:"disableVersionCheck,omitempty"`
	Enabled              bool              `yaml:"enabled" json:"enabled"`
	ExternalURL          string            `yaml:"external_url" json:"externalURL"`
	HealthCheckUrl       string            `yaml:"health_check_url,omitempty" json:"healthCheckUrl,omitempty"`
	GrpcPort             int               `yaml:"grpc_port,omitempty" json:"grpcPort,omitempty"`
	InternalURL          string            `yaml:"internal_url" json:"internalURL"`
	IsCore               bool              `yaml:"is_core,omitempty" json:"isCore,omitempty"`
	Provider             TracingProvider   `yaml:"provider,omitempty" json:"provider,omitempty"`
	TempoConfig          TempoConfig       `yaml:"tempo_config,omitempty" json:"tempoConfig,omitempty"`
	NamespaceSelector    bool              `yaml:"namespace_selector" json:"namespaceSelector"`
	QueryScope           map[string]string `yaml:"query_scope,omitempty" json:"queryScope,omitempty"`
	QueryTimeout         int               `yaml:"query_timeout,omitempty" json:"queryTimeout,omitempty"`
	UseGRPC              bool              `yaml:"use_grpc" json:"useGRPC"`
	WhiteListIstioSystem []string          `yaml:"whitelist_istio_system" json:"whiteListIstioSystem"`
	XInClusterURL        string            `yaml:"in_cluster_url,omitempty" json:"InClusterURL,omitempty"` // DEPRECATED!
	XURL                 string            `yaml:"url,omitempty" json:"URL,omitempty"`                     // DEPRECATED!
}

// RegistryConfig contains configuration for connecting to an external istiod.
// This is used when Kiali should connect to the istiod via a url instead of port forwarding.
type RegistryConfig struct {
	IstiodURL string `yaml:"istiod_url" json:"istiodUrl"`
	// TODO: Support auth options
}

// IstioConfig describes configuration used for istio links.
// IMPORTANT: Values set here MUST apply to ALL Istio control planes being monitored by the Kiali
//
//	instance. Otherwise Kiali will do it's best to auto-detect differences.
//
// TODO: Go through this list and remove anything that requires auto-detection or does not make sense for
//
//	a multi-control-plane deployment.
type IstioConfig struct {
	ComponentStatuses              ComponentStatuses `yaml:"component_status,omitempty" json:"componentStatuses,omitempty"`
	GatewayAPIClasses              []GatewayAPIClass `yaml:"gateway_api_classes,omitempty" json:"gatewayApiClasses,omitempty"`
	GatewayAPIClassesLabelSelector string            `yaml:"gateway_api_classes_label_selector,omitempty" json:"gatewayApiClassesLabelSelector,omitempty"`
	IstioAPIEnabled                bool              `yaml:"istio_api_enabled" json:"istioApiEnabled"`
	IstioIdentityDomain            string            `yaml:"istio_identity_domain,omitempty" json:"istioIdentityDomain,omitempty"`
	// IstiodPollingIntervalSeconds is how often in seconds Kiali will poll istiod(s) for
	// proxy status and registry services. Polling is not performed if IstioAPIEnabled is false.
	IstiodPollingIntervalSeconds     int             `yaml:"istiod_polling_interval_seconds,omitempty" json:"istiodPollingIntervalSeconds,omitempty"`
	Registry                         *RegistryConfig `yaml:"registry,omitempty" json:"registry,omitempty"`
	ValidationChangeDetectionEnabled bool            `yaml:"validation_change_detection_enabled,omitempty" json:"validationChangeDetectionEnabled,omitempty"`
	// ValidationReconcileInterval sets how often Kiali will validate Istio configuration.
	// Validations can be disabled setting the interval to 0
	ValidationReconcileInterval *time.Duration `yaml:"validation_reconcile_interval,omitempty" json:"validationReconcileInterval,omitempty"`
}

type ComponentStatuses struct {
	Enabled    bool              `yaml:"enabled,omitempty" json:"enabled,omitempty"`
	Components []ComponentStatus `yaml:"components,omitempty" json:"components,omitempty"`
}

type ComponentStatus struct {
	AppLabel       string `yaml:"app_label,omitempty" json:"appLabel,omitempty"`
	IsCore         bool   `yaml:"is_core,omitempty" json:"isCore,omitempty"`
	IsProxy        bool   `yaml:"is_proxy,omitempty" json:"isProxy,omitempty"`
	IsMultiCluster bool   `yaml:"is_multicluster,omitempty" json:"isMulticluster,omitempty"`
	Namespace      string `yaml:"namespace,omitempty" json:"namespace,omitempty"`
}

type GatewayAPIClass struct {
	Name      string `yaml:"name,omitempty" json:"name,omitempty"`
	ClassName string `yaml:"class_name,omitempty" json:"className,omitempty"`
}

// ExternalServices holds configurations for other systems that Kiali depends on
type ExternalServices struct {
	Grafana          GrafanaConfig          `yaml:"grafana,omitempty"`
	Istio            IstioConfig            `yaml:"istio,omitempty"`
	Perses           PersesConfig           `yaml:"perses,omitempty"`
	Prometheus       PrometheusConfig       `yaml:"prometheus,omitempty"`
	CustomDashboards CustomDashboardsConfig `yaml:"custom_dashboards,omitempty"`
	Tracing          TracingConfig          `yaml:"tracing,omitempty"`
}

// LoginToken holds config used for generating the Kiali session tokens.
type LoginToken struct {
	ExpirationSeconds int64  `yaml:"expiration_seconds,omitempty"`
	SigningKey        string `yaml:"signing_key,omitempty"`
}

func (lt *LoginToken) Obfuscate() {
	lt.SigningKey = "xxx"
}

// IstioLabels holds configuration about the labels required by Istio
type IstioLabels struct {
	AmbientNamespaceLabel       string `yaml:"ambient_namespace_label,omitempty" json:"ambientNamespaceLabel"`
	AmbientNamespaceLabelValue  string `yaml:"ambient_namespace_label_value,omitempty" json:"ambientNamespaceLabelValue"`
	AmbientWaypointGatewayLabel string `yaml:"ambient_waypoint_gateway_label,omitempty" json:"ambientWaypointGatewayLabel"`
	AmbientWaypointLabel        string `yaml:"ambient_waypoint_label,omitempty" json:"ambientWaypointLabel"`
	AmbientWaypointLabelValue   string `yaml:"ambient_waypoint_label_value,omitempty" json:"ambientWaypointLabelValue"`
	AmbientWaypointUseLabel     string `yaml:"ambient_waypoint_use_label,omitempty" json:"ambientWaypointUseLabel"`
	AppLabelName                string `yaml:"app_label_name,omitempty" json:"appLabelName"`
	InjectionLabelName          string `yaml:"injection_label_name,omitempty" json:"injectionLabelName"`
	InjectionLabelRev           string `yaml:"injection_label_rev,omitempty" json:"injectionLabelRev"`
	ServiceCanonicalName        string `yaml:"service_canonical_name,omitempty" json:"serviceCanonicalName"`
	ServiceCanonicalRevision    string `yaml:"service_canonical_revision,omitempty" json:"serviceCanonicalRevision"`
	VersionLabelName            string `yaml:"version_label_name,omitempty" json:"versionLabelName"`
}

// AdditionalDisplayItem holds some display-related configuration, like which annotations are to be displayed
type AdditionalDisplayItem struct {
	Annotation     string `yaml:"annotation"`
	IconAnnotation string `yaml:"icon_annotation"`
	Title          string `yaml:"title"`
}

// KubernetesConfig holds the k8s client, caching and performance configuration
type KubernetesConfig struct {
	Burst int `yaml:"burst,omitempty"`
	// Cache duration expressed in seconds
	// Cache uses watchers to sync with the backend, after a CacheDuration watchers are closed and re-opened
	CacheDuration int `yaml:"cache_duration,omitempty"`
	// Cache duration expressed in seconds
	// Kiali cache list of namespaces per user, this is typically short lived cache compared with the duration of the
	// namespace cache defined by previous CacheDuration parameter
	CacheTokenNamespaceDuration int `yaml:"cache_token_namespace_duration,omitempty"`
	// ClusterName is the name of the kubernetes cluster that Kiali is running in.
	// If empty, then it will default to 'Kubernetes'.
	ClusterName string `yaml:"cluster_name,omitempty"`
	// List of controllers that won't be used for Workload calculation
	// Kiali queries Deployment,ReplicaSet,ReplicationController,DeploymentConfig,StatefulSet,Job and CronJob controllers
	// Deployment and ReplicaSet will be always queried, but ReplicationController,DeploymentConfig,StatefulSet,Job and CronJobs
	// can be skipped from Kiali workloads query if they are present in this list
	ExcludeWorkloads []string `yaml:"excluded_workloads,omitempty"`
	QPS              float32  `yaml:"qps,omitempty"`
}

// CacheExpirationConfig sets expiration time for various cache stores
type CacheExpirationConfig struct {
	AmbientCheck  time.Duration `yaml:"ambient_check,omitempty"`
	IstioStatus   time.Duration `yaml:"istio_status,omitempty"`
	Gateway       time.Duration `yaml:"gateway,omitempty"`
	Mesh          time.Duration `yaml:"mesh,omitempty"`
	Waypoint      time.Duration `yaml:"waypoint,omitempty"`
	ZtunnelConfig time.Duration `yaml:"ztunnel_config,omitempty"`
}

// KialiInternalConfig holds configuration that is not typically touched by users, but could be in the event of
// unusual circumstances. It may be undocumented and is subject to change. It is unstructured in the CRD schema.
type KialiInternalConfig struct {
	CacheExpiration        CacheExpirationConfig `yaml:"cache_expiration,omitempty"`
	MetricLogDurationLimit time.Duration         `yaml:"metric_log_duration_limit,omitempty"`
	// TODO: This is only used by `run-kiali`. Remove once we have a way to tell Kiali
	// we are running outside the cluster. Part of: https://github.com/kiali/kiali/issues/8263.
	UrlServiceVersion string `yaml:"url_service_version" json:"urlServiceVersion"`
}

// AuthConfig provides details on how users are to authenticate
type AuthConfig struct {
	OpenId    OpenIdConfig    `yaml:"openid,omitempty"`
	OpenShift OpenShiftConfig `yaml:"openshift,omitempty"`
	Strategy  string          `yaml:"strategy,omitempty"`
}

// OpenShiftConfig contains specific configuration for authentication when on OpenShift
type OpenShiftConfig struct {
	CAFile                string `yaml:"ca_file,omitempty"`
	InsecureSkipVerifyTLS bool   `yaml:"insecure_skip_verify_tls,omitempty"`
}

// OpenIdConfig contains specific configuration for authentication using an OpenID provider
type OpenIdConfig struct {
	AdditionalRequestParams map[string]string `yaml:"additional_request_params,omitempty"`
	AllowedDomains          []string          `yaml:"allowed_domains,omitempty"`
	ApiProxy                string            `yaml:"api_proxy,omitempty"`
	ApiProxyCAData          string            `yaml:"api_proxy_ca_data,omitempty"`
	ApiToken                string            `yaml:"api_token,omitempty"`
	AuthenticationTimeout   int               `yaml:"authentication_timeout,omitempty"`
	AuthorizationEndpoint   string            `yaml:"authorization_endpoint,omitempty"`
	ClientId                string            `yaml:"client_id,omitempty"`
	ClientSecret            string            `yaml:"client_secret,omitempty"`
	DisableRBAC             bool              `yaml:"disable_rbac,omitempty"`
	HTTPProxy               string            `yaml:"http_proxy,omitempty"`
	HTTPSProxy              string            `yaml:"https_proxy,omitempty"`
	InsecureSkipVerifyTLS   bool              `yaml:"insecure_skip_verify_tls,omitempty"`
	IssuerUri               string            `yaml:"issuer_uri,omitempty"`
	Scopes                  []string          `yaml:"scopes,omitempty"`
	UsernameClaim           string            `yaml:"username_claim,omitempty"`
}

// DeploymentConfig provides details on how Kiali was deployed.
type DeploymentConfig struct {
	certPool *x509.CertPool

	AccessibleNamespaces []string                 // this is no longer part of the actual config - we will generate this in Unmarshal()
	ClusterWideAccess    bool                     `yaml:"cluster_wide_access,omitempty"`
	ClusterNameOverrides map[string]string        `yaml:"cluster_name_overrides,omitempty"`
	DiscoverySelectors   DiscoverySelectorsConfig `yaml:"discovery_selectors,omitempty"`
	InstanceName         string                   `yaml:"instance_name"`
	Namespace            string                   `yaml:"namespace,omitempty"` // Kiali deployment namespace
	ViewOnlyMode         bool                     `yaml:"view_only_mode,omitempty"`
}

// we need to play games with a custom unmarshaller/marshaller for metav1.LabelSelector because it has no yaml struct tags so
// it is not processing it the way we want by default (it isn't using camelCase; the fields are lowercase - e.g. matchlabels/matchexpressions)
type (
	DiscoverySelectorType  metav1.LabelSelector
	DiscoverySelectorsType []*DiscoverySelectorType
)

func (dst *DiscoverySelectorType) UnmarshalYAML(unmarshal func(interface{}) error) error {
	// Define a temporary struct to map YAML fields to Go struct fields
	type Alias metav1.LabelSelector
	aux := &struct {
		MatchLabels      map[string]string                 `yaml:"matchLabels"`
		MatchExpressions []metav1.LabelSelectorRequirement `yaml:"matchExpressions"`
		*Alias
	}{
		Alias: (*Alias)(dst),
	}

	// Unmarshal into the temporary struct
	if err := unmarshal(&aux); err != nil {
		return err
	}

	// Map the fields from the temporary struct to the actual fields
	dst.MatchLabels = aux.MatchLabels
	dst.MatchExpressions = aux.MatchExpressions

	return nil
}

func (dst DiscoverySelectorType) MarshalYAML() (interface{}, error) {
	return map[string]interface{}{
		"matchLabels":      dst.MatchLabels,
		"matchExpressions": dst.MatchExpressions,
	}, nil
}

type DiscoverySelectorsConfig struct {
	Default   DiscoverySelectorsType            `yaml:"default,omitempty"`
	Overrides map[string]DiscoverySelectorsType `yaml:"overrides,omitempty"`
}

// ExtensionConfig provides details on a registered Extension
type ExtensionConfig struct {
	Enabled bool   `yaml:"enabled,omitempty"`
	Name    string `yaml:"name"` // same name used in metrics "extension" attribute
}

// GraphFindOption defines a single Graph Find/Hide Option
type GraphFindOption struct {
	AutoSelect  bool   `yaml:"auto_select,omitempty" json:"autoSelect,omitempty"`
	Description string `yaml:"description,omitempty" json:"description,omitempty"`
	Expression  string `yaml:"expression,omitempty" json:"expression,omitempty"`
}

// GraphSettings affect the graph visualization.
// Animation: animation type point (default) | dash
type GraphSettings struct {
	Animation string `yaml:"animation,omitempty" json:"animation,omitempty"`
}

// GraphTraffic defines the protocol-specific rates used to determine traffic for graph generation.
// ambient options : none | total (traffic) | waypoint (only) | ztunnel (only)
// grpc options : none | sent (messages) | received (messages) | requests (default) | total (messages)
// http options : none | requests (default)
// tcp options  : none | sent (bytes, default) | received (bytes) | total (bytes)
type GraphTraffic struct {
	Ambient string `yaml:"ambient,omitempty" json:"ambient,omitempty"`
	Grpc    string `yaml:"grpc,omitempty" json:"grpc,omitempty"`
	Http    string `yaml:"http,omitempty" json:"http,omitempty"`
	Tcp     string `yaml:"tcp,omitempty" json:"tcp,omitempty"`
}

// GraphUIDefaults defines UI Defaults specific to the UI Graph
type GraphUIDefaults struct {
	FindOptions []GraphFindOption `yaml:"find_options,omitempty" json:"findOptions,omitempty"`
	HideOptions []GraphFindOption `yaml:"hide_options,omitempty" json:"hideOptions,omitempty"`
	Settings    GraphSettings     `yaml:"settings,omitempty" json:"settings,omitempty"`
	Traffic     GraphTraffic      `yaml:"traffic,omitempty" json:"traffic,omitempty"`
}

// I18nUIDefaults defines UI Defaults specific to the I18n settings
type I18nUIDefaults struct {
	Language     string `yaml:"language,omitempty" json:"language,omitempty"`
	ShowSelector bool   `yaml:"show_selector,omitempty" json:"showSelector"`
}

// ListUIDefaults defines UI Defaults specific to the UI List pages
type ListUIDefaults struct {
	IncludeHealth         bool `yaml:"include_health,omitempty" json:"includeHealth"`
	IncludeIstioResources bool `yaml:"include_istio_resources,omitempty" json:"includeIstioResources"`
	IncludeValidations    bool `yaml:"include_validations,omitempty" json:"includeValidations"`
	ShowIncludeToggles    bool `yaml:"show_include_toggles,omitempty" json:"showIncludeToggles"`
}

// MeshUIDefaults defines UI Defaults specific to the UI Mesh page
type MeshUIDefaults struct {
	FindOptions []GraphFindOption `yaml:"find_options,omitempty" json:"findOptions,omitempty"`
	HideOptions []GraphFindOption `yaml:"hide_options,omitempty" json:"hideOptions,omitempty"`
}

// Aggregation represents label's allowed aggregations, transformed from aggregation in MonitoringDashboard config resource
type Aggregation struct {
	Label           string `yaml:"label,omitempty" json:"label"`
	DisplayName     string `yaml:"display_name,omitempty" json:"displayName"`
	SingleSelection bool   `yaml:"single_selection,omitempty" json:"singleSelection"`
}

type MetricsDefaults struct {
	Aggregations []Aggregation `yaml:"aggregations,omitempty" json:"aggregations,omitempty"`
}
type TracingDefaults struct {
	Limit int `yaml:"limit,omitempty" json:"limit,omitempty"`
}

// UIDefaults defines default settings configured for the UI
type UIDefaults struct {
	Graph             GraphUIDefaults `yaml:"graph,omitempty" json:"graph,omitempty"`
	I18n              I18nUIDefaults  `yaml:"i18n,omitempty" json:"i18n,omitempty"`
	List              ListUIDefaults  `yaml:"list,omitempty" json:"list,omitempty"`
	Mesh              MeshUIDefaults  `yaml:"mesh,omitempty" json:"mesh,omitempty"`
	MetricsPerRefresh string          `yaml:"metrics_per_refresh,omitempty" json:"metricsPerRefresh,omitempty"`
	MetricsInbound    MetricsDefaults `yaml:"metrics_inbound,omitempty" json:"metricsInbound,omitempty"`
	MetricsOutbound   MetricsDefaults `yaml:"metrics_outbound,omitempty" json:"metricsOutbound,omitempty"`
	Namespaces        []string        `yaml:"namespaces,omitempty" json:"namespaces,omitempty"`
	RefreshInterval   string          `yaml:"refresh_interval,omitempty" json:"refreshInterval,omitempty"`
	Tracing           TracingDefaults `yaml:"tracing,omitempty" json:"tracing,omitempty"`
}

// Validations defines default settings configured for the Validations subsystem
type Validations struct {
	Ignore                   []string `yaml:"ignore,omitempty" json:"ignore,omitempty"`
	SkipWildcardGatewayHosts bool     `yaml:"skip_wildcard_gateway_hosts,omitempty"`
}

// Clustering defines configuration around multi-cluster functionality.
type Clustering struct {
	// Clusters is a list of clusters that cannot be autodetected by the Kiali Server.
	// Remote clusters are specified here if ‘autodetect_secrets.enabled’ is false or
	// if the Kiali Server does not have access to the remote cluster’s secret.
	Clusters           []Cluster  `yaml:"clusters" json:"clusters"`
	EnableExecProvider bool       `yaml:"enable_exec_provider,omitempty" json:"enable_exec_provider"`
	IgnoreHomeCluster  bool       `yaml:"ignore_home_cluster" json:"ignoreHomeCluster"`
	KialiURLs          []KialiURL `yaml:"kiali_urls" json:"kialiUrls"`
}

// IsZero implements: https://pkg.go.dev/gopkg.in/yaml.v2#IsZeroer so that
// tests can patch the Clustering struct and have it be recognized as non-zero
// while keeping the omitempty yaml tag.
func (c Clustering) IsZero() bool {
	return c.Clusters == nil && c.KialiURLs == nil
}

type FeatureFlagClustering struct {
	EnableExecProvider bool `yaml:"enable_exec_provider,omitempty" json:"enable_exec_provider"`
}

// KialiURL defines a cluster name, namespace and instance name properties to URL.
type KialiURL struct {
	ClusterName  string `yaml:"cluster_name,omitempty"`
	InstanceName string `yaml:"instance_name,omitempty"`
	Namespace    string `yaml:"namespace,omitempty"`
	URL          string `yaml:"url,omitempty"`
}

// KialiFeatureFlags available from the CR
type KialiFeatureFlags struct {
	Clustering            FeatureFlagClustering `yaml:"clustering,omitempty" json:"clustering,omitempty"`
	DisabledFeatures      []string              `yaml:"disabled_features,omitempty" json:"disabledFeatures,omitempty"`
	IstioAnnotationAction bool                  `yaml:"istio_annotation_action,omitempty" json:"istioAnnotationAction"`
	IstioInjectionAction  bool                  `yaml:"istio_injection_action,omitempty" json:"istioInjectionAction"`
	IstioUpgradeAction    bool                  `yaml:"istio_upgrade_action,omitempty" json:"istioUpgradeAction"`
	UIDefaults            UIDefaults            `yaml:"ui_defaults,omitempty" json:"uiDefaults,omitempty"`
	Validations           Validations           `yaml:"validations,omitempty" json:"validations,omitempty"`
}

// Tolerance config
type Tolerance struct {
	Code      string  `yaml:"code,omitempty" json:"code"`
	Degraded  float32 `yaml:"degraded,omitempty" json:"degraded"`
	Failure   float32 `yaml:"failure,omitempty" json:"failure"`
	Protocol  string  `yaml:"protocol,omitempty" json:"protocol"`
	Direction string  `yaml:"direction,omitempty" json:"direction"`
}

// Rate config
type Rate struct {
	Namespace string      `yaml:"namespace,omitempty" json:"namespace,omitempty"`
	Kind      string      `yaml:"kind,omitempty" json:"kind,omitempty"`
	Name      string      `yaml:"name,omitempty" json:"name,omitempty"`
	Tolerance []Tolerance `yaml:"tolerance,omitempty" json:"tolerance"`
}

// HealthConfig rates
type HealthConfig struct {
	Rate []Rate `yaml:"rate,omitempty" json:"rate,omitempty"`
}

// Profiler provides settings about the profiler that can be used to debug the Kiali server internals.
type Profiler struct {
	Enabled bool `yaml:"enabled,omitempty"`
}

type RunMode string

const (
	RunModeLocal RunMode = "local"
	RunModeApp   RunMode = "app"
)

// Config defines full YAML configuration.
type Config struct {
	AdditionalDisplayDetails []AdditionalDisplayItem             `yaml:"additional_display_details,omitempty"`
	Auth                     AuthConfig                          `yaml:"auth,omitempty"`
	Clustering               Clustering                          `yaml:"clustering,omitempty"`
	CustomDashboards         dashboards.MonitoringDashboardsList `yaml:"custom_dashboards,omitempty"`
	Deployment               DeploymentConfig                    `yaml:"deployment,omitempty"`
	Extensions               []ExtensionConfig                   `yaml:"extensions,omitempty"`
	ExternalServices         ExternalServices                    `yaml:"external_services,omitempty"`
	HealthConfig             HealthConfig                        `yaml:"health_config,omitempty" json:"healthConfig,omitempty"`
	Identity                 security.Identity                   `yaml:",omitempty"`
	InstallationTag          string                              `yaml:"installation_tag,omitempty"`
	IstioLabels              IstioLabels                         `yaml:"istio_labels,omitempty"`
	KialiFeatureFlags        KialiFeatureFlags                   `yaml:"kiali_feature_flags,omitempty"`
	KialiInternal            KialiInternalConfig                 `yaml:"kiali_internal,omitempty"`
	KubernetesConfig         KubernetesConfig                    `yaml:"kubernetes_config,omitempty"`
	LoginToken               LoginToken                          `yaml:"login_token,omitempty"`
	Server                   Server                              `yaml:",omitempty"`
	RunMode                  RunMode                             `yaml:"runMode,omitempty"`
}

// NewConfig creates a default Config struct
func NewConfig() (c *Config) {
	c = &Config{
		Auth: AuthConfig{
			Strategy: AuthStrategyToken,
			OpenId: OpenIdConfig{
				AdditionalRequestParams: map[string]string{},
				AllowedDomains:          []string{},
				ApiProxy:                "",
				ApiProxyCAData:          "",
				ApiToken:                "id_token",
				AuthenticationTimeout:   300,
				AuthorizationEndpoint:   "",
				ClientId:                "",
				ClientSecret:            "",
				DisableRBAC:             false,
				InsecureSkipVerifyTLS:   false,
				IssuerUri:               "",
				Scopes:                  []string{"openid", "profile", "email"},
				UsernameClaim:           "sub",
			},
			OpenShift: OpenShiftConfig{
				InsecureSkipVerifyTLS: false,
			},
		},
		Clustering: Clustering{
			IgnoreHomeCluster: false,
		},
		CustomDashboards: dashboards.GetBuiltInMonitoringDashboards(),
		Deployment: DeploymentConfig{
			certPool:           x509.NewCertPool(),
			ClusterWideAccess:  true,
			DiscoverySelectors: DiscoverySelectorsConfig{Default: nil, Overrides: nil},
			InstanceName:       "kiali",
			Namespace:          IstioNamespaceDefault,
			ViewOnlyMode:       false,
		},
		ExternalServices: ExternalServices{
			CustomDashboards: CustomDashboardsConfig{
				DiscoveryEnabled:       DashboardsDiscoveryAuto,
				DiscoveryAutoThreshold: 10,
				Enabled:                true,
				IsCore:                 false,
				NamespaceLabel:         "namespace",
				Prometheus: PrometheusConfig{
					ThanosProxy: ThanosProxy{
						Enabled: false,
					},
				},
			},
			Grafana: GrafanaConfig{
				Auth: Auth{
					Type: AuthTypeNone,
				},
				Enabled:     true,
				InternalURL: "http://grafana.istio-system:3000",
				IsCore:      false,
			},
			Istio: IstioConfig{
				ComponentStatuses: ComponentStatuses{
					Enabled: true,
					// Leaving default Components values empty
					// Istio components are auto discovered and status is checked
					// Components config is left for custom components status check
					Components: []ComponentStatus{},
				},
				IstioAPIEnabled:                  true,
				IstioIdentityDomain:              "svc.cluster.local",
				IstiodPollingIntervalSeconds:     20,
				ValidationChangeDetectionEnabled: true,
				ValidationReconcileInterval:      util.AsPtr(time.Minute),
				GatewayAPIClasses:                []GatewayAPIClass{},
			},
			Perses: PersesConfig{
				Auth: Auth{
					Type: AuthTypeNone,
				},
				Enabled:     false,
				InternalURL: "http://perses.istio-system:4000",
				IsCore:      false,
				Project:     "istio",
			},
			Prometheus: PrometheusConfig{
				Auth: Auth{
					Type: AuthTypeNone,
				},
				// 1/2 Prom Scrape Interval
				CacheDuration: 7,
				CacheEnabled:  true,
				// Prom Cache expires and it forces to repopulate cache
				CacheExpiration: 300,
				CustomHeaders:   map[string]string{},
				QueryScope:      map[string]string{},
				ThanosProxy: ThanosProxy{
					Enabled:         false,
					RetentionPeriod: "7d",
					ScrapeInterval:  "30s",
				},
				URL: "http://prometheus.istio-system:9090",
			},
			Tracing: TracingConfig{
				Auth: Auth{
					Type: AuthTypeNone,
				},
				CustomHeaders:       map[string]string{},
				DisableVersionCheck: false,
				Enabled:             false,
				ExternalURL:         "",
				GrpcPort:            9095,
				InternalURL:         "http://tracing.istio-system:16685/jaeger",
				IsCore:              false,
				Provider:            JaegerProvider,
				NamespaceSelector:   true,
				QueryScope:          map[string]string{},
				QueryTimeout:        5,
				TempoConfig: TempoConfig{
					CacheCapacity: 200,
					CacheEnabled:  true,
				},
				UseGRPC:              true,
				WhiteListIstioSystem: []string{"jaeger-query", "istio-ingressgateway"},
			},
		},
		IstioLabels: IstioLabels{
			AmbientNamespaceLabel:       "istio.io/dataplane-mode",
			AmbientNamespaceLabelValue:  "ambient",
			AmbientWaypointGatewayLabel: GatewayLabel,
			AmbientWaypointUseLabel:     WaypointUseLabel,
			AppLabelName:                "",
			InjectionLabelName:          "istio-injection",
			InjectionLabelRev:           IstioRevisionLabel,
			ServiceCanonicalName:        "service.istio.io/canonical-name",
			ServiceCanonicalRevision:    "service.istio.io/canonical-revision",
			VersionLabelName:            "",
		},
		KialiFeatureFlags: KialiFeatureFlags{
			Clustering: FeatureFlagClustering{
				EnableExecProvider: false,
			},
			DisabledFeatures:      []string{},
			IstioAnnotationAction: true,
			IstioInjectionAction:  true,
			IstioUpgradeAction:    false,
			UIDefaults: UIDefaults{
				Graph: GraphUIDefaults{
					FindOptions: []GraphFindOption{
						{
							Description: "Find: slow edges (> 1s)",
							Expression:  "rt > 1000",
						},
						{
							Description: "Find: unhealthy nodes",
							Expression:  "! healthy",
						},
						{
							Description: "Find: unknown nodes",
							Expression:  "name = unknown",
						},
						{
							Description: "Find: nodes with the 2 top rankings",
							Expression:  "rank <= 2",
						},
					},
					HideOptions: []GraphFindOption{
						{
							Description: "Hide: healthy nodes",
							Expression:  "healthy",
						},
						{
							Description: "Hide: unknown nodes",
							Expression:  "name = unknown",
						},
						{
							Description: "Hide: nodes ranked lower than the 2 top rankings",
							Expression:  "rank > 2",
						},
					},
					Settings: GraphSettings{
						Animation: "point",
					},
					Traffic: GraphTraffic{
						Ambient: "total",
						Grpc:    "requests",
						Http:    "requests",
						Tcp:     "sent",
					},
				},
				I18n: I18nUIDefaults{
					Language:     "en",
					ShowSelector: false,
				},
				List: ListUIDefaults{
					IncludeHealth:         true,
					IncludeIstioResources: true,
					IncludeValidations:    true,
					ShowIncludeToggles:    false,
				},
				Mesh: MeshUIDefaults{
					FindOptions: []GraphFindOption{
						{
							Description: "Find: unhealthy nodes",
							Expression:  "! healthy",
						},
					},
					HideOptions: []GraphFindOption{
						{
							Description: "Hide: healthy nodes",
							Expression:  "healthy",
						},
					},
				},
				MetricsInbound:    MetricsDefaults{},
				MetricsOutbound:   MetricsDefaults{},
				MetricsPerRefresh: "1m",
				Namespaces:        make([]string, 0),
				RefreshInterval:   "1m",
				Tracing:           TracingDefaults{Limit: 100},
			},
			Validations: Validations{
				Ignore: make([]string, 0),
			},
		},
		KialiInternal: KialiInternalConfig{
			CacheExpiration: CacheExpirationConfig{
				AmbientCheck:  10 * time.Minute,
				Gateway:       4 * time.Minute,
				IstioStatus:   30 * time.Second, // Set to 0 to disable
				Mesh:          20 * time.Second,
				Waypoint:      4 * time.Minute,
				ZtunnelConfig: 2 * time.Minute,
			},
			MetricLogDurationLimit: 3 * time.Second, // set to 0 to log everything
		},
		KubernetesConfig: KubernetesConfig{
			Burst:                       200,
			CacheDuration:               5 * 60,
			CacheTokenNamespaceDuration: 10,
			ClusterName:                 "", // leave this unset as a flag that we need to fetch the information
			ExcludeWorkloads:            []string{"CronJob", "DeploymentConfig", "Job", "ReplicationController"},
			QPS:                         175,
		},
		LoginToken: LoginToken{
			ExpirationSeconds: 24 * 3600,
			SigningKey:        "kiali",
		},
		Server: Server{
			AuditLog:    true,
			GzipEnabled: true,
			Observability: Observability{
				Metrics: Metrics{
					Enabled: true,
					Port:    9090,
				},
				Tracing: Tracing{
					CollectorType: OTELCollectorType,
					CollectorURL:  "jaeger-collector.istio-system:4318",
					Enabled:       false,
					Otel: OtelCollector{
						CAName:     "",
						Protocol:   "http",
						SkipVerify: false,
						TLSEnabled: false,
					},
					// Sample half of traces.
					SamplingRate: 0.5,
				},
			},
			Port:           20001,
			RequireAuth:    false,
			WebFQDN:        "",
			WebRoot:        "/",
			WebHistoryMode: "browser",
			WebSchema:      "",
			WriteTimeout:   30,
		},
		RunMode: RunModeApp,
	}

	return
}

// AddHealthDefault Configuration
func (conf *Config) AddHealthDefault() {
	// Health default configuration
	healthConfig := HealthConfig{
		Rate: []Rate{
			{
				Tolerance: []Tolerance{
					{
						Code:      "5XX",
						Protocol:  "http",
						Direction: ".*",
						Failure:   10,
					},
					{
						Code:      "4XX",
						Protocol:  "http",
						Direction: ".*",
						Degraded:  10,
						Failure:   20,
					},
					{
						Code:      "^[1-9]$|^1[0-6]$",
						Protocol:  "grpc",
						Direction: ".*",
						Failure:   10,
					},
					{
						Code:      "^-$", // no response is indicated with a "-" code
						Protocol:  "http|grpc",
						Direction: ".*",
						Failure:   10,
					},
				},
			},
		},
	}
	conf.HealthConfig.Rate = append(conf.HealthConfig.Rate, healthConfig.Rate...)
}

// AllNamespacesAccessible determines if kiali has access to all namespaces.
func (conf *Config) AllNamespacesAccessible() bool {
	return conf.Deployment.ClusterWideAccess
}

// IsServerHTTPS returns true if the server endpoint should use HTTPS. If false, only plaintext HTTP is supported.
func (conf *Config) IsServerHTTPS() bool {
	return conf.Identity.CertFile != "" && conf.Identity.PrivateKeyFile != ""
}

func (conf *Config) IsRBACDisabled() bool {
	return conf.Auth.Strategy == AuthStrategyAnonymous ||
		(conf.Auth.Strategy == AuthStrategyOpenId && conf.Auth.OpenId.DisableRBAC)
}

// Get the global Config
func Get() (conf *Config) {
	rwMutex.RLock()
	defer rwMutex.RUnlock()
	copy := configuration
	return &copy
}

// Set the global Config
// This function should not be called outside of main or tests.
// If possible keep config unmutated and use globals and/or appstate package for mutable states to avoid concurrent writes risk.
func Set(conf *Config) {
	rwMutex.Lock()
	defer rwMutex.Unlock()
	conf.AddHealthDefault()
	configuration = *conf

	// init these one time, they don't change
	if appLabelNames == nil {
		if conf.IstioLabels.AppLabelName != "" && conf.IstioLabels.VersionLabelName != "" {
			appLabelNames = []string{conf.IstioLabels.AppLabelName}
			versionLabelNames = []string{conf.IstioLabels.VersionLabelName}
		} else {
			appLabelNames = []string{conf.IstioLabels.ServiceCanonicalName, "app.kubernetes.io/name", "app"}
			versionLabelNames = []string{conf.IstioLabels.ServiceCanonicalRevision, "app.kubernetes.io/version", "version"}
		}
	}
}

func (conf Config) Obfuscate() (obf Config) {
	obf = conf
	obf.ExternalServices.Grafana.Auth.Obfuscate()
	obf.ExternalServices.Perses.Auth.Obfuscate()
	obf.ExternalServices.Prometheus.Auth.Obfuscate()
	obf.ExternalServices.Tracing.Auth.Obfuscate()
	obf.ExternalServices.CustomDashboards.Prometheus.Auth.Obfuscate()
	obf.Identity.Obfuscate()
	obf.LoginToken.Obfuscate()
	obf.Auth.OpenId.ClientSecret = "xxx"
	return
}

// String marshals the given Config into a YAML string
// WARNING: do NOT use the result of this function to retrieve any configuration: some fields are obfuscated for security reasons.
func (conf Config) String() (str string) {
	obf := conf.Obfuscate()
	str, err := Marshal(&obf)
	if err != nil {
		str = fmt.Sprintf("Failed to marshal config to string. err=%v", err)
		log.Debugf("%s", str)
	}

	return
}

// prepareDashboards will ensure conf.CustomDashboards contains only the dashboards that are enabled
func (conf *Config) prepareDashboards() {
	if conf.ExternalServices.CustomDashboards.Enabled {
		// If the user defined their own dashboards, we still want the built-in dashboards as a fallback.
		// But the user-defined dashboards take precedence - if they gave us dashboards with the same name
		// as one of the built-in dashboards, the user-defined dashboard "wins".
		conf.CustomDashboards = dashboards.AddMonitoringDashboards(dashboards.GetBuiltInMonitoringDashboards(), conf.CustomDashboards)
	} else {
		// The user has disabled the custom dashboards, empty out the list completely
		conf.CustomDashboards = dashboards.MonitoringDashboardsList(make([]dashboards.MonitoringDashboard, 0))
	}

	// to assist in debugging problems, log the number of dashboards and their names
	if log.IsDebug() {
		dashboardNames := make([]string, 0, len(conf.CustomDashboards))
		for _, d := range conf.CustomDashboards {
			dashboardNames = append(dashboardNames, d.Name)
		}
		sort.Strings(dashboardNames)
		log.Debugf("Custom dashboards [count=%v, enabled=%v]: %v", len(dashboardNames), conf.ExternalServices.CustomDashboards.Enabled, strings.Join(dashboardNames, ","))
	}
}

// loadCertPool loads system certs and additional CAs from config.
func (conf *Config) loadCertPool(additionalCABundlePaths ...string) error {
	if certPool, err := x509.SystemCertPool(); err != nil {
		log.Warningf("Unable to load system cert pool. Falling back to empty cert pool. Error: %s", err)
	} else {
		conf.Deployment.certPool = certPool
	}

	for _, path := range additionalCABundlePaths {
		if _, err := os.Stat(path); err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				log.Debugf("Additional CA bundle %s does not exist. Skipping", path)
			} else {
				log.Debugf("Unable to read additional CA bundle %s. Skipping", path)
			}
			continue
		}

		log.Tracef("Adding CA bundle %s to pool", path)
		bundle, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("unable to read CA bundle '%s': %s", path, err)
		}

		if !conf.Deployment.certPool.AppendCertsFromPEM(bundle) {
			return fmt.Errorf("unable to append PEM bundle from file '%s': %s", path, err)
		}
	}

	return nil
}

// Unmarshal parses the given YAML string and returns its Config object representation.
func Unmarshal(yamlString string) (conf *Config, err error) {
	conf = NewConfig()
	err = yaml.Unmarshal([]byte(yamlString), &conf)
	if err != nil {
		return nil, fmt.Errorf("failed to parse yaml data. error=%v", err)
	}

	// Determine what the accessible namespaces are. These are namespaces we must have permission to see
	// when not in cluster-wide access mode. These are only necessary when we are not in cluster-wide access mode.
	// We do not set this when in cluster-wide mode because in that case we have access to see everything.
	// Note that in past versions "accessible_namespaces" came over in the yaml itself, but that is no longer the case.
	// Accessible namespaces can now be derived from discovery selectors so long as they are specified in a specific way.
	// See the comments found in extractAccessibleNamespaceList for more details.
	if !conf.Deployment.ClusterWideAccess {
		conf.Deployment.AccessibleNamespaces, err = conf.extractAccessibleNamespaceList()
		if err != nil {
			return nil, err
		}
	}

	conf.prepareDashboards()

	additionalCABundles := []string{additionalCABundle}
	// Auth strategy isn't a great proxy for whether the cluster is running on openshift or not
	// but the config is the very first thing loaded so we don't have access to a client.
	if conf.Auth.Strategy == AuthStrategyOpenshift {
		additionalCABundles = append(additionalCABundles, openshiftServingCAFromSA, openshiftServingCA)
	}
	if err := conf.loadCertPool(additionalCABundles...); err != nil {
		return nil, fmt.Errorf("unable to load cert pool. Check additional CAs specified at %s and ensure the file is properly formatted: %s",
			strings.Join(additionalCABundles, ","), err)
	}

	// TODO: Still support deprecated settings, but remove this support in future versions
	if conf.ExternalServices.Grafana.XInClusterURL != "" {
		conf.ExternalServices.Grafana.InternalURL = conf.ExternalServices.Grafana.XInClusterURL
		log.Info("DEPRECATION NOTICE: 'external_services.grafana.in_cluster_url' has been deprecated - switch to 'external_services.grafana.internal_url'")
	}
	if conf.ExternalServices.Grafana.XURL != "" {
		conf.ExternalServices.Grafana.ExternalURL = conf.ExternalServices.Grafana.XURL
		log.Info("DEPRECATION NOTICE: 'external_services.grafana.url' has been deprecated - switch to 'external_services.grafana.external_url'")
	}
	if conf.ExternalServices.Tracing.XInClusterURL != "" {
		conf.ExternalServices.Tracing.InternalURL = conf.ExternalServices.Tracing.XInClusterURL
		log.Info("DEPRECATION NOTICE: 'external_services.tracing.in_cluster_url' has been deprecated - switch to 'external_services.tracing.internal_url'")
	}
	if conf.ExternalServices.Tracing.XURL != "" {
		conf.ExternalServices.Tracing.ExternalURL = conf.ExternalServices.Tracing.XURL
		log.Info("DEPRECATION NOTICE: 'external_services.tracing.url' has been deprecated - switch to 'external_services.tracing.external_url'")
	}
	if conf.ExternalServices.Perses.Enabled && conf.ExternalServices.Perses.Auth.Type != AuthTypeBasic {
		log.Errorf("Perses authentication not supported %s", conf.ExternalServices.Perses.Auth.Type)
	}

	// Validate tracing min and max values
	if conf.KialiFeatureFlags.UIDefaults.Tracing.Limit < 10 || conf.KialiFeatureFlags.UIDefaults.Tracing.Limit > 1000 {
		return nil, fmt.Errorf("KialiFeatureFlags.UIDefaults.Tracing.Limit should be between 10 and 1000")
	}

	// Some config settings (such as sensitive settings like passwords) are overrideable
	// via secrets mounted on the file system rather than storing them directly in the config map itself.
	// The names of the files in /kiali-override-secrets denote which credentials they are.
	type overridesType struct {
		configValue *string
		fileName    string
	}

	overrides := []overridesType{
		{
			configValue: &conf.ExternalServices.Grafana.Auth.Username,
			fileName:    SecretFileGrafanaUsername,
		},
		{
			configValue: &conf.ExternalServices.Grafana.Auth.Password,
			fileName:    SecretFileGrafanaPassword,
		},
		{
			configValue: &conf.ExternalServices.Grafana.Auth.Token,
			fileName:    SecretFileGrafanaToken,
		},
		{
			configValue: &conf.ExternalServices.Perses.Auth.Username,
			fileName:    SecretFilePersesUsername,
		},
		{
			configValue: &conf.ExternalServices.Perses.Auth.Password,
			fileName:    SecretFilePersesPassword,
		},
		{
			configValue: &conf.ExternalServices.Prometheus.Auth.Username,
			fileName:    SecretFilePrometheusUsername,
		},
		{
			configValue: &conf.ExternalServices.Prometheus.Auth.Password,
			fileName:    SecretFilePrometheusPassword,
		},
		{
			configValue: &conf.ExternalServices.Prometheus.Auth.Token,
			fileName:    SecretFilePrometheusToken,
		},
		{
			configValue: &conf.ExternalServices.Tracing.Auth.Username,
			fileName:    SecretFileTracingUsername,
		},
		{
			configValue: &conf.ExternalServices.Tracing.Auth.Password,
			fileName:    SecretFileTracingPassword,
		},
		{
			configValue: &conf.ExternalServices.Tracing.Auth.Token,
			fileName:    SecretFileTracingToken,
		},
		{
			configValue: &conf.LoginToken.SigningKey,
			fileName:    SecretFileLoginTokenSigningKey,
		},
		{
			configValue: &conf.ExternalServices.CustomDashboards.Prometheus.Auth.Username,
			fileName:    SecretFileCustomDashboardsPrometheusUsername,
		},
		{
			configValue: &conf.ExternalServices.CustomDashboards.Prometheus.Auth.Password,
			fileName:    SecretFileCustomDashboardsPrometheusPassword,
		},
		{
			configValue: &conf.ExternalServices.CustomDashboards.Prometheus.Auth.Token,
			fileName:    SecretFileCustomDashboardsPrometheusToken,
		},
	}

	for _, override := range overrides {
		fullFileName := overrideSecretsDir + "/" + override.fileName + "/value.txt"
		b, err := os.ReadFile(fullFileName)
		if err == nil {
			fileContents := string(b)
			if fileContents != "" {
				*override.configValue = fileContents
				log.Debugf("Credentials loaded from secret file [%s]", fullFileName)
			} else {
				log.Errorf("The credentials were empty in secret file [%s]", fullFileName)
			}
		} else if !errors.Is(err, os.ErrNotExist) {
			log.Errorf("Failed reading secret file [%s]: %v", fullFileName, err)
		}
	}

	return
}

// Marshal converts the Config object and returns its YAML string.
func Marshal(conf *Config) (yamlString string, err error) {
	yamlBytes, err := yaml.Marshal(&conf)
	if err != nil {
		return "", fmt.Errorf("failed to produce yaml. error=%v", err)
	}

	yamlString = string(yamlBytes)
	return
}

// LoadFromFile reads the YAML from the given file, parses the content, and returns its Config object representation.
func LoadFromFile(filename string) (conf *Config, err error) {
	log.Debugf("Reading YAML config from [%s]", filename)
	fileContent, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to load config file [%v]. error=%v", filename, err)
	}

	conf, err = Unmarshal(string(fileContent))
	if err != nil {
		return
	}

	// Read OIDC secret, if present
	if oidcSecret, oidcErr := os.ReadFile(OidcClientSecretFile); oidcErr == nil {
		conf.Auth.OpenId.ClientSecret = string(oidcSecret)
	} else {
		if !os.IsNotExist(oidcErr) {
			err = fmt.Errorf("failed to OIDC client secret file [%v]. error=%v", OidcClientSecretFile, oidcErr)
		}

		// ...else, if error indicates that secret does not exist, then ignore because the secret is optional
	}

	return
}

// SaveToFile converts the Config object and stores its YAML string into the given file, overwriting any data that is in the file.
func SaveToFile(filename string, conf *Config) (err error) {
	fileContent, err := Marshal(conf)
	if err != nil {
		return fmt.Errorf("failed to save config file [%v]. error=%v", filename, err)
	}

	log.Debugf("Writing YAML config to [%s]", filename)
	err = os.WriteFile(filename, []byte(fileContent), 0o640)
	return
}

// IsFeatureDisabled will return true if the named feature is to be disabled.
func IsFeatureDisabled(featureName FeatureName) bool {
	conf := Get()
	for _, f := range conf.KialiFeatureFlags.DisabledFeatures {
		if f == string(featureName) {
			return true
		}
	}
	return false
}

// IsWaypoint returns true if the labels indicate a waypoint.
func IsWaypoint(labels map[string]string) bool {
	// test for Istio waypoint labeling
	if labels[WaypointLabel] == WaypointLabelValue {
		return true
	}
	// test for K8s GW API labeling with waypoint name
	// note - this is weak but maybe sufficient as a required convention. I think the real
	//        way to do this would be to use the Gateway config and test to see if
	//        gatewayClassName contained "waypoint". But that involves config
	//
	if gatewayName, ok := labels[GatewayLabel]; ok {
		return strings.Contains(strings.ToLower(gatewayName), "waypoint")
	}

	return false
}

// IsGateway returns true if the labels indicate a gateway.
func IsGateway(labels, templateAnnotations map[string]string) bool {
	// test for Istio gateway labeling
	// There's not consistent labeling for gateways.
	// In case of using istioctl, you get:
	// istio: ingressgateway
	// or
	// istio: egressgateway
	//
	// In case of using helm, you get:
	// istio: <gateway-name>
	//
	// In case of gateway injection you get:
	// istio: <gateway-name>
	//
	// In case of gateway-api you get:
	// istio.io/gateway-name: gateway
	//
	// In case of east/west gateways you get:
	// istio: eastwestgateway
	//
	// We're going to do different checks for all the ways you can label/deploy gateways

	// istioctl
	if labelValue, ok := labels["operator.istio.io/component"]; ok && (labelValue == "IngressGateways" || labelValue == "EgressGateways") {
		return true
	}

	// There's a lot of unit tests that look specifically for istio: ingressgateway and istio: egressgateway.
	// These should be covered by istioctl and gateway injection cases but adding checks for these just in case.
	if labelValue, ok := labels["istio"]; ok && (labelValue == "ingressgateway" || labelValue == "egressgateway") {
		return true
	}

	// Gateway injection. Includes helm because the helm template uses gateway injection.
	// If the pod injection template is a gateway then it's a gateway.
	if templateAnnotations != nil && templateAnnotations["inject.istio.io/templates"] == "gateway" {
		return true
	}

	// gateway-api
	// This is the old gateway-api label that was removed in 1.24.
	// If this label exists then it's a gateway
	if _, ok := labels["istio.io/gateway-name"]; ok {
		return true
	}

	// This is the new gateway-api label that was added in 1.24
	// The value distinguishes gateways from waypoints.
	if labels["gateway.istio.io/managed"] == "istio.io-gateway-controller" {
		return true
	}

	return false
}

// GetSafeClusterName checks the input value provides a default cluster name if it's empty
func GetSafeClusterName(cluster string) string {
	if cluster == "" {
		return Get().KubernetesConfig.ClusterName
	}
	return cluster
}

// IsValidationsEnabled checks the value of ValidationReconcileInternal
// Validations are enabled for values higher than 0, otherwise validations will be disabled
func (conf Config) IsValidationsEnabled() bool {
	return conf.ExternalServices.Istio.ValidationReconcileInterval != nil && *conf.ExternalServices.Istio.ValidationReconcileInterval > 0
}

// Validate will ensure the config is valid. This should be called after the config
// is initialized and before the config is used.
func Validate(conf *Config) error {
	if conf.Server.Port < 0 {
		return fmt.Errorf("server port is negative: %v", conf.Server.Port)
	}

	webRoot := conf.Server.WebRoot
	if !validPathRegEx.MatchString(webRoot) {
		return fmt.Errorf("web root must begin with a / and contain valid URL path characters: %v", webRoot)
	}
	if webRoot != "/" && strings.HasSuffix(webRoot, "/") {
		return fmt.Errorf("web root must not contain a trailing /: %v", webRoot)
	}
	if strings.Contains(webRoot, "/../") {
		return fmt.Errorf("for security purposes, web root must not contain '/../': %v", webRoot)
	}

	// log some messages to let the administrator know when credentials are configured certain ways
	auth := conf.Auth
	log.Infof("Using authentication strategy [%v]", auth.Strategy)
	if auth.Strategy == AuthStrategyAnonymous {
		log.Warningf("Kiali auth strategy is configured for anonymous access - users will not be authenticated.")
	} else if auth.Strategy != AuthStrategyOpenId &&
		auth.Strategy != AuthStrategyOpenshift &&
		auth.Strategy != AuthStrategyToken &&
		auth.Strategy != AuthStrategyHeader {
		return fmt.Errorf("invalid authentication strategy [%v]", auth.Strategy)
	}

	// Check the ciphering key for sessions
	signingKey := conf.LoginToken.SigningKey
	if err := validateSigningKey(signingKey, auth.Strategy); err != nil {
		return err
	}

	// log a warning if the user is ignoring some validations
	if len(conf.KialiFeatureFlags.Validations.Ignore) > 0 {
		log.Infof("Some validation errors will be ignored %v. If these errors do occur, they will still be logged. If you think the validation errors you see are incorrect, please report them to the Kiali team if you have not done so already and provide the details of your scenario. This will keep Kiali validations strong for the whole community.", conf.KialiFeatureFlags.Validations.Ignore)
	}

	// log a info message if the user is disabling some features
	if len(conf.KialiFeatureFlags.DisabledFeatures) > 0 {
		log.Infof("Some features are disabled: [%v]", strings.Join(conf.KialiFeatureFlags.DisabledFeatures, ","))
		for _, fn := range conf.KialiFeatureFlags.DisabledFeatures {
			if err := FeatureName(fn).IsValid(); err != nil {
				return err
			}
		}
	}

	// Check the observability section
	observTracing := conf.Server.Observability.Tracing
	// If collector is not defined it would be the default "otel"
	if observTracing.Enabled && observTracing.CollectorType != OTELCollectorType {
		return fmt.Errorf("error in configuration options getting the observability exporter. Invalid collector type [%s]", observTracing.CollectorType)
	}

	// Check the tracing section
	cfgTracing := conf.ExternalServices.Tracing
	if cfgTracing.Enabled && cfgTracing.Provider != JaegerProvider && cfgTracing.Provider != TempoProvider {
		return fmt.Errorf("error in configuration options for the external services tracing provider. Invalid provider type [%s]", cfgTracing.Provider)
	}

	return nil
}

func validateSigningKey(signingKey string, authStrategy string) error {
	if authStrategy != AuthStrategyAnonymous {
		if len(signingKey) != 16 && len(signingKey) != 24 && len(signingKey) != 32 {
			return errors.New("signing key for sessions must be 16, 24 or 32 bytes length")
		}
	}

	return nil
}

// extractAccessibleNamespaceList will take the default set of discovery selectors from the config and build a
// list of namespace names by using all discovery selectors that look for matches of the label "kubernetes.io/metadata.name".
// This means if a matchLabels wants to match a value on the label "kubernetes.io/metadata.name" or a single matchExpressions
// wants to match key="kubernetes.io/metadata.name" with operator="In" with a single value defined, the value is assumed
// to be an accessible namespace that will be added to the list that is returned. Note you can have multiple values for
// an "In" expression - each value will be considered an accessible namespace.
// Examples:
//
//	default:
//	- matchLabels:
//	    kubernetes.io/metadata.name: an-accessible-namespace
//	- matchExpressions:
//	  - key: kubernetes.io/metadata.name
//	    operator: In
//	    values: ["another-accessible-namespace"]
//	- matchExpressions:
//	  - key: kubernetes.io/metadata.name
//	    operator: In
//	    values: ["accessible-1", "accessible-2", "a-third-accessible-namespace"]
//
// When the Kiali Server is not in Cluster Wide Access mode, it is assumed (required, in fact) that all the
// default discovery selectors only use match criteria as explained above.
// This function therefore is used to obtain a list of accessible namespaces from the discovery selectors when CWA=false.
func (config *Config) extractAccessibleNamespaceList() ([]string, error) {
	errs := make([]string, 0)
	namespaceNames := make([]string, 0)
	for _, selector := range config.Deployment.DiscoverySelectors.Default {
		if len(selector.MatchLabels) > 0 && len(selector.MatchExpressions) > 0 {
			errs = append(errs, fmt.Sprintf("invalid accessible namespace discovery selector: one label selector cannot have both an equality-based and a set-based selector: %v", selector))
		} else if len(selector.MatchLabels) > 1 {
			errs = append(errs, fmt.Sprintf("invalid accessible namespace discovery selector: matchLabel selector must match one and only one label named kubernetes.io/metadata.name: %v", selector))
		} else if len(selector.MatchExpressions) > 1 {
			errs = append(errs, fmt.Sprintf("invalid accessible namespace discovery selectors: matchExpressions selector must match one and only one label named kubernetes.io/metadata.name using the IN operator: %v", selector))
		} else if len(selector.MatchLabels) == 1 {
			if namespaceName, ok := selector.MatchLabels["kubernetes.io/metadata.name"]; ok {
				namespaceNames = append(namespaceNames, namespaceName)
			} else {
				errs = append(errs, fmt.Sprintf("invalid accessible namespace discovery selector: matchLabel selector must match the label named kubernetes.io/metadata.name: %v", selector))
			}
		} else if len(selector.MatchExpressions) == 1 {
			expr := selector.MatchExpressions[0]
			if len(expr.Values) > 0 {
				if expr.Key == "kubernetes.io/metadata.name" && expr.Operator == metav1.LabelSelectorOpIn {
					namespaceNames = append(namespaceNames, expr.Values...)
				} else {
					errs = append(errs, fmt.Sprintf("invalid accessible namespace discovery selectors: matchExpressions selector must match the label named kubernetes.io/metadata.name using the IN operator: %v", selector))
				}
			} else {
				errs = append(errs, fmt.Sprintf("invalid accessible namespace discovery selectors: matchExpressions selector must match at least one value for label named kubernetes.io/metadata.name using the IN operator: %v", selector))
			}
		}
	}

	if len(errs) == 0 {
		return namespaceNames, nil
	} else {
		return namespaceNames, errors.New(strings.Join(errs, "\n"))
	}
}

type AppVersionLabelSelector struct {
	AppLabelName     string
	LabelSelector    string
	Requirements     map[string]string
	VersionLabelName string
}

var appLabelNames, versionLabelNames []string

// GetAppVersionLabelSelectors takes an app and/or version value and returns one or
// more label selectors to be subsequently tried via label selector fetched. Callers
// should account for the fact that the same object may be labeled in multiple ways, and
// therefore could be returned by more than one of the returned selectors.
//
// Only one selector is returned if config.IstioLabels.AppLabelName and
// config.IstioLabels.VersionLabelName are set. If they are unset then three selectors will be
// returned, in this order (the same order of preference used by Istio when setting the
// canonical values for telemetry, etc):
//
// [0]   service.istio.io/canonical-name    service.istio.io/canonical-revision
// [1]   app.kubernetes.io/name             app.kubernetes.io/version
// [2]   app                                version
//
// It is assumed that the app and version naming scheme will match for any particular entity.
func (config *Config) GetAppVersionLabelSelectors(app, version string) []AppVersionLabelSelector {
	// if neither app or version are set, just return a single, empty entry
	if app == "" && version == "" {
		return []AppVersionLabelSelector{{
			AppLabelName:     "",
			LabelSelector:    "",
			Requirements:     map[string]string{},
			VersionLabelName: "",
		}}
	}

	labelSelectors := make([]AppVersionLabelSelector, len(appLabelNames))

	for i := 0; i < len(appLabelNames); i++ {
		appLabelName := appLabelNames[i]
		versionLabelName := versionLabelNames[i]
		requirements := map[string]string{}
		if app != "" {
			requirements[appLabelName] = app
		}
		if version != "" {
			requirements[versionLabelName] = version
		}
		labelSelectors[i] = AppVersionLabelSelector{
			AppLabelName:     appLabelName,
			LabelSelector:    labels.Set(requirements).String(),
			Requirements:     requirements,
			VersionLabelName: versionLabelName,
		}
	}

	return labelSelectors
}

// GetAppLabelName returns the app label name found in the labels, and a "found" bool. If
// multiple app label names exist in the labels, the "canonical" app label name is
// returned, using the same preference as Istio.
func (config *Config) GetAppLabelName(labels map[string]string) (string, bool) {
	for i := 0; i < len(appLabelNames); i++ {
		appLabelName := appLabelNames[i]
		if _, ok := labels[appLabelName]; ok {
			return appLabelName, true
		}
	}
	return "", false
}

// GetVersionLabelName returns the version label name found in the labels, and a "found" bool. If
// multiple version label names exist in the labels, the "canonical" version label name is
// returned, using the same preference as Istio.
func (config *Config) GetVersionLabelName(labels map[string]string) (string, bool) {
	for i := 0; i < len(versionLabelNames); i++ {
		versionLabelName := versionLabelNames[i]
		if _, ok := labels[versionLabelName]; ok {
			return versionLabelName, true
		}
	}
	return "", false
}

func (c *Config) CertPool() *x509.CertPool {
	if pool := c.Deployment.certPool; pool != nil {
		return pool.Clone()
	}
	return nil
}

// LoadConfig loads config file if specified, otherwise, relies on environment variables to configure.
// If loading from the file fails then log.Fatal is called.
func LoadConfig(configFilePath string) (*Config, error) {
	var conf *Config

	if configFilePath != "" {
		var err error
		conf, err = LoadFromFile(configFilePath)
		if err != nil {
			return nil, err
		}
		Set(conf)
	} else {
		log.Infof("No configuration file specified. Will rely on environment for configuration.")
		conf = NewConfig()
		Set(conf)
	}

	return conf, nil
}
