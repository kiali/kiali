package config

import (
	"fmt"
	"io/ioutil"
	"os"
	"sync"

	yaml "gopkg.in/yaml.v2"

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
)

// The valid auth strategies and values for cookie handling
const (
	AuthStrategyOpenshift = "openshift"
	AuthStrategyLogin     = "login"
	AuthStrategyAnonymous = "anonymous"
	AuthStrategyLDAP      = "ldap"
	AuthStrategyToken     = "token"

	TokenCookieName             = "kiali-token"
	AuthStrategyOpenshiftIssuer = "kiali-openshift"
	AuthStrategyLoginIssuer     = "kiali-login"
	AuthStrategyTokenIssuer     = "kiali-token"

	// These constants are used for external services auth (Prometheus, Grafana ...) ; not for Kiali auth
	AuthTypeBasic  = "basic"
	AuthTypeBearer = "bearer"
	AuthTypeNone   = "none"
)

// the paths we expect the login secret to be located
const (
	LoginSecretUsername   = "/kiali-secret/username"
	LoginSecretPassphrase = "/kiali-secret/passphrase"
)

const (
	IstioMultiClusterHostSuffix = "global"
)

// Global configuration for the application.
var configuration Config
var rwMutex sync.RWMutex

// Server configuration
type Server struct {
	Address                    string               `yaml:",omitempty"`
	AuditLog                   bool                 `yaml:"audit_log,omitempty"` // When true, allows additional audit logging on Write operations
	CORSAllowAll               bool                 `yaml:"cors_allow_all,omitempty"`
	Credentials                security.Credentials `yaml:",omitempty"`
	GzipEnabled                bool                 `yaml:"gzip_enabled,omitempty"`
	MetricsEnabled             bool                 `yaml:"metrics_enabled,omitempty"`
	MetricsPort                int                  `yaml:"metrics_port,omitempty"`
	Port                       int                  `yaml:",omitempty"`
	StaticContentRootDirectory string               `yaml:"static_content_root_directory,omitempty"`
	WebRoot                    string               `yaml:"web_root,omitempty"`
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

// PrometheusConfig describes configuration of the Prometheus component
type PrometheusConfig struct {
	Auth             Auth   `yaml:"auth,omitempty"`
	CustomMetricsURL string `yaml:"custom_metrics_url,omitempty"`
	URL              string `yaml:"url,omitempty"`
}

// GrafanaConfig describes configuration used for Grafana links
type GrafanaConfig struct {
	Auth         Auth                     `yaml:"auth"`
	Dashboards   []GrafanaDashboardConfig `yaml:"dashboards"`
	Enabled      bool                     `yaml:"enabled"` // Enable or disable Grafana support in Kiali
	InClusterURL string                   `yaml:"in_cluster_url"`
	URL          string                   `yaml:"url"`
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
	Auth              Auth   `yaml:"auth"`
	Enabled           bool   `yaml:"enabled"` // Enable Jaeger in Kiali
	InClusterURL      string `yaml:"in_cluster_url"`
	NamespaceSelector bool   `yaml:"namespace_selector"`
	URL               string `yaml:"url"`
}

// IstioConfig describes configuration used for istio links
type IstioConfig struct {
	IstioIdentityDomain    string `yaml:"istio_identity_domain,omitempty"`
	IstioSidecarAnnotation string `yaml:"istio_sidecar_annotation,omitempty"`
	UrlServiceVersion      string `yaml:"url_service_version"`
}

// ThreeScaleConfig describes configuration used for 3Scale adapter
type ThreeScaleConfig struct {
	AdapterName    string `yaml:"adapter_name"`
	AdapterPort    string `yaml:"adapter_port"`
	AdapterService string `yaml:"adapter_service"`
}

// ExternalServices holds configurations for other systems that Kiali depends on
type ExternalServices struct {
	Grafana    GrafanaConfig    `yaml:"grafana,omitempty"`
	Istio      IstioConfig      `yaml:"istio,omitempty"`
	Prometheus PrometheusConfig `yaml:"prometheus,omitempty"`
	ThreeScale ThreeScaleConfig `yaml:"threescale,omitempty"`
	Tracing    TracingConfig    `yaml:"tracing,omitempty"`
}

// LoginToken holds config used in token-based authentication
type LoginToken struct {
	ExpirationSeconds int64  `yaml:"expiration_seconds,omitempty"`
	SigningKey        string `yaml:"signing_key,omitempty"`
}

// IstioLabels holds configuration about the labels required by Istio
type IstioLabels struct {
	AppLabelName     string `yaml:"app_label_name,omitempty" json:"appLabelName"`
	VersionLabelName string `yaml:"version_label_name,omitempty" json:"versionLabelName"`
}

// AdditionalDisplayItem holds some display-related configuration, like which annotations are to be displayed
type AdditionalDisplayItem struct {
	Annotation string `yaml:"annotation"`
	Title      string `yaml:"title"`
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

// ApiDocumentation is the top level configuration for API documentation
type ApiDocumentation struct {
	Annotations ApiDocAnnotations `yaml:"annotations,omitempty" json:"annotations"`
}

// ApiDocAnnotations contains the annotation names used for API documentation
type ApiDocAnnotations struct {
	ApiSpecAnnotationName string `yaml:"api_spec_annotation_name,omitempty" json:"apiSpecAnnotationName"`
	ApiTypeAnnotationName string `yaml:"api_type_annotation_name,omitempty" json:"apiTypeAnnotationName"`
}

// AuthConfig provides details on how users are to authenticate
type AuthConfig struct {
	LDAP     LDAPConfig `yaml:"ldap,omitempty"`
	Strategy string     `yaml:"strategy,omitempty"`
}

// LDAPConfig provides the details of the LDAP related configuration
type LDAPConfig struct {
	LDAPBase               string `yaml:"ldap_base,omitempty"`
	LDAPBindDN             string `yaml:"ldap_bind_dn,omitempty"`
	LDAPInsecureSkipVerify bool   `yaml:"ldap_insecure_skip_verify,omitempty"`
	LDAPGroupFilter        string `yaml:"ldap_group_filter,omitempty"`
	LDAPHost               string `yaml:"ldap_host,omitempty"`
	LDAPMailIDKey          string `yaml:"ldap_mail_id_key,omitempty"`
	LDAPMemberOfKey        string `yaml:"ldap_member_of_key,omitempty"`
	LDAPPort               int    `yaml:"ldap_port,omitempty"`
	LDAPRoleFilter         string `yaml:"ldap_role_filter,omitempty"`
	LDAPSearchFilter       string `yaml:"ldap_search_filter,omitempty"`
	LDAPUserFilter         string `yaml:"ldap_user_filter,omitempty"`
	LDAPUserIDKey          string `yaml:"ldap_user_id_key,omitempty"`
	LDAPUseSSL             bool   `yaml:"ldap_use_ssl,omitempty"`
}

// DeploymentConfig provides details on how Kiali was deployed.
type DeploymentConfig struct {
	AccessibleNamespaces []string `yaml:"accessible_namespaces"`
	Namespace            string   `yaml:"namespace,omitempty"` // Kiali deployment namespace
}

// IstioComponentNamespaces holds the component-specific Istio namespaces. Any missing component
// defaults to the namespace configured for IstioNamespace (which itself defaults to 'istio-system').
type IstioComponentNamespaces map[string]string

// Config defines full YAML configuration.
type Config struct {
	AdditionalDisplayDetails []AdditionalDisplayItem  `yaml:"additional_display_details,omitempty"`
	API                      ApiConfig                `yaml:"api,omitempty"`
	ApiDocumentation         ApiDocumentation         `yaml:"apidocs,omitempty"`
	Auth                     AuthConfig               `yaml:"auth,omitempty"`
	Deployment               DeploymentConfig         `yaml:"deployment,omitempty"`
	ExternalServices         ExternalServices         `yaml:"external_services,omitempty"`
	Identity                 security.Identity        `yaml:",omitempty"`
	InCluster                bool                     `yaml:"in_cluster,omitempty"`
	InstallationTag          string                   `yaml:"installation_tag,omitempty"`
	IstioComponentNamespaces IstioComponentNamespaces `yaml:"istio_component_namespaces,omitempty"`
	IstioLabels              IstioLabels              `yaml:"istio_labels,omitempty"`
	IstioNamespace           string                   `yaml:"istio_namespace,omitempty"` // default component namespace
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
		ApiDocumentation: ApiDocumentation{
			Annotations: ApiDocAnnotations{
				ApiTypeAnnotationName: "kiali.io/api-type",
				ApiSpecAnnotationName: "kiali.io/api-spec",
			},
		},
		Auth: AuthConfig{
			Strategy: "login",
		},
		Deployment: DeploymentConfig{
			AccessibleNamespaces: []string{"**"},
			Namespace:            "istio-system",
		},
		ExternalServices: ExternalServices{
			Grafana: GrafanaConfig{
				Auth: Auth{
					Type: AuthTypeNone,
				},
				Enabled: true,
			},
			Istio: IstioConfig{
				IstioIdentityDomain:    "svc.cluster.local",
				IstioSidecarAnnotation: "sidecar.istio.io/status",
				UrlServiceVersion:      "http://istio-pilot:8080/version",
			},
			Prometheus: PrometheusConfig{
				Auth: Auth{
					Type: AuthTypeNone,
				},
				CustomMetricsURL: "http://prometheus.istio-system:9090",
				URL:              "http://prometheus.istio-system:9090",
			},
			ThreeScale: ThreeScaleConfig{
				AdapterName:    "threescale",
				AdapterPort:    "3333",
				AdapterService: "threescale-istio-adapter",
			},
			Tracing: TracingConfig{
				Auth: Auth{
					Type: AuthTypeNone,
				},
				Enabled:           true,
				NamespaceSelector: true,
				InClusterURL:      "http://tracing.istio-system/jaeger",
				URL:               "",
			},
		},
		IstioLabels: IstioLabels{
			AppLabelName:     "app",
			VersionLabelName: "version",
		},
		KubernetesConfig: KubernetesConfig{
			Burst:                       200,
			CacheDuration:               5 * 60,
			CacheEnabled:                false,
			CacheIstioTypes:             []string{"DestinationRule", "Gateway", "ServiceEntry", "VirtualService"},
			CacheNamespaces:             []string{},
			CacheTokenNamespaceDuration: 10,
			ExcludeWorkloads:            []string{"CronJob", "DeploymentConfig", "Job", "ReplicationController", "StatefulSet"},
			QPS:                         175,
		},
		LoginToken: LoginToken{
			ExpirationSeconds: 24 * 3600,
			SigningKey:        "kiali",
		},
		Server: Server{
			AuditLog: true,
			Credentials: security.Credentials{
				Username:   getDefaultStringFromFile(LoginSecretUsername, ""),
				Passphrase: getDefaultStringFromFile(LoginSecretPassphrase, ""),
			},
			GzipEnabled:                true,
			MetricsEnabled:             true,
			MetricsPort:                9090,
			Port:                       20001,
			StaticContentRootDirectory: "/opt/kiali/console",
			WebRoot:                    "/",
		},
	}

	return
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
	configuration = *conf
}

func getDefaultStringFromFile(filename string, defaultValue string) (retVal string) {
	if fileContents, err := ioutil.ReadFile(filename); err == nil {
		retVal = string(fileContents)
	} else {
		retVal = defaultValue
	}
	return
}

// String marshals the given Config into a YAML string
func (conf Config) String() (str string) {
	str, err := Marshal(&conf)
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

// GetIstioComponentNamespace returns the Istio component namespace (defaulting to IstioNamespace)
func GetIstioComponentNamespace(component string) string {
	if ns, found := configuration.IstioComponentNamespaces[component]; found {
		return ns
	}
	return configuration.IstioNamespace
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
