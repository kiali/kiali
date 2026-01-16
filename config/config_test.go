package config

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/util"
)

func TestSecretFileOverrides(t *testing.T) {
	// Temporarily override the package-level overrideSecretsDir variable for this test
	originalSecretsDir := overrideSecretsDir
	overrideSecretsDir = t.TempDir()
	defer func() { overrideSecretsDir = originalSecretsDir }()

	conf := NewConfig()
	conf.ExternalServices.Grafana.Auth.Username = "grafanausername"
	conf.ExternalServices.Grafana.Auth.Password = "grafanapassword"
	conf.ExternalServices.Grafana.Auth.Token = "grafanatoken"
	conf.ExternalServices.Perses.Auth.Username = "persesusername"
	conf.ExternalServices.Perses.Auth.Password = "persespassword"
	conf.ExternalServices.Prometheus.Auth.Username = "prometheususername"
	conf.ExternalServices.Prometheus.Auth.Password = "prometheuspassword"
	conf.ExternalServices.Prometheus.Auth.Token = "prometheustoken"
	conf.ExternalServices.Tracing.Auth.Username = "tracingusername"
	conf.ExternalServices.Tracing.Auth.Password = "tracingpassword"
	conf.ExternalServices.Tracing.Auth.Token = "tracingtoken"
	conf.LoginToken.SigningKey = "signingkey"
	conf.ExternalServices.CustomDashboards.Prometheus.Auth.Username = "cd-prometheususername"
	conf.ExternalServices.CustomDashboards.Prometheus.Auth.Password = "cd-prometheuspassword"
	conf.ExternalServices.CustomDashboards.Prometheus.Auth.Token = "cd-prometheustoken"

	// Unmarshal will override settings found in env vars (if there are any env vars)
	var err error
	yamlString, err := Marshal(conf)
	require.NoError(t, err)
	conf, err = Unmarshal(yamlString)
	require.NoError(t, err)

	// we don't have the files yet - so nothing should be overridden from the original yaml
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Username, Credential("grafanausername"))
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Password, Credential("grafanapassword"))
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Token, Credential("grafanatoken"))
	assert.Equal(t, conf.ExternalServices.Perses.Auth.Username, Credential("persesusername"))
	assert.Equal(t, conf.ExternalServices.Perses.Auth.Password, Credential("persespassword"))
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Username, Credential("prometheususername"))
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Password, Credential("prometheuspassword"))
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Token, Credential("prometheustoken"))
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Username, Credential("tracingusername"))
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Password, Credential("tracingpassword"))
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Token, Credential("tracingtoken"))
	assert.Equal(t, conf.LoginToken.SigningKey, Credential("signingkey"))
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Username, Credential("cd-prometheususername"))
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Password, Credential("cd-prometheuspassword"))
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Token, Credential("cd-prometheustoken"))

	// mock some secrets bound to volume mounts
	createTestSecretFile(t, overrideSecretsDir, SecretFileGrafanaUsername, "grafanausernameENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileGrafanaPassword, "grafanapasswordENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileGrafanaToken, "grafanatokenENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFilePersesUsername, "persesusernameENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFilePersesPassword, "persespasswordENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFilePrometheusUsername, "prometheususernameENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFilePrometheusPassword, "prometheuspasswordENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFilePrometheusToken, "prometheustokenENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileTracingUsername, "tracingusernameENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileTracingPassword, "tracingpasswordENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileTracingToken, "tracingtokenENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileLoginTokenSigningKey, "signingkeyENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileCustomDashboardsPrometheusUsername, "cdprometheususernameENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileCustomDashboardsPrometheusPassword, "cdprometheuspasswordENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileCustomDashboardsPrometheusToken, "cdprometheustokenENV")

	conf, _ = Unmarshal(yamlString)

	// Config values should now be file paths (not the content)
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Username, Credential(overrideSecretsDir+"/"+SecretFileGrafanaUsername+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Password, Credential(overrideSecretsDir+"/"+SecretFileGrafanaPassword+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Token, Credential(overrideSecretsDir+"/"+SecretFileGrafanaToken+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.Perses.Auth.Username, Credential(overrideSecretsDir+"/"+SecretFilePersesUsername+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.Perses.Auth.Password, Credential(overrideSecretsDir+"/"+SecretFilePersesPassword+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Username, Credential(overrideSecretsDir+"/"+SecretFilePrometheusUsername+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Password, Credential(overrideSecretsDir+"/"+SecretFilePrometheusPassword+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Token, Credential(overrideSecretsDir+"/"+SecretFilePrometheusToken+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Username, Credential(overrideSecretsDir+"/"+SecretFileTracingUsername+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Password, Credential(overrideSecretsDir+"/"+SecretFileTracingPassword+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Token, Credential(overrideSecretsDir+"/"+SecretFileTracingToken+"/value.txt"))
	assert.Equal(t, conf.LoginToken.SigningKey, Credential(overrideSecretsDir+"/"+SecretFileLoginTokenSigningKey+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Username, Credential(overrideSecretsDir+"/"+SecretFileCustomDashboardsPrometheusUsername+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Password, Credential(overrideSecretsDir+"/"+SecretFileCustomDashboardsPrometheusPassword+"/value.txt"))
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Token, Credential(overrideSecretsDir+"/"+SecretFileCustomDashboardsPrometheusToken+"/value.txt"))

	// Verify the getter methods return the actual values from the files
	username, err := conf.GetCredential(conf.ExternalServices.Grafana.Auth.Username)
	assert.NoError(t, err)
	assert.Equal(t, "grafanausernameENV", username)

	password, err := conf.GetCredential(conf.ExternalServices.Grafana.Auth.Password)
	assert.NoError(t, err)
	assert.Equal(t, "grafanapasswordENV", password)

	token, err := conf.GetCredential(conf.ExternalServices.Prometheus.Auth.Token)
	assert.NoError(t, err)
	assert.Equal(t, "prometheustokenENV", token)
}

// TestLoadFromFile_OidcClientSecretFile verifies that when the OIDC client secret file exists,
// LoadFromFile stores the file path (not the content) in conf.Auth.OpenId.ClientSecret,
// and that GetCredential can then resolve the actual secret value.
func TestLoadFromFile_OidcClientSecretFile(t *testing.T) {
	tmpDir := t.TempDir()

	// Create the OIDC secret file with test content
	secretFile := filepath.Join(tmpDir, "oidc-secret")
	expectedSecret := "test-oidc-client-secret"
	require.NoError(t, os.WriteFile(secretFile, []byte(expectedSecret), 0o644))

	// Override the oidcClientSecretFile variable for testing
	originalPath := oidcClientSecretFile
	oidcClientSecretFile = secretFile
	defer func() { oidcClientSecretFile = originalPath }()

	// Create a minimal config file
	configFile := filepath.Join(tmpDir, "config.yaml")
	require.NoError(t, os.WriteFile(configFile, []byte("{}"), 0o644))

	// Load config - should detect oidcClientSecretFile and store the path
	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)
	t.Cleanup(conf.Close)

	// Verify the path was stored (not the content)
	require.Equal(t, Credential(secretFile), conf.Auth.OpenId.ClientSecret, "ClientSecret should contain the file path")

	// Verify GetCredential can resolve the secret
	secret, err := conf.GetCredential(conf.Auth.OpenId.ClientSecret)
	require.NoError(t, err)
	require.Equal(t, expectedSecret, secret, "GetCredential should return the file content")
}

// TestLoadFromFile_OidcClientSecretFile_NotExists verifies that when the OIDC client secret
// file does not exist, LoadFromFile does not set conf.Auth.OpenId.ClientSecret.
func TestLoadFromFile_OidcClientSecretFile_NotExists(t *testing.T) {
	tmpDir := t.TempDir()

	// Override the oidcClientSecretFile variable to a non-existent path
	originalPath := oidcClientSecretFile
	oidcClientSecretFile = filepath.Join(tmpDir, "non-existent-oidc-secret")
	defer func() { oidcClientSecretFile = originalPath }()

	// Create a minimal config file
	configFile := filepath.Join(tmpDir, "config.yaml")
	require.NoError(t, os.WriteFile(configFile, []byte("{}"), 0o644))

	// Load config - should NOT set ClientSecret since file doesn't exist
	conf, err := LoadFromFile(configFile)
	require.NoError(t, err)
	t.Cleanup(conf.Close)

	// Verify ClientSecret remains empty (default)
	require.Empty(t, conf.Auth.OpenId.ClientSecret, "ClientSecret should be empty when file doesn't exist")
}

// Ensures calling Set with a config that already carries a credential manager
// does not tear it down or replace it.
func TestSetKeepsExistingCredentialManager(t *testing.T) {
	original := Get()
	defer Set(original)

	// First Set initializes credential manager if needed.
	conf := NewConfig()
	Set(conf)

	firstMgr := Get().Credentials
	if firstMgr == nil {
		t.Fatalf("expected credential manager to be initialized")
	}

	// Calling Set with the same config (and same credential manager) should keep it.
	Set(Get())
	secondMgr := Get().Credentials

	if secondMgr != firstMgr {
		t.Fatalf("expected credential manager to remain the same")
	}
}

// Ensures Set creates a new credential manager when the incoming config lacks one
// and closes the previous manager.
func TestSetCreatesNewCredentialManagerAndClosesOld(t *testing.T) {
	original := Get()
	defer Set(original)

	conf := NewConfig()
	Set(conf)
	firstMgr := Get().Credentials
	if firstMgr == nil {
		t.Fatalf("expected credential manager to be initialized")
	}

	// Clear credentials to force Set to provision a new manager.
	conf2 := NewConfig()
	conf2.Credentials = nil
	Set(conf2)
	secondMgr := Get().Credentials

	if secondMgr == nil {
		t.Fatalf("expected new credential manager to be initialized")
	}
	if secondMgr == firstMgr {
		t.Fatalf("expected credential manager to be replaced")
	}

	// The old manager should have been closed.
	select {
	case <-firstMgr.done:
		// closed as expected
	default:
		t.Fatalf("expected old credential manager to be closed")
	}
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
	conf.ExternalServices.Grafana.Auth.CertFile = "my-certfile"
	conf.ExternalServices.Grafana.Auth.KeyFile = "my-keyfile"
	conf.ExternalServices.Grafana.Auth.Username = "my-username"
	conf.ExternalServices.Grafana.Auth.Password = "my-password"
	conf.ExternalServices.Grafana.Auth.Token = "my-token"
	conf.ExternalServices.Perses.Auth.CertFile = "my-certfile"
	conf.ExternalServices.Perses.Auth.KeyFile = "my-keyfile"
	conf.ExternalServices.Perses.Auth.Username = "my-username"
	conf.ExternalServices.Perses.Auth.Password = "my-password"
	conf.ExternalServices.Prometheus.Auth.CertFile = "my-certfile"
	conf.ExternalServices.Prometheus.Auth.KeyFile = "my-keyfile"
	conf.ExternalServices.Prometheus.Auth.Username = "my-username"
	conf.ExternalServices.Prometheus.Auth.Password = "my-password"
	conf.ExternalServices.Prometheus.Auth.Token = "my-token"
	conf.ExternalServices.Tracing.Auth.CertFile = "my-certfile"
	conf.ExternalServices.Tracing.Auth.KeyFile = "my-keyfile"
	conf.ExternalServices.Tracing.Auth.Username = "my-username"
	conf.ExternalServices.Tracing.Auth.Password = "my-password"
	conf.ExternalServices.Tracing.Auth.Token = "my-token"
	conf.LoginToken.SigningKey = "my-signkey"
	conf.LoginToken.ExpirationSeconds = 12345
	conf.ExternalServices.CustomDashboards.Prometheus.Auth.CertFile = "my-certfile"
	conf.ExternalServices.CustomDashboards.Prometheus.Auth.KeyFile = "my-keyfile"
	conf.ExternalServices.CustomDashboards.Prometheus.Auth.Username = "my-username"
	conf.ExternalServices.CustomDashboards.Prometheus.Auth.Password = "my-password"
	conf.ExternalServices.CustomDashboards.Prometheus.Auth.Token = "my-token"

	printed := fmt.Sprintf("%v", conf)

	assert.NotContains(t, printed, "my-certfile")
	assert.NotContains(t, printed, "my-keyfile")
	assert.NotContains(t, printed, "my-username")
	assert.NotContains(t, printed, "my-password")
	assert.NotContains(t, printed, "my-token")
	assert.NotContains(t, printed, "my-signkey")
	assert.Contains(t, printed, "12345")

	// Test that the original values are unchanged
	assert.Equal(t, Credential("my-certfile"), conf.ExternalServices.Grafana.Auth.CertFile)
	assert.Equal(t, Credential("my-keyfile"), conf.ExternalServices.Grafana.Auth.KeyFile)
	assert.Equal(t, Credential("my-username"), conf.ExternalServices.Grafana.Auth.Username)
	assert.Equal(t, Credential("my-password"), conf.ExternalServices.Grafana.Auth.Password)
	assert.Equal(t, Credential("my-token"), conf.ExternalServices.Grafana.Auth.Token)
	assert.Equal(t, Credential("my-certfile"), conf.ExternalServices.Perses.Auth.CertFile)
	assert.Equal(t, Credential("my-keyfile"), conf.ExternalServices.Perses.Auth.KeyFile)
	assert.Equal(t, Credential("my-username"), conf.ExternalServices.Perses.Auth.Username)
	assert.Equal(t, Credential("my-password"), conf.ExternalServices.Perses.Auth.Password)
	assert.Equal(t, Credential("my-certfile"), conf.ExternalServices.Prometheus.Auth.CertFile)
	assert.Equal(t, Credential("my-keyfile"), conf.ExternalServices.Prometheus.Auth.KeyFile)
	assert.Equal(t, Credential("my-username"), conf.ExternalServices.Prometheus.Auth.Username)
	assert.Equal(t, Credential("my-password"), conf.ExternalServices.Prometheus.Auth.Password)
	assert.Equal(t, Credential("my-token"), conf.ExternalServices.Prometheus.Auth.Token)
	assert.Equal(t, Credential("my-certfile"), conf.ExternalServices.Tracing.Auth.CertFile)
	assert.Equal(t, Credential("my-keyfile"), conf.ExternalServices.Tracing.Auth.KeyFile)
	assert.Equal(t, Credential("my-username"), conf.ExternalServices.Tracing.Auth.Username)
	assert.Equal(t, Credential("my-password"), conf.ExternalServices.Tracing.Auth.Password)
	assert.Equal(t, Credential("my-token"), conf.ExternalServices.Tracing.Auth.Token)
	assert.Equal(t, Credential("my-signkey"), conf.LoginToken.SigningKey)
	assert.Equal(t, Credential("my-certfile"), conf.ExternalServices.CustomDashboards.Prometheus.Auth.CertFile)
	assert.Equal(t, Credential("my-keyfile"), conf.ExternalServices.CustomDashboards.Prometheus.Auth.KeyFile)
	assert.Equal(t, Credential("my-username"), conf.ExternalServices.CustomDashboards.Prometheus.Auth.Username)
	assert.Equal(t, Credential("my-password"), conf.ExternalServices.CustomDashboards.Prometheus.Auth.Password)
	assert.Equal(t, Credential("my-token"), conf.ExternalServices.CustomDashboards.Prometheus.Auth.Token)
}

func TestMarshalUnmarshal(t *testing.T) {
	testConf := Config{
		Deployment: DeploymentConfig{
			DiscoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{
						MatchLabels: map[string]string{
							"kubernetes.io/metadata.name": "foo",
						},
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "thekey",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"a"},
							},
						},
					},
				},
				Overrides: map[string]DiscoverySelectorsType{
					"cluster1": {
						{
							MatchLabels: map[string]string{
								"splat": "boing",
							},
						},
					},
				},
			},
		},
		Server: Server{
			Address: "foo-test",
			Port:    321,
		},
	}

	yamlString, err := Marshal(&testConf)
	if err != nil {
		t.Errorf("Failed to marshal: %v", err)
	}
	if yamlString == "" {
		t.Errorf("Failed to marshal - empty yaml string")
	}
	if strings.Contains(yamlString, "matchlabels") {
		t.Errorf("Failed to marshal - matchLabels is not camelCase; yaml parsing not correct")
	}
	if strings.Contains(yamlString, "matchexpressions") {
		t.Errorf("Failed to marshal - matchExpressions is not camelCase; yaml parsing not correct")
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
	if conf.Deployment.DiscoverySelectors.Default[0].MatchLabels["kubernetes.io/metadata.name"] != "foo" {
		t.Errorf("Failed to unmarshal default discovery selector:\n%v", conf)
	}
	if conf.Deployment.DiscoverySelectors.Default[0].MatchExpressions[0].Key != "thekey" {
		t.Errorf("Failed to unmarshal default discovery selector expression key:\n%v", conf)
	}
	if conf.Deployment.DiscoverySelectors.Default[0].MatchExpressions[0].Operator != "In" {
		t.Errorf("Failed to unmarshal default discovery selector expression key:\n%v", conf)
	}
	if conf.Deployment.DiscoverySelectors.Overrides["cluster1"][0].MatchLabels["splat"] != "boing" {
		t.Errorf("Failed to unmarshal default discovery selector:\n%v", conf)
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
	// cluster wide access flag is the only one that matters
	cases := map[string]struct {
		expectedAccessible bool
		clusterWideAccess  bool
	}{
		"with CWA=true": {
			expectedAccessible: true,
			clusterWideAccess:  true,
		},
		"with CWA=false": {
			expectedAccessible: false,
			clusterWideAccess:  false,
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)

			conf := &Config{
				Deployment: DeploymentConfig{
					ClusterWideAccess: tc.clusterWideAccess,
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
	conf.LoginToken.SigningKey = Credential(util.RandomString(16))
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
		if err := Validate(conf); err != nil {
			t.Errorf("Web root validation should have succeeded for [%v]: %v", conf.Server.WebRoot, err)
		}
	}

	for _, webroot := range invalidWebRoots {
		conf.Server.WebRoot = webroot
		if err := Validate(conf); err == nil {
			t.Errorf("Web root validation should have failed [%v]", conf.Server.WebRoot)
		}
	}
}

func TestValidateAuthStrategy(t *testing.T) {
	// create a base config that we know is valid
	rand.New(rand.NewSource(time.Now().UnixNano()))
	conf := NewConfig()
	conf.LoginToken.SigningKey = Credential(util.RandomString(16))

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
		if err := Validate(conf); err != nil {
			t.Errorf("Auth Strategy validation should have succeeded for [%v]: %v", conf.Auth.Strategy, err)
		}
	}

	for _, strategies := range invalidStrategies {
		conf.Auth.Strategy = strategies
		if err := Validate(conf); err == nil {
			t.Errorf("Auth Strategy validation should have failed [%v]", conf.Auth.Strategy)
		}
	}
}

func TestValidateTLSConfigSource(t *testing.T) {
	conf := NewConfig()
	conf.LoginToken.SigningKey = Credential(util.RandomString(16))
	conf.Auth.Strategy = AuthStrategyAnonymous

	// valid: explicit config and auto
	for _, src := range []string{string(TLSConfigSourceConfig), string(TLSConfigSourceAuto)} {
		conf.Deployment.TLSConfig.Source = TLSConfigSource(src)
		if err := Validate(conf); err != nil {
			t.Fatalf("expected tls_config.source [%s] to validate: %v", src, err)
		}
	}

	// invalid source (empty and bogus)
	for _, src := range []TLSConfigSource{"", TLSConfigSource("bogus")} {
		conf.Deployment.TLSConfig.Source = src
		if err := Validate(conf); err == nil {
			t.Fatalf("expected invalid tls_config.source [%s] to fail validation", src)
		}
	}
}

func TestValidateSigningKeyLength(t *testing.T) {
	// Valid signing key lengths are 16, 24, or 32 bytes
	validLengths := []int{16, 24, 32}
	invalidLengths := []int{0, 1, 8, 15, 17, 23, 25, 31, 33, 64}

	// Test valid lengths with non-anonymous strategy
	for _, length := range validLengths {
		conf := NewConfig()
		conf.Auth.Strategy = AuthStrategyToken
		conf.LoginToken.SigningKey = Credential(strings.Repeat("x", length))
		if err := Validate(conf); err != nil {
			t.Errorf("Signing key validation should have succeeded for length [%d]: %v", length, err)
		}
	}

	// Test invalid lengths with non-anonymous strategy
	for _, length := range invalidLengths {
		conf := NewConfig()
		conf.Auth.Strategy = AuthStrategyToken
		conf.LoginToken.SigningKey = Credential(strings.Repeat("x", length))
		if err := Validate(conf); err == nil {
			t.Errorf("Signing key validation should have failed for length [%d]", length)
		}
	}

	// Test that anonymous strategy doesn't require valid signing key length
	conf := NewConfig()
	conf.Auth.Strategy = AuthStrategyAnonymous
	conf.LoginToken.SigningKey = "short" // Invalid length, but should pass for anonymous
	if err := Validate(conf); err != nil {
		t.Errorf("Signing key validation should have succeeded for anonymous strategy regardless of key length: %v", err)
	}
}

func TestIsRBACDisabled(t *testing.T) {
	cases := map[string]struct {
		authConfig         AuthConfig
		expectRBACDisabled bool
	}{
		"anonymous should have RBAC disabled": {
			authConfig: AuthConfig{
				Strategy: AuthStrategyAnonymous,
			},
			expectRBACDisabled: true,
		},
		"openid with rbac disabled should have RBAC disabled": {
			authConfig: AuthConfig{
				Strategy: AuthStrategyOpenId,
				OpenId: OpenIdConfig{
					DisableRBAC: true,
				},
			},
			expectRBACDisabled: true,
		},
		"openid with rbac enabled should have RBAC enabled": {
			authConfig: AuthConfig{
				Strategy: AuthStrategyOpenId,
				OpenId: OpenIdConfig{
					DisableRBAC: false,
				},
			},
			expectRBACDisabled: false,
		},
		"openshift should have RBAC enabled": {
			authConfig: AuthConfig{
				Strategy: AuthStrategyOpenshift,
			},
			expectRBACDisabled: false,
		},
		"token should have RBAC enabled": {
			authConfig: AuthConfig{
				Strategy: AuthStrategyToken,
			},
			expectRBACDisabled: false,
		},
		"header should have RBAC enabled": {
			authConfig: AuthConfig{
				Strategy: AuthStrategyHeader,
			},
			expectRBACDisabled: false,
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			conf := NewConfig()
			conf.Auth = tc.authConfig

			require.Equal(tc.expectRBACDisabled, conf.IsRBACDisabled())
		})
	}
}

func TestExtractAccessibleNamespaceList(t *testing.T) {
	cases := map[string]struct {
		discoverySelectors DiscoverySelectorsConfig
		expectedNamespaces []string
		expectedError      bool
	}{
		"nil selectors": {
			expectedNamespaces: []string{},
		},
		"no matchLabels": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "label1",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"labelValue1"},
							},
						},
					},
				},
			},
			expectedNamespaces: []string{},
			expectedError:      true,
		},
		"one matchLabels but not kubernetes.io": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{MatchLabels: map[string]string{"notWhatWeWant": "foo"}},
				},
			},
			expectedNamespaces: []string{},
			expectedError:      true,
		},
		"one matchLabels": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "good"}},
				},
			},
			expectedNamespaces: []string{"good"},
			expectedError:      false,
		},
		"ignore overrides": {
			discoverySelectors: DiscoverySelectorsConfig{
				Overrides: map[string]DiscoverySelectorsType{
					"cluster1": {
						&DiscoverySelectorType{
							MatchLabels: map[string]string{"kubernetes.io/metadata.name": "ignored"},
						},
					},
				},
			},
			expectedNamespaces: []string{},
			expectedError:      false,
		},
		"one matchLabels in default; ignore overrides": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "good"}},
				},
				Overrides: map[string]DiscoverySelectorsType{
					"cluster1": {
						&DiscoverySelectorType{
							MatchLabels: map[string]string{"kubernetes.io/metadata.name": "ignored"},
						},
					},
				},
			},
			expectedNamespaces: []string{"good"},
			expectedError:      false,
		},
		"multiple matchLabels": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "one"}},
					&DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "two"}},
					&DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "three"}},
				},
			},
			expectedNamespaces: []string{"one", "two", "three"},
			expectedError:      false,
		},
		"one matchLabels, ignore the others - selector with both matchLabel and matchExpression is ignored": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "good"}},
					&DiscoverySelectorType{
						MatchLabels: map[string]string{"kubernetes.io/metadata.name": "ignore"},
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "ignoreThisToo",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"ignoreThisToo"},
							},
						},
					},
				},
			},
			expectedNamespaces: []string{"good"},
			expectedError:      true,
		},
		"two selectors - one matchExpression and one matchLabel": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "good"}},
					&DiscoverySelectorType{
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "kubernetes.io/metadata.name",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"good2"},
							},
						},
					},
				},
			},
			expectedNamespaces: []string{"good", "good2"},
			expectedError:      false,
		},
		"matchExpression must be operator=In, all others are ignored": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "kubernetes.io/metadata.name",
								Operator: meta_v1.LabelSelectorOpNotIn,
								Values:   []string{"ignore"},
							},
						},
					},
					&DiscoverySelectorType{
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "kubernetes.io/metadata.name",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"good"},
							},
						},
					},
					&DiscoverySelectorType{
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "kubernetes.io/metadata.name",
								Operator: meta_v1.LabelSelectorOpDoesNotExist,
							},
						},
					},
					&DiscoverySelectorType{
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "kubernetes.io/metadata.name",
								Operator: meta_v1.LabelSelectorOpExists,
							},
						},
					},
				},
			},
			expectedNamespaces: []string{"good"},
			expectedError:      true,
		},
		"cannot have multiple matchExpressions in a single selectors": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "good"}},
					&DiscoverySelectorType{
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "kubernetes.io/metadata.name",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"nogood"},
							},
							{
								Key:      "foo",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"bar"},
							},
						},
					},
				},
			},
			expectedNamespaces: []string{"good"},
			expectedError:      true,
		},
		"matchExpression with multiple values": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "kubernetes.io/metadata.name",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"one-ns", "two-ns", "three-ns"},
							},
						},
					},
				},
			},
			expectedNamespaces: []string{"one-ns", "two-ns", "three-ns"},
			expectedError:      false,
		},
		"matchLabels must not have multiple values": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{
						MatchLabels: map[string]string{"kubernetes.io/metadata.name": "ignored", "too-many": "values"},
					},
				},
			},
			expectedNamespaces: []string{},
			expectedError:      true,
		},
		"one big mess with nothing matching": {
			discoverySelectors: DiscoverySelectorsConfig{
				Default: DiscoverySelectorsType{
					&DiscoverySelectorType{MatchLabels: map[string]string{"ignore-this": "one"}},
					&DiscoverySelectorType{MatchLabels: map[string]string{"kubernetes.io/metadata.name": "one", "ignore-this": "too"}},
					&DiscoverySelectorType{
						MatchLabels: map[string]string{"kubernetes.io/metadata.name": "ignored"},
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "kubernetes.io/metadata.name",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"nogood"},
							},
						},
					},
					&DiscoverySelectorType{
						MatchExpressions: []meta_v1.LabelSelectorRequirement{
							{
								Key:      "kubernetes.io/metadata.name",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"nogood"},
							},
							{
								Key:      "foo",
								Operator: meta_v1.LabelSelectorOpIn,
								Values:   []string{"bar"},
							},
						},
					},
				},
			},
			expectedNamespaces: []string{},
			expectedError:      true,
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			assert := assert.New(t)

			cfg := &Config{
				Deployment: DeploymentConfig{
					DiscoverySelectors: tc.discoverySelectors,
				},
			}

			actualNamespaces, err := cfg.extractAccessibleNamespaceList()
			if tc.expectedError {
				assert.NotNil(err)
			} else {
				assert.Nil(err)
			}
			assert.Equal(tc.expectedNamespaces, actualNamespaces)
		})
	}
}

// TestOpenIdConfigDefaults tests that deprecated OIDC endpoint field is initialized to empty string
func TestOpenIdConfigDefaults(t *testing.T) {
	conf := NewConfig()

	// Test that deprecated authorization_endpoint field is initialized to empty string
	// Note: TokenEndpoint, UserInfoEndpoint, JwksUri never existed in OpenIdConfig
	assert.Equal(t, "", conf.Auth.OpenId.AuthorizationEndpoint)
}

// TestOpenIdConfigUnmarshaling tests that deprecated authorization_endpoint field can be unmarshaled
func TestOpenIdConfigUnmarshaling(t *testing.T) {
	yamlConfig := `
auth:
  strategy: "openid"
  openid:
    issuer_uri: "https://example.com"
    client_id: "kiali-client"
    authorization_endpoint: "https://example.com/auth"
`

	conf, err := Unmarshal(yamlConfig)
	require.NoError(t, err)

	assert.Equal(t, "openid", conf.Auth.Strategy)
	assert.Equal(t, "https://example.com", conf.Auth.OpenId.IssuerUri)
	assert.Equal(t, "kiali-client", conf.Auth.OpenId.ClientId)
	assert.Equal(t, "https://example.com/auth", conf.Auth.OpenId.AuthorizationEndpoint)
}

// TestOpenIdConfigMarshalUnmarshal tests that deprecated authorization_endpoint field is preserved during marshal/unmarshal
func TestOpenIdConfigMarshalUnmarshal(t *testing.T) {
	// Create a config with explicit OIDC endpoint using deprecated field
	conf := NewConfig()
	conf.Auth.Strategy = "openid"
	conf.Auth.OpenId.IssuerUri = "https://example.com"
	conf.Auth.OpenId.ClientId = "kiali-client"
	conf.Auth.OpenId.AuthorizationEndpoint = "https://example.com/auth"

	// Marshal to YAML
	yamlData, err := Marshal(conf)
	require.NoError(t, err)

	// Unmarshal back to config
	conf2, err := Unmarshal(yamlData)
	require.NoError(t, err)

	// Verify all fields are preserved
	assert.Equal(t, conf.Auth.Strategy, conf2.Auth.Strategy)
	assert.Equal(t, conf.Auth.OpenId.IssuerUri, conf2.Auth.OpenId.IssuerUri)
	assert.Equal(t, conf.Auth.OpenId.ClientId, conf2.Auth.OpenId.ClientId)
	assert.Equal(t, conf.Auth.OpenId.AuthorizationEndpoint, conf2.Auth.OpenId.AuthorizationEndpoint)
}

// TestOpenIdDiscoveryOverrideDefaults tests that DiscoveryOverride fields are initialized to empty
func TestOpenIdDiscoveryOverrideDefaults(t *testing.T) {
	conf := NewConfig()

	// Test that DiscoveryOverride fields are initialized to empty strings
	assert.Equal(t, "", conf.Auth.OpenId.DiscoveryOverride.AuthorizationEndpoint)
	assert.Equal(t, "", conf.Auth.OpenId.DiscoveryOverride.TokenEndpoint)
	assert.Equal(t, "", conf.Auth.OpenId.DiscoveryOverride.UserinfoEndpoint)
	assert.Equal(t, "", conf.Auth.OpenId.DiscoveryOverride.JwksUri)
}

// TestOpenIdDiscoveryOverrideUnmarshaling tests that DiscoveryOverride can be unmarshaled from YAML
func TestOpenIdDiscoveryOverrideUnmarshaling(t *testing.T) {
	yamlConfig := `
auth:
  strategy: "openid"
  openid:
    issuer_uri: "https://example.com"
    client_id: "kiali-client"
    discovery_override:
      authorization_endpoint: "https://custom.example.com/auth"
      token_endpoint: "https://custom.example.com/token"
      userinfo_endpoint: "https://custom.example.com/userinfo"
      jwks_uri: "https://custom.example.com/jwks"
`

	conf, err := Unmarshal(yamlConfig)
	require.NoError(t, err)

	assert.Equal(t, "openid", conf.Auth.Strategy)
	assert.Equal(t, "https://example.com", conf.Auth.OpenId.IssuerUri)
	assert.Equal(t, "kiali-client", conf.Auth.OpenId.ClientId)
	assert.Equal(t, "https://custom.example.com/auth", conf.Auth.OpenId.DiscoveryOverride.AuthorizationEndpoint)
	assert.Equal(t, "https://custom.example.com/token", conf.Auth.OpenId.DiscoveryOverride.TokenEndpoint)
	assert.Equal(t, "https://custom.example.com/userinfo", conf.Auth.OpenId.DiscoveryOverride.UserinfoEndpoint)
	assert.Equal(t, "https://custom.example.com/jwks", conf.Auth.OpenId.DiscoveryOverride.JwksUri)
}

// TestOpenIdDiscoveryOverrideMarshalUnmarshal tests that DiscoveryOverride is preserved during marshal/unmarshal
func TestOpenIdDiscoveryOverrideMarshalUnmarshal(t *testing.T) {
	// Create a config with DiscoveryOverride
	conf := NewConfig()
	conf.Auth.Strategy = "openid"
	conf.Auth.OpenId.IssuerUri = "https://example.com"
	conf.Auth.OpenId.ClientId = "kiali-client"
	conf.Auth.OpenId.DiscoveryOverride = DiscoveryOverrideConfig{
		AuthorizationEndpoint: "https://custom.example.com/auth",
		TokenEndpoint:         "https://custom.example.com/token",
		UserinfoEndpoint:      "https://custom.example.com/userinfo",
		JwksUri:               "https://custom.example.com/jwks",
	}

	// Marshal to YAML
	yamlData, err := Marshal(conf)
	require.NoError(t, err)

	// Unmarshal back to config
	conf2, err := Unmarshal(yamlData)
	require.NoError(t, err)

	// Verify all fields are preserved
	assert.Equal(t, conf.Auth.Strategy, conf2.Auth.Strategy)
	assert.Equal(t, conf.Auth.OpenId.IssuerUri, conf2.Auth.OpenId.IssuerUri)
	assert.Equal(t, conf.Auth.OpenId.ClientId, conf2.Auth.OpenId.ClientId)
	assert.Equal(t, conf.Auth.OpenId.DiscoveryOverride.AuthorizationEndpoint, conf2.Auth.OpenId.DiscoveryOverride.AuthorizationEndpoint)
	assert.Equal(t, conf.Auth.OpenId.DiscoveryOverride.TokenEndpoint, conf2.Auth.OpenId.DiscoveryOverride.TokenEndpoint)
	assert.Equal(t, conf.Auth.OpenId.DiscoveryOverride.UserinfoEndpoint, conf2.Auth.OpenId.DiscoveryOverride.UserinfoEndpoint)
	assert.Equal(t, conf.Auth.OpenId.DiscoveryOverride.JwksUri, conf2.Auth.OpenId.DiscoveryOverride.JwksUri)
}

// TestOpenIdDiscoveryOverridePartial tests that partial DiscoveryOverride configuration works
func TestOpenIdDiscoveryOverridePartial(t *testing.T) {
	yamlConfig := `
auth:
  strategy: "openid"
  openid:
    issuer_uri: "https://example.com"
    client_id: "kiali-client"
    discovery_override:
      authorization_endpoint: "https://custom.example.com/auth"
      token_endpoint: "https://custom.example.com/token"
`

	conf, err := Unmarshal(yamlConfig)
	require.NoError(t, err)

	// Only the specified endpoints should be set
	assert.Equal(t, "https://custom.example.com/auth", conf.Auth.OpenId.DiscoveryOverride.AuthorizationEndpoint)
	assert.Equal(t, "https://custom.example.com/token", conf.Auth.OpenId.DiscoveryOverride.TokenEndpoint)
	// Unspecified endpoints should be empty
	assert.Equal(t, "", conf.Auth.OpenId.DiscoveryOverride.UserinfoEndpoint)
	assert.Equal(t, "", conf.Auth.OpenId.DiscoveryOverride.JwksUri)
}

// TestOpenIdDiscoveryOverrideTakesPrecedence tests that DiscoveryOverride takes precedence over deprecated fields
func TestOpenIdDiscoveryOverrideTakesPrecedence(t *testing.T) {
	yamlConfig := `
auth:
  strategy: "openid"
  openid:
    issuer_uri: "https://example.com"
    client_id: "kiali-client"
    authorization_endpoint: "https://deprecated.example.com/auth"
    discovery_override:
      authorization_endpoint: "https://override.example.com/auth"
      token_endpoint: "https://override.example.com/token"
`

	conf, err := Unmarshal(yamlConfig)
	require.NoError(t, err)

	// Both deprecated and new fields should be set (for backward compatibility)
	// But the new DiscoveryOverride fields should have the override values
	// Note: token_endpoint never existed as a deprecated field, only in DiscoveryOverride
	assert.Equal(t, "https://deprecated.example.com/auth", conf.Auth.OpenId.AuthorizationEndpoint)
	assert.Equal(t, "https://override.example.com/auth", conf.Auth.OpenId.DiscoveryOverride.AuthorizationEndpoint)
	assert.Equal(t, "https://override.example.com/token", conf.Auth.OpenId.DiscoveryOverride.TokenEndpoint)
}
