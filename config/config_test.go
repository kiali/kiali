package config

import (
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/kiali/kiali/config/security"
)

func TestEnvVar(t *testing.T) {
	defer os.Setenv(EnvServerAddress, os.Getenv(EnvServerAddress))
	defer os.Setenv(EnvServerPort, os.Getenv(EnvServerPort))
	defer os.Setenv(EnvServerCORSAllowAll, os.Getenv(EnvServerCORSAllowAll))
	defer os.Setenv(EnvPrometheusCustomMetricsURL, os.Getenv(EnvPrometheusCustomMetricsURL))
	os.Setenv(EnvServerAddress, "test-address")
	os.Setenv(EnvServerPort, "12345")
	os.Setenv(EnvServerCORSAllowAll, "true")
	os.Setenv(EnvPrometheusCustomMetricsURL, "test-address")

	conf := NewConfig()

	if conf.Server.Address != "test-address" {
		t.Error("server address is wrong")
	}
	if conf.Server.Port != 12345 {
		t.Error("server port is wrong")
	}
	if conf.ExternalServices.Prometheus.CustomMetricsURL != "test-address" {
		t.Error("prometheus dashboard url is wrong")
	}
	if !conf.Server.CORSAllowAll {
		t.Error("server CORS setting is wrong")
	}
}

func TestPrometheusDashboardUrlFallback(t *testing.T) {
	defer os.Setenv(EnvPrometheusServiceURL, os.Getenv(EnvPrometheusServiceURL))
	defer os.Setenv(EnvPrometheusCustomMetricsURL, os.Getenv(EnvPrometheusCustomMetricsURL))

	os.Setenv(EnvPrometheusServiceURL, "test-address")

	conf := NewConfig()

	if conf.ExternalServices.Prometheus.URL != "test-address" {
		t.Error("prometheus service url is wrong")
	}
	if conf.ExternalServices.Prometheus.CustomMetricsURL != "test-address" {
		t.Error("prometheus dashboard url is not taking main prometheus url")
	}

	os.Setenv(EnvPrometheusCustomMetricsURL, "second-test-address")

	conf = NewConfig()

	if conf.ExternalServices.Prometheus.URL != "test-address" {
		t.Error("prometheus service url is wrong")
	}
	if conf.ExternalServices.Prometheus.CustomMetricsURL != "second-test-address" {
		t.Error("prometheus dashboard url is not taking main prometheus url")
	}
}

func TestDefaults(t *testing.T) {
	conf := NewConfig()

	if conf.Server.Address != "" {
		t.Error("server address default is wrong")
	}

	if conf.Server.Port != 20000 {
		t.Error("server port default is wrong")
	}

	if conf.Server.CORSAllowAll {
		t.Error("server CORS default setting is wrong")
	}

	if len(conf.API.Namespaces.Exclude) != 4 {
		t.Error("Api namespace exclude default setting is wrong")
	} else {
		// our default exclusion list: istio-operator,kube.*,openshift.*,ibm.*
		if conf.API.Namespaces.Exclude[0] != "istio-operator" ||
			conf.API.Namespaces.Exclude[1] != "kube.*" ||
			conf.API.Namespaces.Exclude[2] != "openshift.*" ||
			conf.API.Namespaces.Exclude[3] != "ibm.*" {
			t.Errorf("Api namespace exclude default list is wrong: %+v", conf.API.Namespaces.Exclude)
		}
	}
}

func TestMarshalUnmarshalStaticContentRootDirectory(t *testing.T) {
	testConf := Config{
		Server: Server{
			StaticContentRootDirectory: "/tmp",
		},
	}

	yamlString, err := Marshal(&testConf)
	if err != nil {
		t.Errorf("Failed to marshal: %v", err)
	}
	if yamlString != "server:\n  static_content_root_directory: /tmp\n" {
		t.Errorf("Failed to marshal - StaticContentRootDirectory to static_content_root_directory: [%v]", yamlString)
	}
	conf, err := Unmarshal(yamlString)
	if err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}
	if conf.Server.StaticContentRootDirectory != "/tmp" {
		t.Errorf("Failed to unmarshal static content root directory:\n%v", conf)
	}
}

func TestMarshalUnmarshalApiConfig(t *testing.T) {
	testConf := Config{
		API: ApiConfig{
			Namespaces: ApiNamespacesConfig{
				Exclude: []string{"istio-operator", "kube.*"},
			},
		},
	}

	yamlString, err := Marshal(&testConf)
	if err != nil {
		t.Errorf("Failed to marshal: %v", err)
	}
	if yamlString != "api:\n  namespaces:\n    exclude:\n    - istio-operator\n    - kube.*\n" {
		t.Errorf("Failed to marshal Api:\n%q", yamlString)
	}
	conf, err := Unmarshal(yamlString)
	if err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}
	if len(conf.API.Namespaces.Exclude) != 2 {
		t.Errorf("Failed to unmarshal Api:\n%+v", conf.API)
	}
}

func TestMarshalUnmarshal(t *testing.T) {
	testConf := Config{
		Server: Server{
			Address: "foo-test",
			Port:    321,

			StaticContentRootDirectory: "/tmp",
		},
	}

	yamlString, err := Marshal(&testConf)
	if err != nil {
		t.Errorf("Failed to marshal: %v", err)
	}
	if yamlString == "" {
		t.Errorf("Failed to marshal - empty yaml string")
	}

	conf, err := Unmarshal(yamlString)
	if err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}

	if conf.Server.Address != "foo-test" {
		t.Errorf("Failed to unmarshal server address:\n%v", conf)
	}
	if conf.Server.Port != 321 {
		t.Errorf("Failed to unmarshal server port:\n%v", conf)
	}
	if conf.Server.StaticContentRootDirectory != "/tmp" {
		t.Errorf("Failed to unmarshal static content root directory:\n%v", conf)
	}
}

func TestLoadSave(t *testing.T) {
	testConf := Config{
		Server: Server{
			Address: "foo-test",
			Port:    321,
		},
	}

	filename := "/tmp/config_test.yaml"
	defer os.Remove(filename)

	err := SaveToFile(filename, &testConf)
	if err != nil {
		t.Errorf("Failed to save to file: %v", err)
	}

	conf, err := LoadFromFile(filename)
	if err != nil {
		t.Errorf("Failed to load from file: %v", err)
	}

	t.Logf("Config from file\n%v", conf)

	if conf.Server.Address != "foo-test" {
		t.Errorf("Failed to unmarshal server address:\n%v", conf)
	}
	if conf.Server.Port != 321 {
		t.Errorf("Failed to unmarshal server port:\n%v", conf)
	}
}

func TestError(t *testing.T) {
	_, err := Unmarshal("bogus-yaml")
	if err == nil {
		t.Errorf("Unmarshal should have failed")
	}

	_, err = LoadFromFile("bogus-file-name")
	if err == nil {
		t.Errorf("Load should have failed")
	}
}

func TestMarshalUnmarshalCredentials(t *testing.T) {
	testConf := Config{
		Server: Server{
			Credentials: security.Credentials{
				Username:   "foo",
				Passphrase: "bar",
			},
		},
	}

	yamlString, err := Marshal(&testConf)
	if err != nil {
		t.Errorf("Failed to marshal: %v", err)
	}
	if !strings.Contains(yamlString, "username: foo\n") {
		t.Errorf("Failed to marshal credentials - [%v]", yamlString)
	}
	conf, err := Unmarshal(yamlString)
	if err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}
	if conf.Server.Credentials.Username != "foo" {
		t.Errorf("Failed to unmarshal username credentials:\n%v", conf)
	}
	if conf.Server.Credentials.Passphrase != "bar" {
		t.Errorf("Failed to unmarshal password credentials:\n%v", conf)
	}

	testConf = Config{
		Server: Server{
			Credentials: security.Credentials{
				Username:   "",
				Passphrase: "",
			},
		},
	}

	yamlString, err = Marshal(&testConf)
	if err != nil {
		t.Errorf("Failed to marshal: %v", err)
	}
	conf, err = Unmarshal(yamlString)
	if err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}
	if conf.Server.Credentials.Username != "" {
		t.Errorf("Failed to unmarshal empty username credentials:\n%v", conf)
	}
	if conf.Server.Credentials.Passphrase != "" {
		t.Errorf("Failed to unmarshal empty password credentials:\n%v", conf)
	}
}

func TestRaces(t *testing.T) {

	wg := sync.WaitGroup{}
	wg.Add(10)

	cfg := NewConfig()

	for i := 0; i < 5; i++ {
		go func() {
			defer wg.Done()
			Get()
		}()
	}

	for i := 0; i < 5; i++ {
		go func() {
			defer wg.Done()
			Set(cfg)
		}()
	}

	wg.Wait()
}
