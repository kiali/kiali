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
