package config

import (
	"fmt"
	"io/ioutil"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	yaml "gopkg.in/yaml.v2"

	"github.com/kiali/kiali/config/security"
	"github.com/kiali/kiali/log"
)

// Environment vars can define some default values.
// NOTE: If you add a new variable, don't forget to update README.adoc
const (
	EnvInstallationTag = "KIALI_INSTALLATION_TAG"

	EnvIdentityCertFile       = "IDENTITY_CERT_FILE"
	EnvIdentityPrivateKeyFile = "IDENTITY_PRIVATE_KEY_FILE"

	EnvInCluster              = "IN_CLUSTER"
	EnvIstioIdentityDomain    = "ISTIO_IDENTITY_DOMAIN"
	EnvIstioSidecarAnnotation = "ISTIO_SIDECAR_ANNOTATION"
	EnvIstioUrlServiceVersion = "ISTIO_URL_SERVICE_VERSION"
	EnvApiNamespacesExclude   = "API_NAMESPACES_EXCLUDE"

	EnvServerAddress                    = "SERVER_ADDRESS"
	EnvServerPort                       = "SERVER_PORT"
	EnvWebRoot                          = "SERVER_WEB_ROOT"
	EnvServerStaticContentRootDirectory = "SERVER_STATIC_CONTENT_ROOT_DIRECTORY"
	EnvServerCORSAllowAll               = "SERVER_CORS_ALLOW_ALL"
	EnvServerAuditLog                   = "SERVER_AUDIT_LOG"
	EnvServerMetricsPort                = "SERVER_METRICS_PORT"
	EnvServerMetricsEnabled             = "SERVER_METRICS_ENABLED"

	EnvAuthSuffixType               = "_AUTH_TYPE"
	EnvAuthSuffixUsername           = "_USERNAME"
	EnvAuthSuffixPassword           = "_PASSWORD"
	EnvAuthSuffixToken              = "_TOKEN"
	EnvAuthSuffixUseKialiToken      = "_USE_KIALI_TOKEN"
	EnvAuthSuffixCAFile             = "_CA_FILE"
	EnvAuthSuffixInsecureSkipVerify = "_INSECURE_SKIP_VERIFY"

	EnvPrometheusServiceURL       = "PROMETHEUS_SERVICE_URL"
	EnvPrometheusCustomMetricsURL = "PROMETHEUS_CUSTOM_METRICS_URL"

	EnvGrafanaDisplayLink  = "GRAFANA_DISPLAY_LINK"
	EnvGrafanaInClusterURL = "GRAFANA_IN_CLUSTER_URL"
	EnvGrafanaURL          = "GRAFANA_URL"

	EnvTracingEnabled          = "TRACING_ENABLED"
	EnvTracingURL              = "TRACING_URL"
	EnvTracingServiceNamespace = "TRACING_SERVICE_NAMESPACE"

	EnvThreeScaleAdapterName = "THREESCALE_ADAPTER_NAME"
	EnvThreeScaleServiceName = "THREESCALE_SERVICE_NAME"
	EnvThreeScaleServicePort = "THREESCALE_SERVICE_PORT"

	EnvLoginTokenSigningKey        = "LOGIN_TOKEN_SIGNING_KEY"
	EnvLoginTokenExpirationSeconds = "LOGIN_TOKEN_EXPIRATION_SECONDS"
	EnvIstioNamespace              = "ISTIO_NAMESPACE"

	EnvIstioLabelNameApp     = "ISTIO_LABEL_NAME_APP"
	EnvIstioLabelNameVersion = "ISTIO_LABEL_NAME_VERSION"

	EnvKubernetesBurst         = "KUBERNETES_BURST"
	EnvKubernetesQPS           = "KUBERNETES_QPS"
	EnvKubernetesCacheEnabled  = "KUBERNETES_CACHE_ENABLED"
	EnvKubernetesCacheDuration = "KUBERNETES_CACHE_DURATION"

	EnvAuthStrategy = "AUTH_STRATEGY"

	EnvNamespaceLabelSelector = "NAMESPACE_LABEL_SELECTOR"
)

// The versions that Kiali requires
const (
	IstioVersionSupported   = ">= 1.1"
	MaistraVersionSupported = ">= 0.7.0"
)

// The valid auth strategies and values for cookie handling
const (
	AuthStrategyOpenshift = "openshift"
	AuthStrategyLogin     = "login"
	AuthStrategyAnonymous = "anonymous"

	TokenCookieName             = "kiali-token"
	AuthStrategyOpenshiftIssuer = "kiali-openshift"
	AuthStrategyLoginIssuer     = "kiali-login"

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

// Global configuration for the application.
var configuration Config
var rwMutex sync.RWMutex

// Server configuration
type Server struct {
	Address                    string               `yaml:",omitempty"`
	Port                       int                  `yaml:",omitempty"`
	Credentials                security.Credentials `yaml:",omitempty"`
	WebRoot                    string               `yaml:"web_root,omitempty"`
	StaticContentRootDirectory string               `yaml:"static_content_root_directory,omitempty"`
	CORSAllowAll               bool                 `yaml:"cors_allow_all,omitempty"`
	AuditLog                   bool                 `yaml:"audit_log,omitempty"`
	MetricsPort                int                  `yaml:"metrics_port,omitempty"`
	MetricsEnabled             bool                 `yaml:"metrics_enabled,omitempty"`
}

// Auth provides authentication data for external services
type Auth struct {
	Type               string `yaml:"type"`
	Username           string `yaml:"username"`
	Password           string `yaml:"password"`
	Token              string `yaml:"token"`
	UseKialiToken      bool   `yaml:"use_kiali_token"`
	CAFile             string `yaml:"ca_file"`
	InsecureSkipVerify bool   `yaml:"insecure_skip_verify"`
}

// PrometheusConfig describes configuration of the Prometheus component
type PrometheusConfig struct {
	URL              string `yaml:"url,omitempty"`
	CustomMetricsURL string `yaml:"custom_metrics_url,omitempty"`
	Auth             Auth   `yaml:"auth,omitempty"`
}

// GrafanaConfig describes configuration used for Grafana links
type GrafanaConfig struct {
	DisplayLink  bool   `yaml:"display_link"`
	InClusterURL string `yaml:"in_cluster_url"`
	URL          string `yaml:"url"`
	Auth         Auth   `yaml:"auth"`
}

// TracingConfig describes configuration used for tracing links
type TracingConfig struct {
	// Enable autodiscover and Jaeger in Kiali
	Enabled   bool   `yaml:"enabled"`
	Namespace string `yaml:"namespace"`
	Service   string `yaml:"service"`
	URL       string `yaml:"url"`
	Auth      Auth   `yaml:"auth"`
	// Path store the value of QUERY_BASE_PATH
	Path string `yaml:"-"`
}

// IstioConfig describes configuration used for istio links
type IstioConfig struct {
	UrlServiceVersion      string `yaml:"url_service_version"`
	IstioIdentityDomain    string `yaml:"istio_identity_domain,omitempty"`
	IstioSidecarAnnotation string `yaml:"istio_sidecar_annotation,omitempty"`
}

// ThreeScaleConfig describes configuration used for 3Scale adapter
type ThreeScaleConfig struct {
	AdapterName    string `yaml:"adapter_name"`
	AdapterService string `yaml:"adapter_service"`
	AdapterPort    string `yaml:"adapter_port"`
}

// ExternalServices holds configurations for other systems that Kiali depends on
type ExternalServices struct {
	Istio      IstioConfig      `yaml:"istio,omitempty"`
	Prometheus PrometheusConfig `yaml:"prometheus,omitempty"`
	Grafana    GrafanaConfig    `yaml:"grafana,omitempty"`
	Tracing    TracingConfig    `yaml:"tracing,omitempty"`
	ThreeScale ThreeScaleConfig `yaml:"threescale,omitempty"`
}

// LoginToken holds config used in token-based authentication
type LoginToken struct {
	SigningKey        string `yaml:"signing_key,omitempty"`
	ExpirationSeconds int64  `yaml:"expiration_seconds,omitempty"`
}

// IstioLabels holds configuration about the labels required by Istio
type IstioLabels struct {
	AppLabelName     string `yaml:"app_label_name,omitempty" json:"appLabelName"`
	VersionLabelName string `yaml:"version_label_name,omitempty" json:"versionLabelName"`
}

// KubernetesConfig holds the k8s client configuration
type KubernetesConfig struct {
	Burst         int     `yaml:"burst,omitempty"`
	QPS           float32 `yaml:"qps,omitempty"`
	CacheEnabled  bool    `yaml:"cache_enabled,omitempty"`
	CacheDuration int64   `yaml:"cache_duration,omitempty"`
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
	Strategy string `yaml:"strategy,omitempty"`
}

// DeploymentConfig provides details on how Kiali was deployed.
type DeploymentConfig struct {
	AccessibleNamespaces []string `yaml:"accessible_namespaces"`
}

// Config defines full YAML configuration.
type Config struct {
	Identity         security.Identity `yaml:",omitempty"`
	Server           Server            `yaml:",omitempty"`
	InCluster        bool              `yaml:"in_cluster,omitempty"`
	ExternalServices ExternalServices  `yaml:"external_services,omitempty"`
	LoginToken       LoginToken        `yaml:"login_token,omitempty"`
	IstioNamespace   string            `yaml:"istio_namespace,omitempty"`
	InstallationTag  string            `yaml:"installation_tag,omitempty"`
	IstioLabels      IstioLabels       `yaml:"istio_labels,omitempty"`
	KubernetesConfig KubernetesConfig  `yaml:"kubernetes_config,omitempty"`
	API              ApiConfig         `yaml:"api,omitempty"`
	Auth             AuthConfig        `yaml:"auth,omitempty"`
	Deployment       DeploymentConfig  `yaml:"deployment,omitempty"`
}

// NewConfig creates a default Config struct
func NewConfig() (c *Config) {
	c = new(Config)

	c.InstallationTag = getDefaultString(EnvInstallationTag, "")

	c.Identity.CertFile = getDefaultString(EnvIdentityCertFile, "")
	c.Identity.PrivateKeyFile = getDefaultString(EnvIdentityPrivateKeyFile, "")
	c.InCluster = getDefaultBool(EnvInCluster, true)
	c.IstioNamespace = strings.TrimSpace(getDefaultString(EnvIstioNamespace, "istio-system"))
	c.IstioLabels.AppLabelName = strings.TrimSpace(getDefaultString(EnvIstioLabelNameApp, "app"))
	c.IstioLabels.VersionLabelName = strings.TrimSpace(getDefaultString(EnvIstioLabelNameVersion, "version"))
	c.API.Namespaces.Exclude = getDefaultStringArray(EnvApiNamespacesExclude, "istio-operator,kube.*,openshift.*,ibm.*")
	c.API.Namespaces.LabelSelector = strings.TrimSpace(getDefaultString(EnvNamespaceLabelSelector, ""))

	// Server configuration
	c.Server.Address = strings.TrimSpace(getDefaultString(EnvServerAddress, ""))
	c.Server.Port = getDefaultInt(EnvServerPort, 20000)
	c.Server.Credentials = security.Credentials{
		Username:   getDefaultStringFromFile(LoginSecretUsername, ""),
		Passphrase: getDefaultStringFromFile(LoginSecretPassphrase, ""),
	}

	c.Server.WebRoot = strings.TrimSpace(getDefaultString(EnvWebRoot, "/"))
	c.Server.StaticContentRootDirectory = strings.TrimSpace(getDefaultString(EnvServerStaticContentRootDirectory, "/opt/kiali/console"))
	c.Server.CORSAllowAll = getDefaultBool(EnvServerCORSAllowAll, false)
	c.Server.AuditLog = getDefaultBool(EnvServerAuditLog, true)
	c.Server.MetricsPort = getDefaultInt(EnvServerMetricsPort, 9090)
	c.Server.MetricsEnabled = getDefaultBool(EnvServerMetricsEnabled, true)

	// Prometheus configuration
	c.ExternalServices.Prometheus.URL = strings.TrimSpace(getDefaultString(EnvPrometheusServiceURL, fmt.Sprintf("http://prometheus.%s:9090", c.IstioNamespace)))
	c.ExternalServices.Prometheus.CustomMetricsURL = strings.TrimSpace(getDefaultString(EnvPrometheusCustomMetricsURL, c.ExternalServices.Prometheus.URL))
	c.ExternalServices.Prometheus.Auth = getAuthFromEnv("PROMETHEUS")

	// Grafana Configuration
	c.ExternalServices.Grafana.DisplayLink = getDefaultBool(EnvGrafanaDisplayLink, true)
	c.ExternalServices.Grafana.InClusterURL = strings.TrimSpace(getDefaultString(EnvGrafanaInClusterURL, ""))
	c.ExternalServices.Grafana.URL = strings.TrimSpace(getDefaultString(EnvGrafanaURL, ""))
	c.ExternalServices.Prometheus.Auth = getAuthFromEnv("GRAFANA")

	// Tracing Configuration
	c.ExternalServices.Tracing.Enabled = getDefaultBool(EnvTracingEnabled, true)
	c.ExternalServices.Tracing.Path = ""
	c.ExternalServices.Tracing.URL = strings.TrimSpace(getDefaultString(EnvTracingURL, ""))
	c.ExternalServices.Tracing.Namespace = strings.TrimSpace(getDefaultString(EnvTracingServiceNamespace, c.IstioNamespace))
	c.ExternalServices.Tracing.Auth = getAuthFromEnv("TRACING")

	// Istio Configuration
	c.ExternalServices.Istio.IstioIdentityDomain = strings.TrimSpace(getDefaultString(EnvIstioIdentityDomain, "svc.cluster.local"))
	c.ExternalServices.Istio.IstioSidecarAnnotation = strings.TrimSpace(getDefaultString(EnvIstioSidecarAnnotation, "sidecar.istio.io/status"))
	c.ExternalServices.Istio.UrlServiceVersion = strings.TrimSpace(getDefaultString(EnvIstioUrlServiceVersion, "http://istio-pilot:8080/version"))

	// ThreeScale Configuration
	c.ExternalServices.ThreeScale.AdapterName = strings.TrimSpace(getDefaultString(EnvThreeScaleAdapterName, "threescale"))
	c.ExternalServices.ThreeScale.AdapterService = strings.TrimSpace(getDefaultString(EnvThreeScaleServiceName, "threescale-istio-adapter"))
	c.ExternalServices.ThreeScale.AdapterPort = strings.TrimSpace(getDefaultString(EnvThreeScaleServicePort, "3333"))

	// Token-based authentication Configuration
	c.LoginToken.SigningKey = strings.TrimSpace(getDefaultString(EnvLoginTokenSigningKey, "kiali"))
	c.LoginToken.ExpirationSeconds = getDefaultInt64(EnvLoginTokenExpirationSeconds, 24*3600)

	// Kubernetes client Configuration
	c.KubernetesConfig.Burst = getDefaultInt(EnvKubernetesBurst, 200)
	c.KubernetesConfig.QPS = getDefaultFloat32(EnvKubernetesQPS, 175)
	c.KubernetesConfig.CacheEnabled = getDefaultBool(EnvKubernetesCacheEnabled, false)
	c.KubernetesConfig.CacheDuration = getDefaultInt64(EnvKubernetesCacheDuration, time.Duration(5*time.Minute).Nanoseconds())

	trimmedExclusionPatterns := []string{}
	for _, entry := range c.API.Namespaces.Exclude {
		exclusionPattern := strings.TrimSpace(entry)
		if _, err := regexp.Compile(exclusionPattern); err != nil {
			log.Errorf("Invalid namespace exclude entry, [%s] is not a valid regex pattern: %v", exclusionPattern, err)
		} else {
			trimmedExclusionPatterns = append(trimmedExclusionPatterns, strings.TrimSpace(exclusionPattern))
		}
	}
	c.API.Namespaces.Exclude = trimmedExclusionPatterns

	c.Auth.Strategy = getDefaultString(EnvAuthStrategy, AuthStrategyLogin)

	c.Deployment.AccessibleNamespaces = getDefaultStringArray("_not_overridable_via_env", "**")

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

func getDefaultString(envvar string, defaultValue string) (retVal string) {
	retVal = os.Getenv(envvar)
	if retVal == "" {
		retVal = defaultValue
	}
	return
}

func getDefaultStringArray(envvar string, defaultValue string) (retVal []string) {
	csv := os.Getenv(envvar)
	if csv == "" {
		csv = defaultValue
	}
	retVal = strings.Split(csv, ",")
	return
}

func getDefaultInt(envvar string, defaultValue int) (retVal int) {
	retValString := os.Getenv(envvar)
	if retValString == "" {
		retVal = defaultValue
	} else {
		if num, err := strconv.Atoi(retValString); err != nil {
			log.Warningf("Invalid number for envvar [%v]. err=%v", envvar, err)
			retVal = defaultValue
		} else {
			retVal = num
		}
	}
	return
}

func getDefaultInt64(envvar string, defaultValue int64) (retVal int64) {
	retValString := os.Getenv(envvar)
	if retValString == "" {
		retVal = defaultValue
	} else {
		if num, err := strconv.ParseInt(retValString, 10, 64); err != nil {
			log.Warningf("Invalid number for envvar [%v]. err=%v", envvar, err)
			retVal = defaultValue
		} else {
			retVal = num
		}
	}
	return
}

func getDefaultBool(envvar string, defaultValue bool) (retVal bool) {
	retValString := os.Getenv(envvar)
	if retValString == "" {
		retVal = defaultValue
	} else {
		if b, err := strconv.ParseBool(retValString); err != nil {
			log.Warningf("Invalid boolean for envvar [%v]. err=%v", envvar, err)
			retVal = defaultValue
		} else {
			retVal = b
		}
	}
	return
}

func getDefaultFloat32(envvar string, defaultValue float32) (retVal float32) {
	retValString := os.Getenv(envvar)
	if retValString == "" {
		retVal = defaultValue
	} else {
		if f, err := strconv.ParseFloat(retValString, 32); err != nil {
			log.Warningf("Invalid float number for envvar [%v]. err=%v", envvar, err)
			retVal = defaultValue
		} else {
			retVal = float32(f)
		}
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

func getAuthFromEnv(prefix string) Auth {
	auth := Auth{}
	auth.Type = strings.TrimSpace(getDefaultString(prefix+EnvAuthSuffixType, AuthTypeNone))
	switch auth.Type {
	case AuthTypeBasic:
		auth.Username = strings.TrimSpace(getDefaultString(prefix+EnvAuthSuffixUsername, ""))
		auth.Password = strings.TrimSpace(getDefaultString(prefix+EnvAuthSuffixPassword, ""))
	case AuthTypeBearer:
		auth.Token = strings.TrimSpace(getDefaultString(prefix+EnvAuthSuffixToken, ""))
		auth.UseKialiToken = getDefaultBool(prefix+EnvAuthSuffixUseKialiToken, false)
	case AuthTypeNone:
	default:
		log.Errorf("Unknown authentication strategy for %s: '%s'. Valid options are %s, %s or %s", prefix, auth.Type, AuthTypeNone, AuthTypeBasic, AuthTypeBearer)
	}
	auth.InsecureSkipVerify = getDefaultBool(prefix+EnvAuthSuffixInsecureSkipVerify, false)
	auth.CAFile = strings.TrimSpace(getDefaultString(prefix+EnvAuthSuffixCAFile, ""))
	return auth
}
