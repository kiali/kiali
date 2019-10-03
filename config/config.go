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

// Environment vars can define some default values. This list is ALPHABETIZED for readability.
const (
	EnvActiveNamespace                  = "ACTIVE_NAMESPACE"
	EnvApiDocAnnotationNameApiType      = "APIDOC_ANNOTATION_NAME_API_TYPE"
	EnvApiDocAnnotationNameApiSpec      = "APIDOC_ANNOTATION_NAME_API_SPEC"
	EnvApiNamespacesExclude             = "API_NAMESPACES_EXCLUDE"
	EnvAuthStrategy                     = "AUTH_STRATEGY"
	EnvAuthSuffixCAFile                 = "_CA_FILE"
	EnvAuthSuffixInsecureSkipVerify     = "_INSECURE_SKIP_VERIFY"
	EnvAuthSuffixPassword               = "_PASSWORD"
	EnvAuthSuffixToken                  = "_TOKEN"
	EnvAuthSuffixType                   = "_AUTH_TYPE"
	EnvAuthSuffixUseKialiToken          = "_USE_KIALI_TOKEN"
	EnvAuthSuffixUsername               = "_USERNAME"
	EnvGrafanaEnabled                   = "GRAFANA_ENABLED"
	EnvGrafanaInClusterURL              = "GRAFANA_IN_CLUSTER_URL"
	EnvGrafanaURL                       = "GRAFANA_URL"
	EnvIdentityCertFile                 = "IDENTITY_CERT_FILE"
	EnvIdentityPrivateKeyFile           = "IDENTITY_PRIVATE_KEY_FILE"
	EnvInCluster                        = "IN_CLUSTER"
	EnvInstallationTag                  = "KIALI_INSTALLATION_TAG"
	EnvIstioComponentNamespaces         = "ISTIO_COMPONENT_NAMESPACES"
	EnvIstioIdentityDomain              = "ISTIO_IDENTITY_DOMAIN"
	EnvIstioLabelNameApp                = "ISTIO_LABEL_NAME_APP"
	EnvIstioLabelNameVersion            = "ISTIO_LABEL_NAME_VERSION"
	EnvIstioNamespace                   = "ISTIO_NAMESPACE"
	EnvIstioSidecarAnnotation           = "ISTIO_SIDECAR_ANNOTATION"
	EnvIstioUrlServiceVersion           = "ISTIO_URL_SERVICE_VERSION"
	EnvKubernetesBurst                  = "KUBERNETES_BURST"
	EnvKubernetesQPS                    = "KUBERNETES_QPS"
	EnvKubernetesCacheEnabled           = "KUBERNETES_CACHE_ENABLED"
	EnvKubernetesCacheDuration          = "KUBERNETES_CACHE_DURATION"
	EnvKubernetesCacheNamespaces        = "KUBERNETES_CACHE_KUBERNETES"
	EnvKubernetesExcludeWorkloads       = "KUBERNETES_EXCLUDE_WORKLOADS"
	EnvLdapBase                         = "LDAP_BASE"
	EnvLdapBindDN                       = "LDAP_BIND_DN"
	EnvLdapGroupFilter                  = "LDAP_GROUP_FILTER"
	EnvLdapHost                         = "LDAP_HOST"
	EnvLdapInsecureSkipVerify           = "LDAP_INSECURE_SKIP_VERIFY"
	EnvLdapMailIdKey                    = "LDAP_MAIL_ID_KEY"
	EnvLdapMemberOfKey                  = "LDAP_MEMBER_OF_KEY"
	EnvLdapPort                         = "LDAP_PORT"
	EnvLdapRoleFilter                   = "LDAP_ROLE_FILTER"
	EnvLdapSearchFilter                 = "LDAP_SEARCH_FILTER"
	EnvLdapUserFilter                   = "LDAP_USER_FILTER"
	EnvLdapUserIdKey                    = "LDAP_USER_ID_KEY"
	EnvLdapUseSSL                       = "LDAP_USE_SSL"
	EnvLoginTokenExpirationSeconds      = "LOGIN_TOKEN_EXPIRATION_SECONDS"
	EnvLoginTokenSigningKey             = "LOGIN_TOKEN_SIGNING_KEY"
	EnvNamespaceLabelSelector           = "NAMESPACE_LABEL_SELECTOR"
	EnvPrometheusCustomMetricsURL       = "PROMETHEUS_CUSTOM_METRICS_URL"
	EnvPrometheusServiceURL             = "PROMETHEUS_SERVICE_URL"
	EnvServerAddress                    = "SERVER_ADDRESS"
	EnvServerAuditLog                   = "SERVER_AUDIT_LOG"
	EnvServerCORSAllowAll               = "SERVER_CORS_ALLOW_ALL"
	EnvServerGzipEnabled                = "SERVER_GZIP_ENABLED"
	EnvServerMetricsPort                = "SERVER_METRICS_PORT"
	EnvServerMetricsEnabled             = "SERVER_METRICS_ENABLED"
	EnvServerPort                       = "SERVER_PORT"
	EnvServerStaticContentRootDirectory = "SERVER_STATIC_CONTENT_ROOT_DIRECTORY"
	EnvThreeScaleAdapterName            = "THREESCALE_ADAPTER_NAME"
	EnvThreeScaleServiceName            = "THREESCALE_SERVICE_NAME"
	EnvThreeScaleServicePort            = "THREESCALE_SERVICE_PORT"
	EnvTracingEnabled                   = "TRACING_ENABLED"
	EnvTracingInClusterURL              = "TRACING_IN_CLUSTER_URL"
	EnvTracingServiceNamespace          = "TRACING_SERVICE_NAMESPACE"
	EnvTracingServicePort               = "TRACING_SERVICE_PORT"
	EnvTracingURL                       = "TRACING_URL"
	EnvWebRoot                          = "SERVER_WEB_ROOT"
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

const (
	IstioMultiClusterHostSuffix = "global"
)

// Global configuration for the application.
var configuration Config
var rwMutex sync.RWMutex

// Server configuration
type Server struct {
	Address                    string               `yaml:",omitempty"`
	AuditLog                   bool                 `yaml:"audit_log,omitempty"`
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
	// Enable or disable Grafana support in Kiali
	Enabled      bool                     `yaml:"enabled"`
	InClusterURL string                   `yaml:"in_cluster_url"`
	URL          string                   `yaml:"url"`
	Auth         Auth                     `yaml:"auth"`
	Dashboards   []GrafanaDashboardConfig `yaml:"dashboards"`
}

type GrafanaDashboardConfig struct {
	Name      string                 `yaml:"name"`
	Variables GrafanaVariablesConfig `yaml:"variables"`
}

type GrafanaVariablesConfig struct {
	Namespace string `yaml:"namespace" json:"namespace,omitempty"`
	App       string `yaml:"app" json:"app,omitempty"`
	Service   string `yaml:"service" json:"service,omitempty"`
	Version   string `yaml:"version" json:"version,omitempty"`
	Workload  string `yaml:"workload" json:"workload,omitempty"`
}

// TracingConfig describes configuration used for tracing links
type TracingConfig struct {
	// Enable autodiscover and Jaeger in Kiali
	Enabled      bool   `yaml:"enabled"`
	Namespace    string `yaml:"namespace"`
	Service      string `yaml:"service"`
	Port         int32  `yaml:"port"`
	URL          string `yaml:"url"`
	Auth         Auth   `yaml:"auth"`
	InClusterURL string `yaml:"in_cluster_url"`
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

// KubernetesConfig holds the k8s client, caching and performance configuration
type KubernetesConfig struct {
	Burst         		int      `yaml:"burst,omitempty"`
	QPS           		float32  `yaml:"qps,omitempty"`
	// Enable cache for kubernetes and istio resources
	CacheEnabled  		bool     `yaml:"cache_enabled,omitempty"`
	// Cache duration expressed in nanoseconds
	// Cache uses watchers to sync with the backend, after a CacheDuration watchers are closed and re-opened
	CacheDuration 		int64    `yaml:"cache_duration,omitempty"`
	// List of namespaces or regex defining namespaces to include in a cache
	CacheNamespaces 	[]string `yaml:"cache_namespaces,omitempty"`
	// List of controllers that won't be used for Workload calculation
	// Kiali queries: Deployment,ReplicaSet,ReplicationController,DeploymentConfig,StatefulSet,Job and CronJob controllers
	// If user has knowledge that some of them won't be used, Kiali can skip those queries.
	ExcludeWorkloads 	[]string `yaml:"excluded_workloads,omitempty"`
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
	ApiTypeAnnotationName string `yaml:"api_type_annotation_name,omitempty" json:"apiTypeAnnotationName"`
	ApiSpecAnnotationName string `yaml:"api_spec_annotation_name,omitempty" json:"apiSpecAnnotationName"`
}

// AuthConfig provides details on how users are to authenticate
type AuthConfig struct {
	Strategy string     `yaml:"strategy,omitempty"`
	LDAP     LDAPConfig `yaml:"ldap,omitempty"`
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
	Identity                 security.Identity        `yaml:",omitempty"`
	Server                   Server                   `yaml:",omitempty"`
	InCluster                bool                     `yaml:"in_cluster,omitempty"`
	ExternalServices         ExternalServices         `yaml:"external_services,omitempty"`
	LoginToken               LoginToken               `yaml:"login_token,omitempty"`
	IstioNamespace           string                   `yaml:"istio_namespace,omitempty"` // default component namespace
	IstioComponentNamespaces IstioComponentNamespaces `yaml:"istio_component_namespaces,omitempty"`
	InstallationTag          string                   `yaml:"installation_tag,omitempty"`
	IstioLabels              IstioLabels              `yaml:"istio_labels,omitempty"`
	KubernetesConfig         KubernetesConfig         `yaml:"kubernetes_config,omitempty"`
	API                      ApiConfig                `yaml:"api,omitempty"`
	Auth                     AuthConfig               `yaml:"auth,omitempty"`
	Deployment               DeploymentConfig         `yaml:"deployment,omitempty"`
	ApiDocumentation         ApiDocumentation         `yaml:"apidocs,omitempty"`
}

// NewConfig creates a default Config struct
func NewConfig() (c *Config) {
	c = new(Config)
	c.InstallationTag = getDefaultString(EnvInstallationTag, "")

	c.Identity.CertFile = getDefaultString(EnvIdentityCertFile, "")
	c.Identity.PrivateKeyFile = getDefaultString(EnvIdentityPrivateKeyFile, "")
	c.InCluster = getDefaultBool(EnvInCluster, true)
	c.API.Namespaces.Exclude = getDefaultStringArray(EnvApiNamespacesExclude, "istio-operator,kube.*,openshift.*,ibm.*")
	c.API.Namespaces.LabelSelector = strings.TrimSpace(getDefaultString(EnvNamespaceLabelSelector, ""))

	// Server configuration
	c.InstallationTag = getDefaultString(EnvInstallationTag, "")

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
	c.Server.GzipEnabled = getDefaultBool(EnvServerGzipEnabled, true)

	// Istio Configuration
	c.IstioComponentNamespaces = getDefaultStringMap(EnvIstioComponentNamespaces, "")
	c.IstioNamespace = strings.TrimSpace(getDefaultString(EnvIstioNamespace, "istio-system"))
	c.IstioLabels.AppLabelName = strings.TrimSpace(getDefaultString(EnvIstioLabelNameApp, "app"))
	c.IstioLabels.VersionLabelName = strings.TrimSpace(getDefaultString(EnvIstioLabelNameVersion, "version"))

	// API Documentation
	c.ApiDocumentation.Annotations.ApiTypeAnnotationName = strings.TrimSpace(getDefaultString(EnvApiDocAnnotationNameApiType, "kiali.io/api-type"))
	c.ApiDocumentation.Annotations.ApiSpecAnnotationName = strings.TrimSpace(getDefaultString(EnvApiDocAnnotationNameApiSpec, "kiali.io/api-spec"))

	// Prometheus configuration
	c.ExternalServices.Prometheus.URL = strings.TrimSpace(getDefaultString(EnvPrometheusServiceURL, fmt.Sprintf("http://prometheus.%s:9090",
		getIstioComponentNamespace("prometheus", c.IstioNamespace, c.IstioComponentNamespaces))))
	c.ExternalServices.Prometheus.CustomMetricsURL = strings.TrimSpace(getDefaultString(EnvPrometheusCustomMetricsURL, c.ExternalServices.Prometheus.URL))
	c.ExternalServices.Prometheus.Auth = getAuthFromEnv("PROMETHEUS")

	// Grafana Configuration
	c.ExternalServices.Grafana.Enabled = getDefaultBool(EnvGrafanaEnabled, true)
	c.ExternalServices.Grafana.InClusterURL = strings.TrimSpace(getDefaultString(EnvGrafanaInClusterURL, ""))
	c.ExternalServices.Grafana.URL = strings.TrimSpace(getDefaultString(EnvGrafanaURL, ""))
	c.ExternalServices.Grafana.Auth = getAuthFromEnv("GRAFANA")

	// Tracing Configuration
	c.ExternalServices.Tracing.Enabled = getDefaultBool(EnvTracingEnabled, true)
	c.ExternalServices.Tracing.Path = ""
	c.ExternalServices.Tracing.InClusterURL = strings.TrimSpace(getDefaultString(EnvTracingInClusterURL, ""))
	c.ExternalServices.Tracing.URL = strings.TrimSpace(getDefaultString(EnvTracingURL, ""))
	c.ExternalServices.Tracing.Namespace = strings.TrimSpace(getDefaultString(EnvTracingServiceNamespace, getIstioComponentNamespace("tracing", c.IstioNamespace, c.IstioComponentNamespaces)))
	c.ExternalServices.Tracing.Port = getDefaultInt32(EnvTracingServicePort, 16686)
	c.ExternalServices.Tracing.Auth = getAuthFromEnv("TRACING")

	c.ExternalServices.Istio.IstioIdentityDomain = strings.TrimSpace(getDefaultString(EnvIstioIdentityDomain, "svc.cluster.local"))
	c.ExternalServices.Istio.IstioSidecarAnnotation = strings.TrimSpace(getDefaultString(EnvIstioSidecarAnnotation, "sidecar.istio.io/status"))
	c.ExternalServices.Istio.UrlServiceVersion = strings.TrimSpace(getDefaultString(EnvIstioUrlServiceVersion, "http://istio-pilot:8080/version"))

	// ThreeScale ConfigEnvKubernetesCacheNamespacesuration
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
	c.KubernetesConfig.CacheNamespaces = getDefaultStringArray(EnvKubernetesCacheNamespaces, ".*")
	c.KubernetesConfig.ExcludeWorkloads = getDefaultStringArray(EnvKubernetesExcludeWorkloads, "CronJob,Job,ReplicationController,StatefulSet")

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

	c.Auth.LDAP.LDAPHost = getDefaultString(EnvLdapHost, "")
	c.Auth.LDAP.LDAPPort = getDefaultInt(EnvLdapPort, 0)
	c.Auth.LDAP.LDAPBase = getDefaultString(EnvLdapBase, "")
	c.Auth.LDAP.LDAPBindDN = getDefaultString(EnvLdapBindDN, "")
	c.Auth.LDAP.LDAPUseSSL = getDefaultBool(EnvLdapUseSSL, false)
	c.Auth.LDAP.LDAPInsecureSkipVerify = getDefaultBool(EnvLdapInsecureSkipVerify, false)
	c.Auth.LDAP.LDAPUserFilter = getDefaultString(EnvLdapUserFilter, "(cn=%s)")
	c.Auth.LDAP.LDAPGroupFilter = getDefaultString(EnvLdapGroupFilter, "(cn=%s)")
	c.Auth.LDAP.LDAPRoleFilter = getDefaultString(EnvLdapRoleFilter, "")
	c.Auth.LDAP.LDAPSearchFilter = getDefaultString(EnvLdapSearchFilter, "(&(name={USERID}))")
	c.Auth.LDAP.LDAPMailIDKey = getDefaultString(EnvLdapMailIdKey, "mail")
	c.Auth.LDAP.LDAPUserIDKey = getDefaultString(EnvLdapUserIdKey, "cn")
	c.Auth.LDAP.LDAPMemberOfKey = getDefaultString(EnvLdapMemberOfKey, "memberof")

	c.Deployment.AccessibleNamespaces = getDefaultStringArray("_not_overridable_via_env", "**")
	c.Deployment.Namespace = getDefaultString(EnvActiveNamespace, c.IstioNamespace)

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

func getDefaultStringMap(envvar string, defaultValue string) (retVal map[string]string) {
	csv := os.Getenv(envvar)
	if csv == "" {
		csv = defaultValue
	}
	retVal = map[string]string{}
	for _, token := range strings.Split(csv, ",") {
		if token := strings.TrimSpace(token); token == "" {
			continue
		}
		mapEntry := strings.SplitN(token, "=", 2)
		if len(mapEntry) == 2 {
			retVal[strings.TrimSpace(mapEntry[0])] = strings.TrimSpace(mapEntry[1])
			if strings.Contains(mapEntry[1], "=") {
				log.Warningf("Check configuration for [%s]. Entry value for [%s] contains '='. Ignore this warning if intended.", envvar, token)
			}
		} else {
			log.Warningf("Unexpected configuration for [%s]. Expected mapEntry like aa=bb, found [%s]", envvar, token)
		}
	}
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
	return envToInteger(envvar, defaultValue)
}

func getDefaultInt32(envvar string, defaultValue int32) (retVal int32) {
	return int32(envToInteger(envvar, int64(defaultValue)))
}

func envToInteger(envvar string, defaultValue int64) (retVal int64) {
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
	return getIstioComponentNamespace(component, configuration.IstioNamespace, configuration.IstioComponentNamespaces)
}

func getIstioComponentNamespace(component, istioNamespace string, istioComponentNamespaces IstioComponentNamespaces) string {
	if ns, found := istioComponentNamespaces[component]; found {
		return ns
	}
	return istioNamespace
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
