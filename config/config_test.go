package config

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config/security"
)

func TestEnvVarOverrides(t *testing.T) {
	conf := NewConfig()
	conf.ExternalServices.Grafana.Auth.Password = "grafanapassword"
	conf.ExternalServices.Grafana.Auth.Token = "grafanatoken"
	conf.ExternalServices.Prometheus.Auth.Password = "prometheuspassword"
	conf.ExternalServices.Prometheus.Auth.Token = "prometheustoken"
	conf.ExternalServices.Tracing.Auth.Password = "tracingpassword"
	conf.ExternalServices.Tracing.Auth.Token = "tracingtoken"
	conf.LoginToken.SigningKey = "signingkey"

	// Unmarshal will override settings found in env vars (if there are any env vars)
	yamlString, _ := Marshal(conf)
	conf, _ = Unmarshal(yamlString)

	// we don't have the env vars set yet - so nothing should be overridden from the original yaml
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Password, "grafanapassword")
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Token, "grafanatoken")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Password, "prometheuspassword")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Token, "prometheustoken")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Password, "tracingpassword")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Token, "tracingtoken")
	assert.Equal(t, conf.LoginToken.SigningKey, "signingkey")

	defer os.Unsetenv(EnvGrafanaPassword)
	defer os.Unsetenv(EnvGrafanaToken)
	defer os.Unsetenv(EnvPrometheusPassword)
	defer os.Unsetenv(EnvPrometheusToken)
	defer os.Unsetenv(EnvTracingPassword)
	defer os.Unsetenv(EnvTracingToken)
	defer os.Unsetenv(EnvLoginTokenSigningKey)
	os.Setenv(EnvGrafanaPassword, "grafanapasswordENV")
	os.Setenv(EnvGrafanaToken, "grafanatokenENV")
	os.Setenv(EnvPrometheusPassword, "prometheuspasswordENV")
	os.Setenv(EnvPrometheusToken, "prometheustokenENV")
	os.Setenv(EnvTracingPassword, "tracingpasswordENV")
	os.Setenv(EnvTracingToken, "tracingtokenENV")
	os.Setenv(EnvLoginTokenSigningKey, "signingkeyENV")

	conf, _ = Unmarshal(yamlString)

	// env vars are now set- values should be overridden
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Password, "grafanapasswordENV")
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Token, "grafanatokenENV")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Password, "prometheuspasswordENV")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Token, "prometheustokenENV")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Password, "tracingpasswordENV")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Token, "tracingtokenENV")
	assert.Equal(t, conf.LoginToken.SigningKey, "signingkeyENV")
}

func TestSensitiveDataObfuscation(t *testing.T) {
	conf := NewConfig()
	conf.ExternalServices.Grafana.Auth.Username = "my-username"
	conf.ExternalServices.Grafana.Auth.Password = "my-password"
	conf.ExternalServices.Grafana.Auth.Token = "my-token"
	conf.ExternalServices.Prometheus.Auth.Username = "my-username"
	conf.ExternalServices.Prometheus.Auth.Password = "my-password"
	conf.ExternalServices.Prometheus.Auth.Token = "my-token"
	conf.ExternalServices.Tracing.Auth.Username = "my-username"
	conf.ExternalServices.Tracing.Auth.Password = "my-password"
	conf.ExternalServices.Tracing.Auth.Token = "my-token"
	conf.LoginToken.SigningKey = "my-signkey"
	conf.LoginToken.ExpirationSeconds = 12345
	conf.Server = Server{
		Credentials: security.Credentials{
			Username:   "my-username",
			Passphrase: "my-password",
		},
	}

	printed := fmt.Sprintf("%v", conf)

	assert.NotContains(t, printed, "my-username")
	assert.NotContains(t, printed, "my-password")
	assert.NotContains(t, printed, "my-token")
	assert.NotContains(t, printed, "my-signkey")
	assert.Contains(t, printed, "12345")

	// Test that the original values are unchanged
	assert.Equal(t, "my-username", conf.ExternalServices.Grafana.Auth.Username)
	assert.Equal(t, "my-password", conf.ExternalServices.Prometheus.Auth.Password)
	assert.Equal(t, "my-token", conf.ExternalServices.Tracing.Auth.Token)
	assert.Equal(t, "my-signkey", conf.LoginToken.SigningKey)
	assert.Equal(t, "my-password", conf.Server.Credentials.Passphrase)
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
