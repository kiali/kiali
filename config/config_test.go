package config

import (
	"crypto/x509"
	_ "embed"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/util"
	"github.com/kiali/kiali/util/filetest"
)

//go:embed testdata/test-ca.pem
var testCA []byte

func TestSecretFileOverrides(t *testing.T) {
	// create a mock volume mount directory where the test secret content will go
	overrideSecretsDir = t.TempDir()

	conf := NewConfig()
	conf.ExternalServices.Grafana.Auth.Username = "grafanausername"
	conf.ExternalServices.Grafana.Auth.Password = "grafanapassword"
	conf.ExternalServices.Grafana.Auth.Token = "grafanatoken"
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
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Username, "grafanausername")
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Password, "grafanapassword")
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Token, "grafanatoken")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Username, "prometheususername")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Password, "prometheuspassword")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Token, "prometheustoken")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Username, "tracingusername")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Password, "tracingpassword")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Token, "tracingtoken")
	assert.Equal(t, conf.LoginToken.SigningKey, "signingkey")
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Username, "cd-prometheususername")
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Password, "cd-prometheuspassword")
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Token, "cd-prometheustoken")

	// mock some secrets bound to volume mounts
	createTestSecretFile(t, overrideSecretsDir, SecretFileGrafanaUsername, "grafanausernameENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileGrafanaPassword, "grafanapasswordENV")
	createTestSecretFile(t, overrideSecretsDir, SecretFileGrafanaToken, "grafanatokenENV")
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

	// credentials are now set- values should be overridden
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Username, "grafanausernameENV")
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Password, "grafanapasswordENV")
	assert.Equal(t, conf.ExternalServices.Grafana.Auth.Token, "grafanatokenENV")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Username, "prometheususernameENV")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Password, "prometheuspasswordENV")
	assert.Equal(t, conf.ExternalServices.Prometheus.Auth.Token, "prometheustokenENV")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Username, "tracingusernameENV")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Password, "tracingpasswordENV")
	assert.Equal(t, conf.ExternalServices.Tracing.Auth.Token, "tracingtokenENV")
	assert.Equal(t, conf.LoginToken.SigningKey, "signingkeyENV")
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Username, "cdprometheususernameENV")
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Password, "cdprometheuspasswordENV")
	assert.Equal(t, conf.ExternalServices.CustomDashboards.Prometheus.Auth.Token, "cdprometheustokenENV")
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
	conf.ExternalServices.CustomDashboards.Prometheus.Auth.Username = "my-username"
	conf.ExternalServices.CustomDashboards.Prometheus.Auth.Password = "my-password"
	conf.ExternalServices.CustomDashboards.Prometheus.Auth.Token = "my-token"

	printed := fmt.Sprintf("%v", conf)

	assert.NotContains(t, printed, "my-username")
	assert.NotContains(t, printed, "my-password")
	assert.NotContains(t, printed, "my-token")
	assert.NotContains(t, printed, "my-signkey")
	assert.Contains(t, printed, "12345")

	// Test that the original values are unchanged
	assert.Equal(t, "my-username", conf.ExternalServices.Grafana.Auth.Username)
	assert.Equal(t, "my-password", conf.ExternalServices.Grafana.Auth.Password)
	assert.Equal(t, "my-token", conf.ExternalServices.Grafana.Auth.Token)
	assert.Equal(t, "my-username", conf.ExternalServices.Prometheus.Auth.Username)
	assert.Equal(t, "my-password", conf.ExternalServices.Prometheus.Auth.Password)
	assert.Equal(t, "my-token", conf.ExternalServices.Prometheus.Auth.Token)
	assert.Equal(t, "my-username", conf.ExternalServices.Tracing.Auth.Username)
	assert.Equal(t, "my-password", conf.ExternalServices.Tracing.Auth.Password)
	assert.Equal(t, "my-token", conf.ExternalServices.Tracing.Auth.Token)
	assert.Equal(t, "my-signkey", conf.LoginToken.SigningKey)
	assert.Equal(t, "my-username", conf.ExternalServices.CustomDashboards.Prometheus.Auth.Username)
	assert.Equal(t, "my-password", conf.ExternalServices.CustomDashboards.Prometheus.Auth.Password)
	assert.Equal(t, "my-token", conf.ExternalServices.CustomDashboards.Prometheus.Auth.Token)
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
	conf.LoginToken.SigningKey = util.RandomString(16)
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
	conf.LoginToken.SigningKey = util.RandomString(16)

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

func TestLoadingCertPool(t *testing.T) {
	systemPool, err := x509.SystemCertPool()
	require.NoError(t, err)

	addtionalCAPool := systemPool.Clone()
	require.True(t, addtionalCAPool.AppendCertsFromPEM(testCA), "unable to add testCA to system pool")

	invalidCA := filetest.TempFile(t, []byte("notarealCA")).Name()

	cases := map[string]struct {
		addtionalBundles []string
		expected         *x509.CertPool
		expectedErr      bool
	}{
		"No addtional CAs loads system Pool": {
			expected: systemPool.Clone(),
		},
		"Addtional CAs loads system Pool": {
			addtionalBundles: []string{"testdata/test-ca.pem"},
			expected:         addtionalCAPool,
		},
		"Non-existant CA file does not return err and still loads system pool": {
			addtionalBundles: []string{"non-existant"},
			expected:         systemPool.Clone(),
		},
		"CA file with bogus contents returns err and still loads system pool": {
			addtionalBundles: []string{invalidCA},
			expected:         systemPool.Clone(),
			expectedErr:      true,
		},
		// Need to test this for OpenShift serving cert that may come from multiple places.
		"Loading the same CA multiple times": {
			addtionalBundles: []string{"testdata/test-ca.pem", "testdata/test-ca.pem"},
			expected:         addtionalCAPool,
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			conf := NewConfig()

			err = conf.loadCertPool(tc.addtionalBundles...)
			if tc.expectedErr {
				require.Error(err)
			} else {
				require.NoError(err)
			}

			actual := conf.CertPool()

			require.True(tc.expected.Equal(actual))
		})
	}
}
