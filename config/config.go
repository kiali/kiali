package config

import (
	"fmt"
	"io/ioutil"
	"os"
	"strconv"
	"strings"

	"gopkg.in/yaml.v2"

	"github.com/kiali/kiali/config/security"
	"github.com/kiali/kiali/log"
)

// Environment vars can define some default values.
// NOTE: If you add a new variable, don't forget to update README.adoc
const (
	EnvIdentityCertFile       = "IDENTITY_CERT_FILE"
	EnvIdentityPrivateKeyFile = "IDENTITY_PRIVATE_KEY_FILE"

	EnvPrometheusServiceURL   = "PROMETHEUS_SERVICE_URL"
	EnvInCluster              = "IN_CLUSTER"
	EnvIstioIdentityDomain    = "ISTIO_IDENTITY_DOMAIN"
	EnvIstioSidecarAnnotation = "ISTIO_SIDECAR_ANNOTATION"

	EnvServerAddress                    = "SERVER_ADDRESS"
	EnvServerPort                       = "SERVER_PORT"
	EnvServerCredentialsUsername        = "SERVER_CREDENTIALS_USERNAME"
	EnvServerCredentialsPassword        = "SERVER_CREDENTIALS_PASSWORD"
	EnvServerStaticContentRootDirectory = "SERVER_STATIC_CONTENT_ROOT_DIRECTORY"
	EnvServerCORSAllowAll               = "SERVER_CORS_ALLOW_ALL"

	EnvGrafanaDisplayLink      = "GRAFANA_DISPLAY_LINK"
	EnvGrafanaURL              = "GRAFANA_URL"
	EnvGrafanaServiceNamespace = "GRAFANA_SERVICE_NAMESPACE"
	EnvGrafanaService          = "GRAFANA_SERVICE"
	EnvGrafanaDashboard        = "GRAFANA_DASHBOARD"
	EnvGrafanaVarServiceSource = "GRAFANA_VAR_SERVICE_SOURCE"
	EnvGrafanaVarServiceDest   = "GRAFANA_VAR_SERVICE_DEST"

	EnvJaegerURL              = "JAEGER_URL"
	EnvJaegerServiceNamespace = "JAEGER_SERVICE_NAMESPACE"
	EnvJaegerService          = "JAEGER_SERVICE"

	EnvServiceFilterLabelName = "SERVICE_FILTER_LABEL_NAME"
	EnvVersionFilterLabelName = "VERSION_FILTER_LABEL_NAME"
)

// Global configuration for the application.
var configuration *Config

// Server configuration
type Server struct {
	Address                    string               `yaml:",omitempty"`
	Port                       int                  `yaml:",omitempty"`
	Credentials                security.Credentials `yaml:",omitempty"`
	StaticContentRootDirectory string               `yaml:"static_content_root_directory,omitempty"`
	CORSAllowAll               bool                 `yaml:"cors_allow_all,omitempty"`
}

// GrafanaConfig describes configuration used for Grafana links
type GrafanaConfig struct {
	DisplayLink      bool   `yaml:"display_link"`
	URL              string `yaml:"url"`
	ServiceNamespace string `yaml:"service_namespace"`
	Service          string `yaml:"service"`
	Dashboard        string `yaml:"dashboard"`
	VarServiceSource string `yaml:"var_service_source"`
	VarServiceDest   string `yaml:"var_service_dest"`
}

// JaegerConfig describes configuration used for jaeger links
type JaegerConfig struct {
	URL              string `yaml:"url"`
	ServiceNamespace string `yaml:"service_namespace"`
	Service          string `yaml:"service"`
}

// Config defines full YAML configuration.
type Config struct {
	Identity               security.Identity `yaml:",omitempty"`
	Server                 Server            `yaml:",omitempty"`
	PrometheusServiceURL   string            `yaml:"prometheus_service_url,omitempty"`
	InCluster              bool              `yaml:"in_cluster,omitempty"`
	IstioIdentityDomain    string            `yaml:"istio_identity_domain,omitempty"`
	IstioSidecarAnnotation string            `yaml:"istio_sidecar_annotation,omitempty"`
	Grafana                GrafanaConfig     `yaml:"grafana,omitempty"`
	Jaeger                 JaegerConfig      `yaml:"jaeger,omitempty"`
	ServiceFilterLabelName string            `yaml:"service_filter_label_name,omitempty"`
	VersionFilterLabelName string            `yaml:"version_filter_label_name,omitempty"`
}

// NewConfig creates a default Config struct
func NewConfig() (c *Config) {
	c = new(Config)

	c.Identity.CertFile = getDefaultString(EnvIdentityCertFile, "")
	c.Identity.PrivateKeyFile = getDefaultString(EnvIdentityPrivateKeyFile, "")

	c.Server.Address = strings.TrimSpace(getDefaultString(EnvServerAddress, ""))
	c.Server.Port = getDefaultInt(EnvServerPort, 20000)
	c.Server.Credentials = security.Credentials{
		Username: getDefaultString(EnvServerCredentialsUsername, ""),
		Password: getDefaultString(EnvServerCredentialsPassword, ""),
	}
	c.Server.StaticContentRootDirectory = strings.TrimSpace(getDefaultString(EnvServerStaticContentRootDirectory, "/static-files"))
	c.Server.CORSAllowAll = getDefaultBool(EnvServerCORSAllowAll, false)
	c.PrometheusServiceURL = strings.TrimSpace(getDefaultString(EnvPrometheusServiceURL, "http://prometheus:9090"))

	c.InCluster = getDefaultBool(EnvInCluster, true)
	c.IstioIdentityDomain = strings.TrimSpace(getDefaultString(EnvIstioIdentityDomain, "svc.cluster.local"))
	c.IstioSidecarAnnotation = strings.TrimSpace(getDefaultString(EnvIstioSidecarAnnotation, "sidecar.istio.io/status"))

	c.Grafana.DisplayLink = getDefaultBool(EnvGrafanaDisplayLink, true)
	c.Grafana.URL = strings.TrimSpace(getDefaultString(EnvGrafanaURL, ""))
	c.Grafana.ServiceNamespace = strings.TrimSpace(getDefaultString(EnvGrafanaServiceNamespace, "istio-system"))
	c.Grafana.Service = strings.TrimSpace(getDefaultString(EnvGrafanaService, "grafana"))
	c.Grafana.Dashboard = strings.TrimSpace(getDefaultString(EnvGrafanaDashboard, "istio-dashboard"))
	c.Grafana.VarServiceSource = strings.TrimSpace(getDefaultString(EnvGrafanaVarServiceSource, "var-source"))
	c.Grafana.VarServiceDest = strings.TrimSpace(getDefaultString(EnvGrafanaVarServiceDest, "var-http_destination"))

	c.Jaeger.URL = strings.TrimSpace(getDefaultString(EnvJaegerURL, ""))
	c.Jaeger.ServiceNamespace = strings.TrimSpace(getDefaultString(EnvJaegerServiceNamespace, "istio-system"))
	c.Jaeger.Service = strings.TrimSpace(getDefaultString(EnvJaegerService, "jaeger-query"))

	c.ServiceFilterLabelName = strings.TrimSpace(getDefaultString(EnvServiceFilterLabelName, "app"))
	c.VersionFilterLabelName = strings.TrimSpace(getDefaultString(EnvVersionFilterLabelName, "version"))
	return
}

// Get the global Config
func Get() (conf *Config) {
	return configuration
}

// Set the global Config
func Set(conf *Config) {
	configuration = conf
}

func getDefaultString(envvar string, defaultValue string) (retVal string) {
	retVal = os.Getenv(envvar)
	if retVal == "" {
		retVal = defaultValue
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
		return nil, fmt.Errorf("Failed to parse yaml data. error=%v", err)
	}
	return
}

// Marshal converts the Config object and returns its YAML string.
func Marshal(conf *Config) (yamlString string, err error) {
	yamlBytes, err := yaml.Marshal(&conf)
	if err != nil {
		return "", fmt.Errorf("Failed to produce yaml. error=%v", err)
	}

	yamlString = string(yamlBytes)
	return
}

// LoadFromFile reads the YAML from the given file, parses the content, and returns its Config object representation.
func LoadFromFile(filename string) (conf *Config, err error) {
	log.Debugf("Reading YAML config from [%s]", filename)
	fileContent, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("Failed to load config file [%v]. error=%v", filename, err)
	}

	return Unmarshal(string(fileContent))
}

// SaveToFile converts the Config object and stores its YAML string into the given file, overwriting any data that is in the file.
func SaveToFile(filename string, conf *Config) (err error) {
	fileContent, err := Marshal(conf)
	if err != nil {
		return fmt.Errorf("Failed to save config file [%v]. error=%v", filename, err)
	}

	log.Debugf("Writing YAML config to [%s]", filename)
	err = ioutil.WriteFile(filename, []byte(fileContent), 0640)
	return
}
