package tlspolicy

import (
	"context"
	"crypto/tls"
	"testing"

	configv1 "github.com/openshift/api/config/v1"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	kube "github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func TestResolveConfigDefaults(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.TLSConfig.Source = config.TLSConfigSourceConfig
	conf.Deployment.TLSConfig.MinVersion = ""
	conf.Deployment.TLSConfig.MaxVersion = ""
	conf.Deployment.TLSConfig.CipherSuites = nil

	policy, err := Resolve(context.Background(), conf, nil)
	if err != nil {
		t.Fatalf("resolve with config source failed: %v", err)
	}
	if policy.MinVersion != tls.VersionTLS12 {
		t.Fatalf("expected min TLS 1.2, got %x", policy.MinVersion)
	}
	if policy.MaxVersion != 0 {
		t.Fatalf("expected max TLS version unset, got %x", policy.MaxVersion)
	}
	if len(policy.CipherSuites) == 0 {
		t.Fatalf("expected default cipher suites for TLS1.2")
	}
}

func TestResolveConfigTLS13(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.TLSConfig.Source = config.TLSConfigSourceConfig
	conf.Deployment.TLSConfig.MinVersion = "TLSv1.3"

	policy, err := Resolve(context.Background(), conf, nil)
	if err != nil {
		t.Fatalf("resolve with TLS1.3 config failed: %v", err)
	}
	if policy.MinVersion != tls.VersionTLS13 || policy.MaxVersion != tls.VersionTLS13 {
		t.Fatalf("expected TLS1.3-only policy, got min %x max %x", policy.MinVersion, policy.MaxVersion)
	}
	if len(policy.CipherSuites) != 0 {
		t.Fatalf("expected no cipher suites for TLS1.3, got %d", len(policy.CipherSuites))
	}
}

func TestResolveAutoNonOpenShift(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.TLSConfig.Source = config.TLSConfigSourceAuto

	fakeClient := &kubetest.FakeK8sClient{
		OpenShift: false,
		KubeClusterInfo: kube.ClusterInfo{
			ClientConfig: &rest.Config{},
		},
	}

	if _, err := Resolve(context.Background(), conf, fakeClient); err == nil {
		t.Fatalf("expected error resolving auto policy on non-OpenShift cluster")
	}
}

func TestResolveConfigInvalidCipher(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.TLSConfig.Source = config.TLSConfigSourceConfig
	conf.Deployment.TLSConfig.CipherSuites = []string{"BOGUS-CIPHER"}

	if _, err := Resolve(context.Background(), conf, nil); err == nil {
		t.Fatalf("expected invalid cipher suite to fail resolution")
	}

	conf.Deployment.TLSConfig.CipherSuites = []string{"ECDHE-RSA-AES128-GCM-SHA256"}
	if policy, err := Resolve(context.Background(), conf, nil); err != nil {
		t.Fatalf("expected valid cipher suite to succeed: %v", err)
	} else if len(policy.CipherSuites) != 1 {
		t.Fatalf("expected 1 cipher suite, got %d", len(policy.CipherSuites))
	}
}

func TestPolicyFromProfileAcceptsTLSPrefixedCiphers(t *testing.T) {
	profile := &configv1.TLSProfileSpec{
		MinTLSVersion: configv1.VersionTLS12,
		Ciphers:       []string{"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"},
	}

	policy, err := policyFromProfile(profile, config.TLSConfigSourceAuto)
	if err != nil {
		t.Fatalf("expected TLS-prefixed cipher suites to be accepted: %v", err)
	}
	if len(policy.CipherSuites) != 1 {
		t.Fatalf("expected 1 cipher suite, got %d", len(policy.CipherSuites))
	}
	if policy.MinVersion != tls.VersionTLS12 {
		t.Fatalf("expected TLS1.2 min version, got %x", policy.MinVersion)
	}
}

func TestResolveRejectsTLS10(t *testing.T) {
	// Test all TLS 1.0 version string variations
	tls10Versions := []string{"TLSv1.0", "TLS1.0", "VersionTLS10"}

	for _, version := range tls10Versions {
		conf := config.NewConfig()
		conf.Deployment.TLSConfig.Source = config.TLSConfigSourceConfig
		conf.Deployment.TLSConfig.MinVersion = version

		_, err := Resolve(context.Background(), conf, nil)
		if err == nil {
			t.Errorf("expected TLS 1.0 version [%s] to be rejected, but it was accepted", version)
		}
	}
}

func TestResolveRejectsTLS11(t *testing.T) {
	// Test all TLS 1.1 version string variations
	tls11Versions := []string{"TLSv1.1", "TLS1.1", "VersionTLS11"}

	for _, version := range tls11Versions {
		conf := config.NewConfig()
		conf.Deployment.TLSConfig.Source = config.TLSConfigSourceConfig
		conf.Deployment.TLSConfig.MinVersion = version

		_, err := Resolve(context.Background(), conf, nil)
		if err == nil {
			t.Errorf("expected TLS 1.1 version [%s] to be rejected, but it was accepted", version)
		}
	}
}

func TestResolveRejectsInsecureTLSAsMaxVersion(t *testing.T) {
	// Also test that TLS 1.0/1.1 are rejected when used as max_version
	insecureVersions := []string{"TLSv1.0", "TLSv1.1"}

	for _, version := range insecureVersions {
		conf := config.NewConfig()
		conf.Deployment.TLSConfig.Source = config.TLSConfigSourceConfig
		conf.Deployment.TLSConfig.MinVersion = "TLSv1.2" // valid min
		conf.Deployment.TLSConfig.MaxVersion = version   // invalid max

		_, err := Resolve(context.Background(), conf, nil)
		if err == nil {
			t.Errorf("expected insecure TLS version [%s] as max_version to be rejected, but it was accepted", version)
		}
	}
}

func TestResolveRejectsMaxLessThanMin(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.TLSConfig.Source = config.TLSConfigSourceConfig
	conf.Deployment.TLSConfig.MinVersion = "TLSv1.3"
	conf.Deployment.TLSConfig.MaxVersion = "TLSv1.2"

	_, err := Resolve(context.Background(), conf, nil)
	if err == nil {
		t.Fatalf("expected error when max_version [TLSv1.2] is lower than min_version [TLSv1.3]")
	}
}

func TestParseGroupsValidNames(t *testing.T) {
	names := []string{"X25519", "secp256r1", "secp384r1", "secp521r1", "X25519MLKEM768"}
	groups, err := parseGroups(names)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 5 {
		t.Fatalf("expected 5 groups, got %d", len(groups))
	}
	expected := []tls.CurveID{tls.X25519, tls.CurveP256, tls.CurveP384, tls.CurveP521, tls.X25519MLKEM768}
	for i, g := range groups {
		if g != expected[i] {
			t.Errorf("group[%d]: expected %d, got %d", i, expected[i], g)
		}
	}
}

func TestParseGroupsEmpty(t *testing.T) {
	groups, err := parseGroups(nil)
	if err != nil {
		t.Fatalf("unexpected error for nil input: %v", err)
	}
	if groups != nil {
		t.Fatalf("expected nil for nil input, got %v", groups)
	}

	groups, err = parseGroups([]string{})
	if err != nil {
		t.Fatalf("unexpected error for empty input: %v", err)
	}
	if groups != nil {
		t.Fatalf("expected nil for empty input, got %v", groups)
	}
}

func TestParseGroupsMixedValidInvalid(t *testing.T) {
	names := []string{"X25519", "BOGUS_GROUP", "secp256r1"}
	groups, err := parseGroups(names)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(groups) != 2 {
		t.Fatalf("expected 2 groups (skipping invalid), got %d", len(groups))
	}
	if groups[0] != tls.X25519 || groups[1] != tls.CurveP256 {
		t.Errorf("unexpected group values: %v", groups)
	}
}

func TestParseGroupsAllInvalid(t *testing.T) {
	names := []string{"FAKE_GROUP", "ANOTHER_FAKE"}
	_, err := parseGroups(names)
	if err == nil {
		t.Fatalf("expected error when all groups are unsupported")
	}
}

func TestParseGroupsCaseSensitive(t *testing.T) {
	// Group names are case-sensitive per the OpenShift API
	names := []string{"x25519", "SECP256R1", "X25519"}
	groups, err := parseGroups(names)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Only "X25519" should match (exact case); "x25519" and "SECP256R1" should be skipped
	if len(groups) != 1 {
		t.Fatalf("expected 1 group (case-sensitive matching), got %d", len(groups))
	}
	if groups[0] != tls.X25519 {
		t.Errorf("expected X25519, got %d", groups[0])
	}
}

func TestResolveConfigWithGroups(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.TLSConfig.Source = config.TLSConfigSourceConfig
	conf.Deployment.TLSConfig.Groups = []string{"X25519", "secp256r1"}

	policy, err := Resolve(context.Background(), conf, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(policy.Groups) != 2 {
		t.Fatalf("expected 2 groups, got %d", len(policy.Groups))
	}
}

func TestResolveConfigWithGroupsTLS13(t *testing.T) {
	conf := config.NewConfig()
	conf.Deployment.TLSConfig.Source = config.TLSConfigSourceConfig
	conf.Deployment.TLSConfig.MinVersion = "TLSv1.3"
	conf.Deployment.TLSConfig.Groups = []string{"X25519MLKEM768", "X25519"}

	policy, err := Resolve(context.Background(), conf, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if policy.MinVersion != tls.VersionTLS13 {
		t.Fatalf("expected TLS 1.3, got %x", policy.MinVersion)
	}
	if len(policy.Groups) != 2 {
		t.Fatalf("expected 2 groups even in TLS1.3 mode, got %d", len(policy.Groups))
	}
}

func TestPolicyFromProfileWithGroups(t *testing.T) {
	profile := &configv1.TLSProfileSpec{
		MinTLSVersion: configv1.VersionTLS12,
		Ciphers:       []string{"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"},
		Groups:        []configv1.TLSGroup{"X25519", "secp256r1", "secp384r1"},
	}

	policy, err := policyFromProfile(profile, config.TLSConfigSourceAuto)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(policy.Groups) != 3 {
		t.Fatalf("expected 3 groups, got %d", len(policy.Groups))
	}
}

func TestPolicyFromProfileWithNilGroups(t *testing.T) {
	profile := &configv1.TLSProfileSpec{
		MinTLSVersion: configv1.VersionTLS12,
		Ciphers:       []string{"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"},
	}

	policy, err := policyFromProfile(profile, config.TLSConfigSourceAuto)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if policy.Groups != nil {
		t.Fatalf("expected nil groups for profile without groups, got %v", policy.Groups)
	}
}
