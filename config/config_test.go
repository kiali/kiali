package config

import (
	"fmt"
	"math/rand"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/kiali/kiali/util"

	"github.com/stretchr/testify/assert"
)

func TestSecretFileOverrides(t *testing.T) {
	// create a mock volume mount directory where the test secret content will go
	overrideSecretsDir = t.TempDir()

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

	// we don't have the files yet - so nothing should be overridden from the original yaml
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Password, "grafanapassword")
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Token, "grafanatoken")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Password, "prometheuspassword")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Token, "prometheustoken")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Password, "tracingpassword")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Token, "tracingtoken")
	assert.Equal(t, conf.LoginToken.SigningKey, "signingkey")

	// mock some secrets bound to volume mounts
	createTestSecretFile(t, overrideSecretsDir, SecretFileGrafanaPassword, "grafanapasswordENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileGrafanaToken, "grafanatokenENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFilePrometheusPassword, "prometheuspasswordENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFilePrometheusToken, "prometheustokenENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileTracingPassword, "tracingpasswordENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileTracingToken, "tracingtokenENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileLoginTokenSigningKey, "signingkeyENV")

	conf, _ = Unmarshal(yamlString)

	// credentials are now set- values should be overridden
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Password, "grafanapasswordENV")
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Token, "grafanatokenENV")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Password, "prometheuspasswordENV")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Token, "prometheustokenENV")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Password, "tracingpasswordENV")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Token, "tracingtokenENV")
	assert.Equal(t, conf.LoginToken.SigningKey, "signingkeyENV")
}

func createTestSecretFile(t *testing.T, parentDir string, name string, content string) {
	childDir := fmt.Sprintf("%s/%s", parentDir, name)
	filename := fmt.Sprintf("%s/value.txt", childDir)
	if err := os.MkdirAll(childDir, 0o777); err != nil {
		t.Fatalf("Failed to create tmp secret dir [%v]: %v", childDir, err)
	}
	f, err := os.Create(filename)
	if err != nil {
		t.Fatalf("Failed to create tmp secret file [%v]: %v", filename, err)
	}
	defer f.Close()
	if _, err2 := f.WriteString(content); err2 != nil {
		t.Fatalf("Failed to write tmp secret file [%v]: %v", filename, err2)
	}
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

func TestAllNamespacesAccessible(t *testing.T) {
	cases := map[string]struct {
		expectedAccessible   bool
		accessibleNamespaces []string
	}{
		"with **": {
			expectedAccessible:   true,
			accessibleNamespaces: []string{"**"},
		},
		"with ** and others": {
			expectedAccessible:   true,
			accessibleNamespaces: []string{"test1", "test2", "**"},
		},
		"without **": {
			expectedAccessible:   false,
			accessibleNamespaces: []string{"test1", "test2"},
		},
		"empty": {
			expectedAccessible:   false,
			accessibleNamespaces: []string{},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)

			conf := &Config{
				Deployment: DeploymentConfig{
					AccessibleNamespaces: tc.accessibleNamespaces,
				},
			}

			assert.Equal(tc.expectedAccessible, conf.AllNamespacesAccessible())
		})
	}
}

func TestValidateWebRoot(t *testing.T) {
	// create a base config that we know is valid
	rand.New(rand.NewSource(time.Now().UnixNano()))
	conf := NewConfig()
	conf.LoginToken.SigningKey = util.RandomString(16)
	conf.Server.StaticContentRootDirectory = "."
	conf.Auth.Strategy = "anonymous"

	// now test some web roots, both valid ones and invalid ones
	validWebRoots := []string{
		"/",
		"/kiali",
		"/abc/clustername/api/v1/namespaces/istio-system/services/kiali:80/proxy/kiali",
		"/a/0/-/./_/~/!/$/&/'/(/)/*/+/,/;/=/:/@/%aa",
		"/kiali0-._~!$&'()*+,;=:@%aa",
	}
	invalidWebRoots := []string{
		"/kiali/",
		"kiali/",
		"/^kiali",
		"/foo/../bar",
		"/../bar",
		"../bar",
	}

	for _, webroot := range validWebRoots {
		conf.Server.WebRoot = webroot
		if err := Validate(*conf); err != nil {
			t.Errorf("Web root validation should have succeeded for [%v]: %v", conf.Server.WebRoot, err)
		}
	}

	for _, webroot := range invalidWebRoots {
		conf.Server.WebRoot = webroot
		if err := Validate(*conf); err == nil {
			t.Errorf("Web root validation should have failed [%v]", conf.Server.WebRoot)
		}
	}
}

func TestValidateAuthStrategy(t *testing.T) {
	// create a base config that we know is valid
	rand.New(rand.NewSource(time.Now().UnixNano()))
	conf := NewConfig()
	conf.LoginToken.SigningKey = util.RandomString(16)
	conf.Server.StaticContentRootDirectory = "."

	// now test some auth strategies, both valid ones and invalid ones
	validStrategies := []string{
		AuthStrategyAnonymous,
		AuthStrategyOpenId,
		AuthStrategyOpenshift,
		AuthStrategyToken,
	}
	invalidStrategies := []string{
		"login",
		"ldap",
		"",
		"foo",
	}

	for _, strategies := range validStrategies {
		conf.Auth.Strategy = strategies
		if err := Validate(*conf); err != nil {
			t.Errorf("Auth Strategy validation should have succeeded for [%v]: %v", conf.Auth.Strategy, err)
		}
	}

	for _, strategies := range invalidStrategies {
		conf.Auth.Strategy = strategies
		if err := Validate(*conf); err == nil {
			t.Errorf("Auth Strategy validation should have failed [%v]", conf.Auth.Strategy)
		}
	}
}
