package config

import (
	"fmt"
	"io/ioutil"
	"os"
	"sync"

	"gopkg.in/yaml.v2"

	"github.com/kiali/kiali/config/security"
	"github.com/kiali/kiali/log"
)

// Environment variables that can override the ConfigMap yaml values
const (
	// External services auth
	EnvGrafanaPassword    = "GRAFANA_PASSWORD"
	EnvGrafanaToken       = "GRAFANA_TOKEN"
	EnvPrometheusPassword = "PROMETHEUS_PASSWORD"
	EnvPrometheusToken    = "PROMETHEUS_TOKEN"
	EnvTracingPassword    = "TRACING_PASSWORD"
	EnvTracingToken       = "TRACING_TOKEN"

	// Login Token signing key used to prepare the token for user login
	EnvLoginTokenSigningKey = "LOGIN_TOKEN_SIGNING_KEY"
)

// The versions that Kiali requires
const (
	IstioVersionSupported   = ">= 1.0"
	MaistraVersionSupported = ">= 0.7.0"
	OSSMVersionSupported    = ">= 1.0"
	Iter8VersionSupported   = ">= 0.2"
)

// The valid auth strategies and values for cookie handling
const (
	AuthStrategyOpenshift = "openshift"
	AuthStrategyAnonymous = "anonymous"
	AuthStrategyToken     = "token"
	AuthStrategyOpenId    = "openid"

	TokenCookieName             = "kiali-token"
	AuthStrategyOpenshiftIssuer = "kiali-openshift"
	AuthStrategyTokenIssuer     = "kiali-token"
	AuthStrategyOpenIdIssuer    = "kiali-open-id"

	// These constants are used for external services auth (Prometheus, Grafana ...) ; not for Kiali auth
	AuthTypeBasic  = "basic"
	AuthTypeBearer = "bearer"
	AuthTypeNone   = "none"
)

const (
	IstioMultiClusterHostSuffix = "global"
)

// Global configuration for the application.
var configuration Config
var rwMutex sync.RWMutex

// Server configuration
type Server struct {
	Address                    string `yaml:",omitempty"`
	AuditLog                   bool   `yaml:"audit_log,omitempty"` // When true, allows additional audit logging on Write operations
	CORSAllowAll               bool   `yaml:"cors_allow_all,omitempty"`
	GzipEnabled                bool   `yaml:"gzip_enabled,omitempty"`
	MetricsEnabled             bool   `yaml:"metrics_enabled,omitempty"`
	MetricsPort                int    `yaml:"metrics_port,omitempty"`
	Port                       int    `yaml:",omitempty"`
	StaticContentRootDirectory string `yaml:"static_content_root_directory,omitempty"`
	WebFQDN                    string `yaml:"web_fqdn,omitempty"`
	WebRoot                    string `yaml:"web_root,omitempty"`
	WebSchema                  string `yaml:"web_schema,omitempty"`
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

// PrometheusConfig describes configuration of the Prometheus component
type PrometheusConfig struct {
	Auth            Auth            `yaml:"auth,omitempty"`
	ComponentStatus ComponentStatus `yaml:"component_status,omitempty"`
	URL             string          `yaml:"url,omitempty"`
}

// CustomDashboardsConfig describes configuration specific to Custom Dashboards
type CustomDashboardsConfig struct {
	Prometheus     PrometheusConfig `yaml:"prometheus,omitempty"`
	NamespaceLabel string           `yaml:"namespace_label,omitempty"`
}

// GrafanaConfig describes configuration used for Grafana links
type GrafanaConfig struct {
	Auth            Auth                     `yaml:"auth"`
	ComponentStatus ComponentStatus          `yaml:"component_status,omitempty"`
	Dashboards      []GrafanaDashboardConfig `yaml:"dashboards"`
	Enabled         bool                     `yaml:"enabled"` // Enable or disable Grafana support in Kiali
	InClusterURL    string                   `yaml:"in_cluster_url"`
	URL             string                   `yaml:"url"`
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

// TracingConfig describes configuration used for tracing links
type TracingConfig struct {
	Auth                 Auth            `yaml:"auth"`
	ComponentStatus      ComponentStatus `yaml:"component_status,omitempty"`
	Enabled              bool            `yaml:"enabled"` // Enable Jaeger in Kiali
	InClusterURL         string          `yaml:"in_cluster_url"`
	NamespaceSelector    bool            `yaml:"namespace_selector"`
	URL                  string          `yaml:"url"`
	WhiteListIstioSystem []string        `yaml:"whitelist_istio_system"`
}

// IstioConfig describes configuration used for istio links
type IstioConfig struct {
	ComponentStatuses        ComponentStatuses `yaml:"component_status,omitempty"`
	ConfigMapName            string            `yaml:"config_map_name,omitempty"`
	IstioIdentityDomain      string            `yaml:"istio_identity_domain,omitempty"`
	IstioInjectionAnnotation string            `yaml:"istio_injection_annotation,omitempty"`
	IstioSidecarAnnotation   string            `yaml:"istio_sidecar_annotation,omitempty"`
	UrlServiceVersion        string            `yaml:"url_service_version"`
}

type ComponentStatuses struct {
	Enabled    bool              `yaml:"enabled,omitempty"`
	Components []ComponentStatus `yaml:"components,omitempty"`
}

type ComponentStatus struct {
	AppLabel string `yaml:"app_label,omitempty"`
	IsCore   bool   `yaml:"is_core,omitempty"`
}

// ThreeScaleConfig describes configuration used for 3Scale adapter
type ThreeScaleConfig struct {
	AdapterName    string `yaml:"adapter_name"`
	AdapterPort    string `yaml:"adapter_port"`
	AdapterService string `yaml:"adapter_service"`
	Enabled        bool   `yaml:"enabled"`
	TemplateName   string `yaml:"template_name"`
}

type Iter8Config struct {
	Enabled bool `yaml:"enabled"`
	// Defein which namespace Iter8 is installed on, default to iter8
	Namespace string `yaml:"namespace"`
}

// Extensions struct describes configuration for Kiali add-ons (extensions)
// New add-on/extension configuration should create a specif config and be located under this
type Extensions struct {
	ThreeScale ThreeScaleConfig `yaml:"threescale,omitempty"`
	Iter8      Iter8Config      `yaml:"iter_8,omitempty"`
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
	AppLabelName       string `yaml:"app_label_name,omitempty" json:"appLabelName"`
	InjectionLabelName string `yaml:"injection_label,omitempty" json:"injectionLabelName"`
	VersionLabelName   string `yaml:"version_label_name,omitempty" json:"versionLabelName"`
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
	// Enable cache for kubernetes and istio resources
	CacheEnabled bool `yaml:"cache_enabled,omitempty"`
	// Kiali can cache VirtualService,DestinationRule,Gateway and ServiceEntry Istio resources if they are present
	// on this list of Istio types. Other Istio types are not yet supported.
	CacheIstioTypes []string `yaml:"cache_istio_types,omitempty"`
	// List of namespaces or regex defining namespaces to include in a cache
	CacheNamespaces []string `yaml:"cache_namespaces,omitempty"`
	// Cache duration expressed in seconds
	// Kiali cache list of namespaces per user, this is typically short lived cache compared with the duration of the
	// namespace cache defined by previous CacheDuration parameter
	CacheTokenNamespaceDuration int `yaml:"cache_token_namespace_duration,omitempty"`
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

// ApiNamespacesConfig provides a list of regex strings defining namespaces to blacklist.
type ApiNamespacesConfig struct {
	Exclude       []string
	LabelSelector string `yaml:"label_selector,omitempty" json:"labelSelector"`
}

// AuthConfig provides details on how users are to authenticate
type AuthConfig struct {
	OpenId    OpenIdConfig    `yaml:"openid,omitempty"`
	OpenShift OpenShiftConfig `yaml:"openshift,omitempty"`
	Strategy  string          `yaml:"strategy,omitempty"`
}

// OpenShiftConfig contains specific configuration for authentication when on OpenShift
type OpenShiftConfig struct {
	ClientIdPrefix string `yaml:"client_id_prefix,omitempty"`
}

// OpenIdConfig contains specific configuration for authentication using an OpenID provider
type OpenIdConfig struct {
	ApiProxy              string   `yaml:"api_proxy,omitempty"`
	ApiProxyCAData        string   `yaml:"api_proxy_ca_data,omitempty"`
	AuthenticationTimeout int      `yaml:"authentication_timeout,omitempty"`
	AuthorizationEndpoint string   `yaml:"authorization_endpoint,omitempty"`
	ClientId              string   `yaml:"client_id,omitempty"`
	InsecureSkipVerifyTLS bool     `yaml:"insecure_skip_verify_tls,omitempty"`
	IssuerUri             string   `yaml:"issuer_uri,omitempty"`
	Scopes                []string `yaml:"scopes,omitempty"`
	UsernameClaim         string   `yaml:"username_claim,omitempty"`
}

// DeploymentConfig provides details on how Kiali was deployed.
type DeploymentConfig struct {
	AccessibleNamespaces []string `yaml:"accessible_namespaces"`
	Namespace            string   `yaml:"namespace,omitempty"` // Kiali deployment namespace
}

// IstioComponentNamespaces holds the component-specific Istio namespaces. Any missing component
// defaults to the namespace configured for IstioNamespace (which itself defaults to 'istio-system').
type IstioComponentNamespaces map[string]string

type KialiFeatureFlags struct {
	IstioInjectionAction bool `yaml:"istio_injection_action,omitempty" json:"istioInjectionAction"`
}

// ToleranceConfig
type Tolerance struct {
	Code      string  `yaml:"code,omitempty" json:"code"`
	Degraded  float32 `yaml:"degraded,omitempty" json:"degraded"`
	Failure   float32 `yaml:"failure,omitempty" json:"failure"`
	Protocol  string  `yaml:"protocol,omitempty" json:"protocol"`
	Direction string  `yaml:"direction,omitempty" json:"direction"`
}

// RateConfig
type Rate struct {
	Namespace string      `yaml:"namespace,omitempty" json:"namespace"`
	Kind      string      `yaml:"kind,omitempty" json:"kind"`
	Name      string      `yaml:"name,omitempty" json:"name"`
	Tolerance []Tolerance `yaml:"tolerance,omitempty" json:"tolerance"`
}

// HealthConfig
type HealthConfig struct {
	Rate []Rate `yaml:"rate,omitempty" json:"rate"`
}

// Config defines full YAML configuration.
type Config struct {
	AdditionalDisplayDetails []AdditionalDisplayItem  `yaml:"additional_display_details,omitempty"`
	API                      ApiConfig                `yaml:"api,omitempty"`
	Auth                     AuthConfig               `yaml:"auth,omitempty"`
	Deployment               DeploymentConfig         `yaml:"deployment,omitempty"`
	Extensions               Extensions               `yaml:"extensions,omitempty"`
	ExternalServices         ExternalServices         `yaml:"external_services,omitempty"`
	HealthConfig             HealthConfig             `yaml:"health_config,omitempty" json:"healthConfig"`
	Identity                 security.Identity        `yaml:",omitempty"`
	InCluster                bool                     `yaml:"in_cluster,omitempty"`
	InstallationTag          string                   `yaml:"installation_tag,omitempty"`
	IstioComponentNamespaces IstioComponentNamespaces `yaml:"istio_component_namespaces,omitempty"`
	IstioLabels              IstioLabels              `yaml:"istio_labels,omitempty"`
	IstioNamespace           string                   `yaml:"istio_namespace,omitempty"` // default component namespace
	KialiFeatureFlags        KialiFeatureFlags        `yaml:"kiali_feature_flags,omitempty"`
	KubernetesConfig         KubernetesConfig         `yaml:"kubernetes_config,omitempty"`
	LoginToken               LoginToken               `yaml:"login_token,omitempty"`
	Server                   Server                   `yaml:",omitempty"`
}

// NewConfig creates a default Config struct
func NewConfig() (c *Config) {
	c = &Config{
		InCluster:      true,
		IstioNamespace: "istio-system",
		API: ApiConfig{
			Namespaces: ApiNamespacesConfig{
				Exclude: []string{
					"istio-operator",
					"kube.*",
					"openshift.*",
					"ibm.*",
					"kial-operator",
				},
			},
		},
		Auth: AuthConfig{
			Strategy: "token",
			OpenId: OpenIdConfig{
				ApiProxy:              "",
				ApiProxyCAData:        "",
				AuthenticationTimeout: 300,
				AuthorizationEndpoint: "",
				ClientId:              "",
				InsecureSkipVerifyTLS: false,
				IssuerUri:             "",
				Scopes:                []string{"openid", "profile", "email"},
				UsernameClaim:         "sub",
			},
			OpenShift: OpenShiftConfig{
				ClientIdPrefix: "kiali",
			},
		},
		Deployment: DeploymentConfig{
			AccessibleNamespaces: []string{"**"},
			Namespace:            "istio-system",
		},
		Extensions: Extensions{
			ThreeScale: ThreeScaleConfig{
				AdapterName:    "threescale",
				AdapterPort:    "3333",
				AdapterService: "threescale-istio-adapter",
				Enabled:        false,
				TemplateName:   "threescale-authorization",
			},
			Iter8: Iter8Config{
				Enabled:   false,
				Namespace: "iter8",
			},
		},
		ExternalServices: ExternalServices{
			Grafana: GrafanaConfig{
				Auth: Auth{
					Type: AuthTypeNone,
				},
				Enabled: true,
				ComponentStatus: ComponentStatus{
					AppLabel: "grafana",
					IsCore:   false,
				},
			},
			Istio: IstioConfig{
				IstioIdentityDomain:      "svc.cluster.local",
				IstioInjectionAnnotation: "sidecar.istio.io/inject",
				IstioSidecarAnnotation:   "sidecar.istio.io/status",
				ComponentStatuses: ComponentStatuses{
					Enabled: true,
					Components: []ComponentStatus{
						{
							AppLabel: "istio-egressgateway",
							IsCore:   false,
						},
						{
							AppLabel: "istio-ingressgateway",
							IsCore:   true,
						},
						{
							AppLabel: "istiod",
							IsCore:   true,
						},
					},
				},
				ConfigMapName:     "istio",
				UrlServiceVersion: "http://istiod:15014/version",
			},
			Prometheus: PrometheusConfig{
				Auth: Auth{
					Type: AuthTypeNone,
				},
				ComponentStatus: ComponentStatus{
					AppLabel: "prometheus",
					IsCore:   true,
				},
				URL: "http://prometheus.istio-system:9090",
			},
			Tracing: TracingConfig{
				Auth: Auth{
					Type: AuthTypeNone,
				},
				ComponentStatus: ComponentStatus{
					AppLabel: "jaeger",
					IsCore:   false,
				},
				Enabled:              true,
				NamespaceSelector:    true,
				InClusterURL:         "http://tracing.istio-system/jaeger",
				URL:                  "",
				WhiteListIstioSystem: []string{"jaeger-query", "istio-ingressgateway"},
			},
		},
		IstioLabels: IstioLabels{
			AppLabelName:       "app",
			InjectionLabelName: "istio-injection",
			VersionLabelName:   "version",
		},
		KialiFeatureFlags: KialiFeatureFlags{
			IstioInjectionAction: true,
		},
		KubernetesConfig: KubernetesConfig{
			Burst:                       200,
			CacheDuration:               5 * 60,
			CacheEnabled:                true,
			CacheIstioTypes:             []string{"DestinationRule", "Gateway", "ServiceEntry", "VirtualService", "Sidecar", "PeerAuthentication", "RequestAuthentication", "AuthorizationPolicy"},
			CacheNamespaces:             []string{".*"},
			CacheTokenNamespaceDuration: 10,
			ExcludeWorkloads:            []string{"CronJob", "DeploymentConfig", "Job", "ReplicationController"},
			QPS:                         175,
		},
		LoginToken: LoginToken{
			ExpirationSeconds: 24 * 3600,
			SigningKey:        "kiali",
		},
		Server: Server{
			AuditLog:                   true,
			GzipEnabled:                true,
			MetricsEnabled:             true,
			MetricsPort:                9090,
			Port:                       20001,
			StaticContentRootDirectory: "/opt/kiali/console",
			WebFQDN:                    "",
			WebRoot:                    "/",
			WebSchema:                  "",
		},
	}

	return
}

// Add Health Default Configuration
func (conf *Config) AddHealthDefault() {
	// Health default configuration
	healthConfig := HealthConfig{
		Rate: []Rate{
			{
				Namespace: ".*",
				Kind:      ".*",
				Name:      ".*",
				Tolerance: []Tolerance{
					{
						Code:      "^5\\d\\d$",
						Protocol:  "http",
						Direction: ".*",
						Failure:   10,
					},
					{
						Code:      "^4\\d\\d$",
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
				},
			},
		},
	}
	conf.HealthConfig.Rate = append(conf.HealthConfig.Rate, healthConfig.Rate...)
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

// String marshals the given Config into a YAML string
// WARNING: do NOT use the result of this function to retrieve any configuration: some fields are obfuscated for security reasons.
func (conf Config) String() (str string) {
	obf := conf
	obf.ExternalServices.Grafana.Auth.Obfuscate()
	obf.ExternalServices.Prometheus.Auth.Obfuscate()
	obf.ExternalServices.Tracing.Auth.Obfuscate()
	obf.Identity.Obfuscate()
	obf.LoginToken.Obfuscate()
	str, err := Marshal(&obf)
	if err != nil {
		str = fmt.Sprintf("Failed to marshal config to string. err=%v", err)
		log.Debugf(str)
	}

	return
}

// Unmarshal parses the given YAML string and returns its Config object representation.
func Unmarshal(yamlString string) (conf *Config, err error) {
	conf = NewConfig()
	err = yaml.Unmarshal([]byte(yamlString), &conf)
	if err != nil {
		return nil, fmt.Errorf("failed to parse yaml data. error=%v", err)
	}

	// Some config settings (such as sensitive settings like passwords) are overrideable
	// via environment variables. This allows a user to store sensitive values in secrets
	// and mount those secrets to environment variables rather than storing them directly
	// in the config map itself.
	type overridesType struct {
		configValue *string
		envVarName  string
	}

	overrides := []overridesType{
		{
			configValue: &conf.ExternalServices.Grafana.Auth.Password,
			envVarName:  EnvGrafanaPassword,
		},
		{
			configValue: &conf.ExternalServices.Grafana.Auth.Token,
			envVarName:  EnvGrafanaToken,
		},
		{
			configValue: &conf.ExternalServices.Prometheus.Auth.Password,
			envVarName:  EnvPrometheusPassword,
		},
		{
			configValue: &conf.ExternalServices.Prometheus.Auth.Token,
			envVarName:  EnvPrometheusToken,
		},
		{
			configValue: &conf.ExternalServices.Tracing.Auth.Password,
			envVarName:  EnvTracingPassword,
		},
		{
			configValue: &conf.ExternalServices.Tracing.Auth.Token,
			envVarName:  EnvTracingToken,
		},
		{
			configValue: &conf.LoginToken.SigningKey,
			envVarName:  EnvLoginTokenSigningKey,
		},
	}

	for _, override := range overrides {
		envVarValue := os.Getenv(override.envVarName)
		if envVarValue != "" {
			*override.configValue = envVarValue
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
	fileContent, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to load config file [%v]. error=%v", filename, err)
	}

	return Unmarshal(string(fileContent))
}

// SaveToFile converts the Config object and stores its YAML string into the given file, overwriting any data that is in the file.
func SaveToFile(filename string, conf *Config) (err error) {
	fileContent, err := Marshal(conf)
	if err != nil {
		return fmt.Errorf("failed to save config file [%v]. error=%v", filename, err)
	}

	log.Debugf("Writing YAML config to [%s]", filename)
	err = ioutil.WriteFile(filename, []byte(fileContent), 0640)
	return
}

// GetIstioNamespaces returns all Istio namespaces, less the exclusions
func GetIstioNamespaces(exclude []string) []string {
	excludeMap := map[string]bool{}
	for _, e := range exclude {
		excludeMap[e] = true
	}
	result := []string{}
	if _, found := excludeMap[configuration.IstioNamespace]; !found {
		result = append(result, configuration.IstioNamespace)
	}
	for _, ns := range configuration.IstioComponentNamespaces {
		if _, found := excludeMap[ns]; !found {
			result = append(result, ns)
		}
	}
	return result
}

// IsIstioNamespace returns true if the namespace is the default istio namespace or an Istio component namespace
func IsIstioNamespace(namespace string) bool {
	if namespace == configuration.IstioNamespace {
		return true
	}
	for _, ns := range configuration.IstioComponentNamespaces {
		if ns == namespace {
			return true
		}
	}
	return false
}
