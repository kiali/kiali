package config

import (
	"errors"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v2"

	"github.com/kiali/kiali/config/dashboards"
	"github.com/kiali/kiali/config/security"
	"github.com/kiali/kiali/log"
)

// Files found in /kiali-override-secrets that override the ConfigMap yaml values
const (
	// External services auth
	SecretFileGrafanaPassword    = "grafana-password"
	SecretFileGrafanaToken       = "grafana-token"
	SecretFilePrometheusPassword = "prometheus-password"
	SecretFilePrometheusToken    = "prometheus-token"
	SecretFileTracingPassword    = "tracing-password"
	SecretFileTracingToken       = "tracing-token"

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

	TokenCookieName = "kiali-token"

	// These constants are used for external services auth (Prometheus, Grafana ...) ; not for Kiali auth
	AuthTypeBasic  = "basic"
	AuthTypeBearer = "bearer"
	AuthTypeNone   = "none"
)

const (
	IstioMultiClusterHostSuffix = "global"
	OidcClientSecretFile        = "/kiali-secret/oidc-secret"
)

const (
	DashboardsDiscoveryEnabled = "true"
	DashboardsDiscoveryAuto    = "auto"
)

const (
	// DefaultClusterID is generally not for use outside of test-code. In general you should use config.Get().KubernetesConfig.ClusterName
	DefaultClusterID = "Kubernetes"
)

const (
	AmbientAnnotation        = "ambient.istio.io/redirection"
	AmbientAnnotationEnabled = "enabled"
	WaypointLabel            = "gateway.istio.io/managed"
	WaypointLabelValue       = "istio.io-mesh-controller"
	WaypointUseLabel         = "istio.io/use-waypoint"
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
	return fmt.Errorf("Invalid feature name: %v", fn)
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
	Address                    string        `yaml:",omitempty"`
	AuditLog                   bool          `yaml:"audit_log,omitempty"` // When true, allows additional audit logging on Write operations
	CORSAllowAll               bool          `yaml:"cors_allow_all,omitempty"`
	GzipEnabled                bool          `yaml:"gzip_enabled,omitempty"`
	Observability              Observability `yaml:"observability,omitempty"`
	Port                       int           `yaml:",omitempty"`
	Profiler                   Profiler      `yaml:"profiler,omitempty"`
	StaticContentRootDirectory string        `yaml:"static_content_root_directory,omitempty"`
	WebFQDN                    string        `yaml:"web_fqdn,omitempty"`
	WebPort                    string        `yaml:"web_port,omitempty"`
	WebRoot                    string        `yaml:"web_root,omitempty"`
	WebHistoryMode             string        `yaml:"web_history_mode,omitempty"`
	WebSchema                  string        `yaml:"web_schema,omitempty"`
	WriteTimeout               time.Duration `yaml:"write_timeout,omitempty"`
}

// Auth provides authentication data for external services
type Auth struct {
	CAFile             string `yaml:"ca_file"`
	InsecureSkipVerify bool   `yaml:"insecure_skip_verify"`
	Password           string `yaml:"password"`
	Token              string `yaml:"token"`
	Type               string `yaml:"type"`
	UseKialiToken      bool   `yaml:"use_kiali_token"`
	Username           string `yaml:"username"`
}

func (a *Auth) Obfuscate() {
	a.Token = "xxx"
	a.Password = "xxx"
	a.Username = "xxx"
	a.CAFile = "xxx"
}

// ThanosProxy describes configuration of the Thanos proxy component
type ThanosProxy struct {
	Enabled         bool   `yaml:"enabled,omitempty"`
	RetentionPeriod string `yaml:"retention_period,omitempty"`
	ScrapeInterval  string `yaml:"scrape_interval,omitempty"`
}

// PrometheusConfig describes configuration of the Prometheus component
type PrometheusConfig struct {
	Auth            Auth              `yaml:"auth,omitempty"`
	CacheDuration   int               `yaml:"cache_duration,omitempty"`   // Cache duration per query expressed in seconds
	CacheEnabled    bool              `yaml:"cache_enabled,omitempty"`    // Enable cache for Prometheus queries
	CacheExpiration int               `yaml:"cache_expiration,omitempty"` // Global cache expiration expressed in seconds
	CustomHeaders   map[string]string `yaml:"custom_headers,omitempty"`
	HealthCheckUrl  string            `yaml:"health_check_url,omitempty"`
	IsCore          bool              `yaml:"is_core,omitempty"`
	QueryScope      map[string]string `yaml:"query_scope,omitempty"`
	ThanosProxy     ThanosProxy       `yaml:"thanos_proxy,omitempty"`
	URL             string            `yaml:"url,omitempty"`
}

// CustomDashboardsConfig describes configuration specific to Custom Dashboards
type CustomDashboardsConfig struct {
	DiscoveryEnabled       string           `yaml:"discovery_enabled,omitempty"`
	DiscoveryAutoThreshold int              `yaml:"discovery_auto_threshold,omitempty"`
	Enabled                bool             `yaml:"enabled,omitempty"`
	IsCore                 bool             `yaml:"is_core,omitempty"`
	NamespaceLabel         string           `yaml:"namespace_label,omitempty"`
	Prometheus             PrometheusConfig `yaml:"prometheus,omitempty"`
}

// GrafanaConfig describes configuration used for Grafana links
type GrafanaConfig struct {
	Auth           Auth                     `yaml:"auth"`
	Dashboards     []GrafanaDashboardConfig `yaml:"dashboards"`
	Enabled        bool                     `yaml:"enabled"` // Enable or disable Grafana support in Kiali
	HealthCheckUrl string                   `yaml:"health_check_url,omitempty"`
	InClusterURL   string                   `yaml:"in_cluster_url"`
	IsCore         bool                     `yaml:"is_core,omitempty"`
	URL            string                   `yaml:"url"`
}

type GrafanaDashboardConfig struct {
	Name      string                 `yaml:"name"`
	Variables GrafanaVariablesConfig `yaml:"variables"`
}

type GrafanaVariablesConfig struct {
	App       string `yaml:"app" json:"app,omitempty"`
	Namespace string `yaml:"namespace" json:"namespace,omitempty"`
	Service   string `yaml:"service" json:"service,omitempty"`
	Version   string `yaml:"version" json:"version,omitempty"`
	Workload  string `yaml:"workload" json:"workload,omitempty"`
}

type TempoConfig struct {
	OrgID         string `yaml:"org_id" json:"org_id,omitempty"`
	DatasourceUID string `yaml:"datasource_uid" json:"datasource_uid,omitempty"`
}

// TracingConfig describes configuration used for tracing links
type TracingConfig struct {
	Auth                 Auth              `yaml:"auth"`
	CustomHeaders        map[string]string `yaml:"custom_headers,omitempty"`
	Enabled              bool              `yaml:"enabled"` // Enable Tracing in Kiali
	HealthCheckUrl       string            `yaml:"health_check_url,omitempty"`
	GrpcPort             int               `yaml:"grpc_port,omitempty"`
	InClusterURL         string            `yaml:"in_cluster_url"`
	IsCore               bool              `yaml:"is_core,omitempty"`
	Provider             TracingProvider   `yaml:"provider,omitempty"` // jaeger | tempo
	TempoConfig          TempoConfig       `yaml:"tempo_config,omitempty"`
	NamespaceSelector    bool              `yaml:"namespace_selector"`
	QueryScope           map[string]string `yaml:"query_scope,omitempty"`
	QueryTimeout         int               `yaml:"query_timeout,omitempty"`
	URL                  string            `yaml:"url"`
	UseGRPC              bool              `yaml:"use_grpc"`
	WhiteListIstioSystem []string          `yaml:"whitelist_istio_system"`
}

// RegistryConfig contains configuration for connecting to an external istiod.
// This is used when Kiali should connect to the istiod via a url instead of port forwarding.
type RegistryConfig struct {
	IstiodURL string `yaml:"istiod_url"`
	// TODO: Support auth options
}

// IstioConfig describes configuration used for istio links
type IstioConfig struct {
	ComponentStatuses                 ComponentStatuses   `yaml:"component_status,omitempty"`
	ConfigMapName                     string              `yaml:"config_map_name,omitempty"`
	EnvoyAdminLocalPort               int                 `yaml:"envoy_admin_local_port,omitempty"`
	GatewayAPIClasses                 []GatewayAPIClass   `yaml:"gateway_api_classes,omitempty"`
	IstioAPIEnabled                   bool                `yaml:"istio_api_enabled"`
	IstioCanaryRevision               IstioCanaryRevision `yaml:"istio_canary_revision,omitempty"`
	IstioIdentityDomain               string              `yaml:"istio_identity_domain,omitempty"`
	IstioInjectionAnnotation          string              `yaml:"istio_injection_annotation,omitempty"`
	IstioSidecarInjectorConfigMapName string              `yaml:"istio_sidecar_injector_config_map_name,omitempty"`
	IstioSidecarAnnotation            string              `yaml:"istio_sidecar_annotation,omitempty"`
	IstiodDeploymentName              string              `yaml:"istiod_deployment_name,omitempty"`
	IstiodPodMonitoringPort           int                 `yaml:"istiod_pod_monitoring_port,omitempty"`
	// IstiodPollingIntervalSeconds is how often in seconds Kiali will poll istiod(s) for
	// proxy status and registry services. Polling is not performed if IstioAPIEnabled is false.
	IstiodPollingIntervalSeconds int             `yaml:"istiod_polling_interval_seconds,omitempty"`
	Registry                     *RegistryConfig `yaml:"registry,omitempty"`
	RootNamespace                string          `yaml:"root_namespace,omitempty"`
	UrlServiceVersion            string          `yaml:"url_service_version"`
}

type IstioCanaryRevision struct {
	Current string `yaml:"current,omitempty"`
	Upgrade string `yaml:"upgrade,omitempty"`
}

type ComponentStatuses struct {
	Enabled    bool              `yaml:"enabled,omitempty"`
	Components []ComponentStatus `yaml:"components,omitempty"`
}

type ComponentStatus struct {
	AppLabel       string `yaml:"app_label,omitempty"`
	IsCore         bool   `yaml:"is_core,omitempty"`
	IsProxy        bool   `yaml:"is_proxy,omitempty"`
	IsMultiCluster bool   `yaml:"is_multicluster,omitempty"`
	Namespace      string `yaml:"namespace,omitempty"`
}

type GatewayAPIClass struct {
	Name      string `yaml:"name,omitempty" json:"name,omitempty"`
	ClassName string `yaml:"class_name,omitempty" json:"className,omitempty"`
}

// ExternalServices holds configurations for other systems that Kiali depends on
type ExternalServices struct {
	Grafana          GrafanaConfig          `yaml:"grafana,omitempty"`
	Istio            IstioConfig            `yaml:"istio,omitempty"`
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
	AmbientNamespaceLabel      string `yaml:"ambient_namespace_label,omitempty" json:"ambientNamespaceLabel"`
	AmbientNamespaceLabelValue string `yaml:"ambient_namespace_label_value,omitempty" json:"ambientNamespaceLabelValue"`
	AmbientWaypointLabel       string `yaml:"ambient_waypoint_label,omitempty" json:"ambientWaypointLabel"`
	AmbientWaypointLabelValue  string `yaml:"ambient_waypoint_label_value,omitempty" json:"ambientWaypointLabelValue"`
	AppLabelName               string `yaml:"app_label_name,omitempty" json:"appLabelName"`
	InjectionLabelName         string `yaml:"injection_label,omitempty" json:"injectionLabelName"`
	InjectionLabelRev          string `yaml:"injection_label_rev,omitempty" json:"injectionLabelRev"`
	VersionLabelName           string `yaml:"version_label_name,omitempty" json:"versionLabelName"`
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

// ApiConfig contains API specific configuration.
type ApiConfig struct {
	Namespaces ApiNamespacesConfig
}

// ApiNamespacesConfig provides a list of regex strings defining namespaces to include or exclude.
type ApiNamespacesConfig struct {
	Exclude              []string `yaml:"exclude,omitempty" json:"exclude"`
	Include              []string `yaml:"include,omitempty" json:"include"`
	LabelSelectorExclude string   `yaml:"label_selector_exclude,omitempty" json:"labelSelectorExclude"`
	LabelSelectorInclude string   `yaml:"label_selector_include,omitempty" json:"labelSelectorInclude"`
}

// AuthConfig provides details on how users are to authenticate
type AuthConfig struct {
	OpenId    OpenIdConfig    `yaml:"openid,omitempty"`
	OpenShift OpenShiftConfig `yaml:"openshift,omitempty"`
	Strategy  string          `yaml:"strategy,omitempty"`
}

// OpenShiftConfig contains specific configuration for authentication when on OpenShift
type OpenShiftConfig struct {
	CAFile string `yaml:"ca_file,omitempty"`
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
	AccessibleNamespaces []string `yaml:"accessible_namespaces"`
	ClusterWideAccess    bool     `yaml:"cluster_wide_access,omitempty"`
	InstanceName         string   `yaml:"instance_name"`
	Namespace            string   `yaml:"namespace,omitempty"` // Kiali deployment namespace
	ViewOnlyMode         bool     `yaml:"view_only_mode,omitempty"`
	// RemoteSecretPath is used to identify the remote cluster Kiali will connect to as its "local cluster".
	// This is to support installing Kiali in the control plane, but observing only the data plane in the remote cluster.
	// Experimental feature. See: https://github.com/kiali/kiali/issues/3002
	RemoteSecretPath string `yaml:"remote_secret_path,omitempty"`
}

// GraphFindOption defines a single Graph Find/Hide Option
type GraphFindOption struct {
	AutoSelect  bool   `yaml:"auto_select,omitempty" json:"autoSelect,omitempty"`
	Description string `yaml:"description,omitempty" json:"description,omitempty"`
	Expression  string `yaml:"expression,omitempty" json:"expression,omitempty"`
}

// GraphSettings affect the graph visualization.
// FontLabel: font used for node text (edge label font is determined from this value)
// MinFontBadge: smallest effective font (zoomed font) before removing node badges
// MinFontLabel: smallest effective node text font (zoomed font) before removing labels
type GraphSettings struct {
	FontLabel    float32 `yaml:"font_label,omitempty" json:"fontLabel,omitempty"`
	MinFontBadge float32 `yaml:"min_font_badge,omitempty" json:"minFontBadge,omitempty"`
	MinFontLabel float32 `yaml:"min_font_label,omitempty" json:"minFontLabel,omitempty"`
}

// GraphTraffic defines the protocol-specific rates used to determine traffic for graph generation.
// grpc options : none | sent (messages) | received (messages) | requests (default) | total (messages)
// http options : none | requests (default)
// tcp options  : none | sent (bytes, default) | received (bytes) | total (bytes)
type GraphTraffic struct {
	Grpc string `yaml:"grpc,omitempty" json:"grpc,omitempty"`
	Http string `yaml:"http,omitempty" json:"http,omitempty"`
	Tcp  string `yaml:"tcp,omitempty" json:"tcp,omitempty"`
}

// GraphUIDefaults defines UI Defaults specific to the UI Graph
type GraphUIDefaults struct {
	FindOptions []GraphFindOption `yaml:"find_options,omitempty" json:"findOptions,omitempty"`
	HideOptions []GraphFindOption `yaml:"hide_options,omitempty" json:"hideOptions,omitempty"`
	Impl        string            `yaml:"impl,omitempty" json:"impl,omitempty"`
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
}

// Validations defines default settings configured for the Validations subsystem
type Validations struct {
	Ignore                   []string `yaml:"ignore,omitempty" json:"ignore,omitempty"`
	SkipWildcardGatewayHosts bool     `yaml:"skip_wildcard_gateway_hosts,omitempty"`
}

// CertificatesInformationIndicators defines configuration to enable the feature and to grant read permissions to a list of secrets
type CertificatesInformationIndicators struct {
	Enabled bool     `yaml:"enabled,omitempty" json:"enabled"`
	Secrets []string `yaml:"secrets,omitempty" json:"secrets,omitempty"`
}

// Clustering defines configuration around multi-cluster functionality.
type Clustering struct {
	// Clusters is a list of clusters that cannot be autodetected by the Kiali Server.
	// Remote clusters are specified here if ‘autodetect_secrets.enabled’ is false or
	// if the Kiali Server does not have access to the remote cluster’s secret.
	Clusters  []Cluster  `yaml:"clusters" json:"clusters"`
	KialiURLs []KialiURL `yaml:"kiali_urls" json:"kiali_urls"`
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
	CertificatesInformationIndicators CertificatesInformationIndicators `yaml:"certificates_information_indicators,omitempty" json:"certificatesInformationIndicators"`
	Clustering                        FeatureFlagClustering             `yaml:"clustering,omitempty" json:"clustering,omitempty"`
	DisabledFeatures                  []string                          `yaml:"disabled_features,omitempty" json:"disabledFeatures,omitempty"`
	IstioAnnotationAction             bool                              `yaml:"istio_annotation_action,omitempty" json:"istioAnnotationAction"`
	IstioInjectionAction              bool                              `yaml:"istio_injection_action,omitempty" json:"istioInjectionAction"`
	IstioUpgradeAction                bool                              `yaml:"istio_upgrade_action,omitempty" json:"istioUpgradeAction"`
	UIDefaults                        UIDefaults                        `yaml:"ui_defaults,omitempty" json:"uiDefaults,omitempty"`
	Validations                       Validations                       `yaml:"validations,omitempty" json:"validations,omitempty"`
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

// Config defines full YAML configuration.
type Config struct {
	AdditionalDisplayDetails []AdditionalDisplayItem             `yaml:"additional_display_details,omitempty"`
	API                      ApiConfig                           `yaml:"api,omitempty"`
	Auth                     AuthConfig                          `yaml:"auth,omitempty"`
	Clustering               Clustering                          `yaml:"clustering,omitempty"`
	CustomDashboards         dashboards.MonitoringDashboardsList `yaml:"custom_dashboards,omitempty"`
	Deployment               DeploymentConfig                    `yaml:"deployment,omitempty"`
	ExternalServices         ExternalServices                    `yaml:"external_services,omitempty"`
	HealthConfig             HealthConfig                        `yaml:"health_config,omitempty" json:"healthConfig,omitempty"`
	Identity                 security.Identity                   `yaml:",omitempty"`
	InCluster                bool                                `yaml:"in_cluster,omitempty"`
	InstallationTag          string                              `yaml:"installation_tag,omitempty"`
	IstioLabels              IstioLabels                         `yaml:"istio_labels,omitempty"`
	IstioNamespace           string                              `yaml:"istio_namespace,omitempty"` // default component namespace
	KialiFeatureFlags        KialiFeatureFlags                   `yaml:"kiali_feature_flags,omitempty"`
	KubernetesConfig         KubernetesConfig                    `yaml:"kubernetes_config,omitempty"`
	LoginToken               LoginToken                          `yaml:"login_token,omitempty"`
	Server                   Server                              `yaml:",omitempty"`
}

// NewConfig creates a default Config struct
func NewConfig() (c *Config) {
	c = &Config{
		InCluster:      true,
		IstioNamespace: "istio-system",
		API: ApiConfig{
			Namespaces: ApiNamespacesConfig{
				Exclude: []string{
					"^istio-operator",
					"^kube-.*",
					"^openshift.*",
					"^ibm.*",
					"^kial-operator",
				},
				Include:              []string{},
				LabelSelectorExclude: "",
			},
		},
		Auth: AuthConfig{
			Strategy: "token",
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
		},
		CustomDashboards: dashboards.GetBuiltInMonitoringDashboards(),
		Deployment: DeploymentConfig{
			AccessibleNamespaces: []string{"**"},
			ClusterWideAccess:    true,
			InstanceName:         "kiali",
			Namespace:            "istio-system",
			RemoteSecretPath:     "/kiali-remote-secret/kiali",
			ViewOnlyMode:         false,
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
				Enabled:      true,
				InClusterURL: "http://grafana.istio-system:3000",
				IsCore:       false,
			},
			Istio: IstioConfig{
				ComponentStatuses: ComponentStatuses{
					Enabled: true,
					Components: []ComponentStatus{
						{
							AppLabel: "istio-egressgateway",
							IsCore:   false,
							IsProxy:  true,
						},
						{
							AppLabel: "istio-ingressgateway",
							IsCore:   true,
							IsProxy:  true,
						},
						{
							AppLabel: "istiod",
							IsCore:   true,
							IsProxy:  false,
						},
					},
				},
				ConfigMapName:                     "istio",
				EnvoyAdminLocalPort:               15000,
				IstioAPIEnabled:                   true,
				IstioIdentityDomain:               "svc.cluster.local",
				IstioInjectionAnnotation:          "sidecar.istio.io/inject",
				IstioSidecarInjectorConfigMapName: "istio-sidecar-injector",
				IstioSidecarAnnotation:            "sidecar.istio.io/status",
				IstiodDeploymentName:              "istiod",
				IstiodPodMonitoringPort:           15014,
				IstiodPollingIntervalSeconds:      20,
				RootNamespace:                     "istio-system",
				UrlServiceVersion:                 "",
				GatewayAPIClasses:                 []GatewayAPIClass{},
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
				CustomHeaders:        map[string]string{},
				Enabled:              true,
				GrpcPort:             9095,
				InClusterURL:         "http://tracing.istio-system:16685/jaeger",
				IsCore:               false,
				Provider:             JaegerProvider,
				NamespaceSelector:    true,
				QueryScope:           map[string]string{},
				QueryTimeout:         5,
				TempoConfig:          TempoConfig{},
				URL:                  "",
				UseGRPC:              true,
				WhiteListIstioSystem: []string{"jaeger-query", "istio-ingressgateway"},
			},
		},
		IstioLabels: IstioLabels{
			AmbientNamespaceLabel:      "istio.io/dataplane-mode",
			AmbientNamespaceLabelValue: "ambient",
			AmbientWaypointLabel:       WaypointLabel,
			AmbientWaypointLabelValue:  WaypointLabelValue,
			AppLabelName:               "app",
			InjectionLabelName:         "istio-injection",
			InjectionLabelRev:          "istio.io/rev",
			VersionLabelName:           "version",
		},
		KialiFeatureFlags: KialiFeatureFlags{
			CertificatesInformationIndicators: CertificatesInformationIndicators{
				Enabled: true,
				Secrets: []string{"cacerts", "istio-ca-secret"},
			},
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
					Impl: "cy",
					Settings: GraphSettings{
						FontLabel:    13,
						MinFontBadge: 7,
						MinFontLabel: 10,
					},
					Traffic: GraphTraffic{
						Grpc: "requests",
						Http: "requests",
						Tcp:  "sent",
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
				RefreshInterval:   "60s",
			},
			Validations: Validations{
				Ignore: make([]string, 0),
			},
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
						SkipVerify: true,
						TLSEnabled: false,
					},
					// Sample half of traces.
					SamplingRate: 0.5,
				},
			},
			Port:                       20001,
			StaticContentRootDirectory: "/opt/kiali/console",
			WebFQDN:                    "",
			WebRoot:                    "/",
			WebHistoryMode:             "browser",
			WebSchema:                  "",
			WriteTimeout:               30,
		},
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
// When using the operator, the operator will grant the kiali service account
// cluster role permissions when '**' is provided in the accessible_namespaces
// or if cluster-wide-access was explicitly requested.
func (conf *Config) AllNamespacesAccessible() bool {
	// look for ** in accessible namespaces first, as we have done in the past. This backwards compatible
	// behavior will help support users who installed the server via the server helm chart.
	for _, ns := range conf.Deployment.AccessibleNamespaces {
		if ns == "**" {
			return true
		}
	}
	// it is still possible we are in cluster wide access mode even if accessible namespaces has been restricted
	return conf.Deployment.ClusterWideAccess
}

// IsServerHTTPS returns true if the server endpoint should use HTTPS. If false, only plaintext HTTP is supported.
func (conf *Config) IsServerHTTPS() bool {
	return conf.Identity.CertFile != "" && conf.Identity.PrivateKeyFile != ""
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
}

func (conf Config) Obfuscate() (obf Config) {
	obf = conf
	obf.ExternalServices.Grafana.Auth.Obfuscate()
	obf.ExternalServices.Prometheus.Auth.Obfuscate()
	obf.ExternalServices.Tracing.Auth.Obfuscate()
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
		log.Debugf(str)
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

// Unmarshal parses the given YAML string and returns its Config object representation.
func Unmarshal(yamlString string) (conf *Config, err error) {
	conf = NewConfig()
	err = yaml.Unmarshal([]byte(yamlString), &conf)
	if err != nil {
		return nil, fmt.Errorf("failed to parse yaml data. error=%v", err)
	}

	conf.prepareDashboards()

	// Some config settings (such as sensitive settings like passwords) are overrideable
	// via secrets mounted on the file system rather than storing them directly in the config map itself.
	// The names of the files in /kiali-override-secrets denote which credentials they are.
	type overridesType struct {
		configValue *string
		fileName    string
	}

	overrides := []overridesType{
		{
			configValue: &conf.ExternalServices.Grafana.Auth.Password,
			fileName:    SecretFileGrafanaPassword,
		},
		{
			configValue: &conf.ExternalServices.Grafana.Auth.Token,
			fileName:    SecretFileGrafanaToken,
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

// IsIstioNamespace returns true if the namespace is the default istio namespace
func IsIstioNamespace(namespace string) bool {
	return namespace == configuration.IstioNamespace
}

// IsRootNamespace returns true if the namespace is the root namespace
func IsRootNamespace(namespace string) bool {
	return namespace == configuration.ExternalServices.Istio.RootNamespace
}

// IsFeatureDisabled will return true if the named feature is to be disabled.
func IsFeatureDisabled(featureName FeatureName) bool {
	cfg := Get()
	for _, f := range cfg.KialiFeatureFlags.DisabledFeatures {
		if f == string(featureName) {
			return true
		}
	}
	return false
}

// IsWaypoint returns true if the labels contain a waypoint proxy
func IsWaypoint(labels map[string]string) bool {
	return labels[WaypointLabel] == WaypointLabelValue
}

// GetSafeClusterName checks the input value provides a default cluster name if it's empty
func GetSafeClusterName(cluster string) string {
	if cluster == "" {
		return Get().KubernetesConfig.ClusterName
	}
	return cluster
}

// Validate will ensure the config is valid. This should be called after the config
// is initialized and before the config is used.
func Validate(cfg Config) error {
	if cfg.Server.Port < 0 {
		return fmt.Errorf("server port is negative: %v", cfg.Server.Port)
	}

	if strings.Contains(cfg.Server.StaticContentRootDirectory, "..") {
		return fmt.Errorf("server static content root directory must not contain '..': %v", cfg.Server.StaticContentRootDirectory)
	}
	if _, err := os.Stat(cfg.Server.StaticContentRootDirectory); os.IsNotExist(err) {
		return fmt.Errorf("server static content root directory does not exist: %v", cfg.Server.StaticContentRootDirectory)
	}

	webRoot := cfg.Server.WebRoot
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
	auth := cfg.Auth
	log.Infof("Using authentication strategy [%v]", auth.Strategy)
	if auth.Strategy == AuthStrategyAnonymous {
		log.Warningf("Kiali auth strategy is configured for anonymous access - users will not be authenticated.")
	} else if auth.Strategy != AuthStrategyOpenId &&
		auth.Strategy != AuthStrategyOpenshift &&
		auth.Strategy != AuthStrategyToken &&
		auth.Strategy != AuthStrategyHeader {
		return fmt.Errorf("Invalid authentication strategy [%v]", auth.Strategy)
	}

	// Check the ciphering key for sessions
	signingKey := cfg.LoginToken.SigningKey
	if err := ValidateSigningKey(signingKey, auth.Strategy); err != nil {
		return err
	}

	// log a warning if the user is ignoring some validations
	if len(cfg.KialiFeatureFlags.Validations.Ignore) > 0 {
		log.Infof("Some validation errors will be ignored %v. If these errors do occur, they will still be logged. If you think the validation errors you see are incorrect, please report them to the Kiali team if you have not done so already and provide the details of your scenario. This will keep Kiali validations strong for the whole community.", cfg.KialiFeatureFlags.Validations.Ignore)
	}

	// log a info message if the user is disabling some features
	if len(cfg.KialiFeatureFlags.DisabledFeatures) > 0 {
		log.Infof("Some features are disabled: [%v]", strings.Join(cfg.KialiFeatureFlags.DisabledFeatures, ","))
		for _, fn := range cfg.KialiFeatureFlags.DisabledFeatures {
			if err := FeatureName(fn).IsValid(); err != nil {
				return err
			}
		}
	}

	// Check the observability section
	observTracing := cfg.Server.Observability.Tracing
	// If collector is not defined it would be the default "otel"
	if observTracing.Enabled && observTracing.CollectorType != OTELCollectorType {
		return fmt.Errorf("error in configuration options getting the observability exporter. Invalid collector type [%s]", observTracing.CollectorType)
	}

	// Check the tracing section
	cfgTracing := cfg.ExternalServices.Tracing
	if cfgTracing.Enabled && cfgTracing.Provider != JaegerProvider && cfgTracing.Provider != TempoProvider {
		return fmt.Errorf("error in configuration options for the external services tracing provider. Invalid provider type [%s]", cfgTracing.Provider)
	}

	return nil
}

func ValidateSigningKey(signingKey string, authStrategy string) error {
	if authStrategy != AuthStrategyAnonymous {
		if len(signingKey) != 16 && len(signingKey) != 24 && len(signingKey) != 32 {
			return errors.New("signing key for sessions must be 16, 24 or 32 bytes length")
		}
	}

	return nil
}
