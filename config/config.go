package config

import (
	"fmt"
	"io/ioutil"
	"os"
	"strconv"
	"strings"

	"gopkg.in/yaml.v2"

	"github.com/swift-sunshine/swscore/config/security"
	"github.com/swift-sunshine/swscore/log"
)

// Environment vars can define some default values.
const (
	EnvIdentityCertFile       = "IDENTITY_CERT_FILE"
	EnvIdentityPrivateKeyFile = "IDENTITY_PRIVATE_KEY_FILE"

	EnvPrometheusServiceURL = "PROMETHEUS_SERVICE_URL"
	EnvIstioIdentityDomain  = "ISTIO_IDENTITY_DOMAIN"

	EnvServerAddress                    = "SERVER_ADDRESS"
	EnvServerPort                       = "SERVER_PORT"
	EnvServerCredentialsUsername        = "SERVER_CREDENTIALS_USERNAME"
	EnvServerCredentialsPassword        = "SERVER_CREDENTIALS_PASSWORD"
	EnvServerStaticContentRootDirectory = "SERVER_STATIC_CONTENT_ROOT_DIRECTORY"
	EnvServerCORSAllowAll               = "SERVER_CORS_ALLOW_ALL"
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

// Config defines full YAML configuration.
type Config struct {
	Identity             security.Identity `yaml:",omitempty"`
	Server               Server            `yaml:",omitempty"`
	PrometheusServiceURL string            `yaml:"prometheus_service_url,omitempty"`
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
	c.IstioIdentityDomain = strings.TrimSpace(getDefaultString(ENV_ISTIO_IDENTITY_DOMAIN, "svc.cluster.local"))
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
