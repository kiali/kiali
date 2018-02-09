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
	ENV_IDENTITY_CERT_FILE        = "IDENTITY_CERT_FILE"
	ENV_IDENTITY_PRIVATE_KEY_FILE = "IDENTITY_PRIVATE_KEY_FILE"

	ENV_FILESERVER_ADDRESS              = "FILESERVER_ADDRESS"
	ENV_FILESERVER_PORT                 = "FILESERVER_PORT"
	ENV_FILESERVER_CREDENTIALS_USERNAME = "FILESERVER_CREDENTIALS_USERNAME"
	ENV_FILESERVER_CREDENTIALS_PASSWORD = "FILESERVER_CREDENTIALS_PASSWORD"
	ENV_FILESERVER_ROOT_DIRECTORY       = "FILESERVER_ROOT_DIRECTORY"
)

// USED FOR YAML
type FileServer struct {
	Address        string               ",omitempty"
	Port           int                  ",omitempty"
	Credentials    security.Credentials ",omitempty"
	Root_Directory string               ",omitempty"
}

// Config defines full YAML configuration.
// USED FOR YAML
type Config struct {
	Identity   security.Identity ",omitempty"
	FileServer FileServer        ",omitempty"
}

func NewConfig() (c *Config) {
	c = new(Config)

	c.Identity.Cert_File = getDefaultString(ENV_IDENTITY_CERT_FILE, "")
	c.Identity.Private_Key_File = getDefaultString(ENV_IDENTITY_PRIVATE_KEY_FILE, "")

	c.FileServer.Address = strings.TrimSpace(getDefaultString(ENV_FILESERVER_ADDRESS, ""))
	c.FileServer.Port = getDefaultInt(ENV_FILESERVER_PORT, 20000)
	c.FileServer.Credentials = security.Credentials{
		Username: getDefaultString(ENV_FILESERVER_CREDENTIALS_USERNAME, ""),
		Password: getDefaultString(ENV_FILESERVER_CREDENTIALS_PASSWORD, ""),
	}
	c.FileServer.Root_Directory = strings.TrimSpace(getDefaultString(ENV_FILESERVER_ROOT_DIRECTORY, "/static-files"))

	return
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
