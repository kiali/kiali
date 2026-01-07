package tlspolicy

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"

	configv1 "github.com/openshift/api/config/v1"
	configclientset "github.com/openshift/client-go/config/clientset/versioned"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

var defaultCipherSuitesTLS12 = []uint16{
	tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
	tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
	tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
	tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
	tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
	tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
}

// Resolve determines the effective TLS policy based on deployment configuration and,
// when in auto mode, the OpenShift TLSSecurityProfile.
func Resolve(ctx context.Context, conf *config.Config, client kubernetes.ClientInterface) (config.TLSPolicy, error) {
	source := conf.Deployment.TLSConfig.Source

	switch source {
	case config.TLSConfigSourceConfig:
		return policyFromConfig(conf.Deployment.TLSConfig)
	case config.TLSConfigSourceAuto:
		return policyFromOpenShift(ctx, client)
	default:
		return config.TLSPolicy{}, fmt.Errorf(
			"invalid deployment.tls_config.source [%s]; must be one of: %s, %s",
			source, config.TLSConfigSourceAuto, config.TLSConfigSourceConfig)
	}
}

func policyFromConfig(cfg config.DeploymentTLSConfig) (config.TLSPolicy, error) {
	minVersion, err := parseTLSVersion(cfg.MinVersion)
	if err != nil {
		return config.TLSPolicy{}, err
	}
	maxVersion, err := parseTLSVersion(cfg.MaxVersion)
	if err != nil {
		return config.TLSPolicy{}, err
	}
	if minVersion == 0 {
		minVersion = tls.VersionTLS12
	}
	if maxVersion != 0 && maxVersion < minVersion {
		return config.TLSPolicy{}, fmt.Errorf("deployment.tls_config.max_version [%s] is lower than min_version [%s]", cfg.MaxVersion, cfg.MinVersion)
	}

	if minVersion == tls.VersionTLS13 || maxVersion == tls.VersionTLS13 {
		return config.TLSPolicy{
			MinVersion: tls.VersionTLS13,
			MaxVersion: tls.VersionTLS13,
			Source:     config.TLSConfigSourceConfig,
		}, nil
	}

	ciphers, err := parseCipherSuites(cfg.CipherSuites)
	if err != nil {
		return config.TLSPolicy{}, err
	}
	if len(ciphers) == 0 {
		ciphers = defaultCipherSuitesTLS12
	}

	return config.TLSPolicy{
		MinVersion:   minVersion,
		MaxVersion:   maxVersion,
		CipherSuites: ciphers,
		Source:       config.TLSConfigSourceConfig,
	}, nil
}

func policyFromOpenShift(ctx context.Context, client kubernetes.ClientInterface) (config.TLSPolicy, error) {
	if client == nil {
		return config.TLSPolicy{}, fmt.Errorf("deployment.tls_config.source=auto requires a Kubernetes client; set deployment.tls_config.source=config to bypass OpenShift profile lookup")
	}
	if !client.IsOpenShift() {
		return config.TLSPolicy{}, fmt.Errorf("deployment.tls_config.source=auto is only supported on OpenShift clusters; set deployment.tls_config.source=config on non-OpenShift clusters")
	}

	restCfg := rest.CopyConfig(client.ClusterInfo().ClientConfig)
	osConfigClient, err := configclientset.NewForConfig(restCfg)
	if err != nil {
		return config.TLSPolicy{}, fmt.Errorf("failed to initialize OpenShift config client: %w; set deployment.tls_config.source=config to use explicit policy", err)
	}

	apiServer, err := osConfigClient.ConfigV1().APIServers().Get(ctx, "cluster", metav1.GetOptions{})
	if err != nil {
		return config.TLSPolicy{}, fmt.Errorf("failed to read OpenShift TLSSecurityProfile: %w; set deployment.tls_config.source=config to use explicit policy", err)
	}
	profile := apiServer.Spec.TLSSecurityProfile
	if profile == nil {
		profile = &configv1.TLSSecurityProfile{Type: configv1.TLSProfileIntermediateType}
	}

	spec, err := getTLSProfileSpec(profile)
	if err != nil {
		return config.TLSPolicy{}, fmt.Errorf("invalid OpenShift TLSSecurityProfile: %w; set deployment.tls_config.source=config to use explicit policy", err)
	}
	return policyFromProfile(spec, config.TLSConfigSourceAuto)
}

func policyFromProfile(spec *configv1.TLSProfileSpec, source config.TLSConfigSource) (config.TLSPolicy, error) {
	if spec == nil {
		return config.TLSPolicy{}, fmt.Errorf("missing TLS profile specification")
	}

	minVersion, err := parseTLSVersion(string(spec.MinTLSVersion))
	if err != nil {
		return config.TLSPolicy{}, err
	}
	// MaxVersion is not part of TLSSecurityProfile; allow Go to pick the highest version
	// unless the profile mandates TLS 1.3 only.
	maxVersion := uint16(0)

	if minVersion == tls.VersionTLS13 || maxVersion == tls.VersionTLS13 {
		return config.TLSPolicy{
			MinVersion: tls.VersionTLS13,
			MaxVersion: tls.VersionTLS13,
			Source:     source,
		}, nil
	}

	ciphers, err := parseCipherSuites(spec.Ciphers)
	if err != nil {
		return config.TLSPolicy{}, err
	}
	if len(ciphers) == 0 {
		ciphers = defaultCipherSuitesTLS12
	}

	if minVersion == 0 {
		minVersion = tls.VersionTLS12
	}

	return config.TLSPolicy{
		MinVersion:   minVersion,
		MaxVersion:   maxVersion,
		CipherSuites: ciphers,
		Source:       source,
	}, nil
}

func getTLSProfileSpec(profile *configv1.TLSSecurityProfile) (*configv1.TLSProfileSpec, error) {
	switch profile.Type {
	case configv1.TLSProfileOldType,
		configv1.TLSProfileIntermediateType,
		configv1.TLSProfileModernType:
		return configv1.TLSProfiles[profile.Type], nil
	case configv1.TLSProfileCustomType:
		if profile.Custom == nil {
			return nil, fmt.Errorf("custom TLS profile specified but Custom field is nil")
		}
		return &profile.Custom.TLSProfileSpec, nil
	default:
		return nil, fmt.Errorf("unknown TLS profile type [%s]", profile.Type)
	}
}

func parseTLSVersion(version string) (uint16, error) {
	switch strings.TrimSpace(version) {
	case "":
		return 0, nil
	case "TLSv1.0", "TLS1.0", "VersionTLS10":
		return 0, fmt.Errorf("TLS 1.0 is not supported due to known security vulnerabilities; use TLS 1.2 or higher")
	case "TLSv1.1", "TLS1.1", "VersionTLS11":
		return 0, fmt.Errorf("TLS 1.1 is not supported due to known security vulnerabilities; use TLS 1.2 or higher")
	case "TLSv1.2", "TLS1.2", "VersionTLS12":
		return tls.VersionTLS12, nil
	case "TLSv1.3", "TLS1.3", "VersionTLS13":
		return tls.VersionTLS13, nil
	default:
		return 0, fmt.Errorf("unknown TLS version [%s]; supported versions are TLSv1.2 and TLSv1.3", version)
	}
}

func parseCipherSuites(names []string) ([]uint16, error) {
	if len(names) == 0 {
		return nil, nil
	}

	cipherMap := map[string]uint16{
		"ECDHE-RSA-AES128-GCM-SHA256":             tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
		"ECDHE-ECDSA-AES128-GCM-SHA256":           tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
		"ECDHE-RSA-AES256-GCM-SHA384":             tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
		"ECDHE-ECDSA-AES256-GCM-SHA384":           tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
		"ECDHE-RSA-CHACHA20-POLY1305":             tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
		"ECDHE-ECDSA-CHACHA20-POLY1305":           tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
		"AES128-GCM-SHA256":                       tls.TLS_RSA_WITH_AES_128_GCM_SHA256,
		"AES256-GCM-SHA384":                       tls.TLS_RSA_WITH_AES_256_GCM_SHA384,
		"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256":   tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
		"TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256": tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
		"TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384":   tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
		"TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384": tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
		"TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305":    tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
		"TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305":  tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
		"TLS_AES_128_GCM_SHA256":                  tls.TLS_AES_128_GCM_SHA256,
		"TLS_AES_256_GCM_SHA384":                  tls.TLS_AES_256_GCM_SHA384,
	}

	unsupported := make([]string, 0)
	result := make([]uint16, 0, len(names))
	for _, name := range names {
		normalized := strings.ToUpper(strings.TrimSpace(name))
		suite, found := cipherMap[normalized]
		if !found {
			unsupported = append(unsupported, name)
			continue
		}
		result = append(result, suite)
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("no supported TLS cipher suites found from list: %v", unsupported)
	}
	if len(unsupported) > 0 {
		log.Warningf("Skipping unsupported TLS cipher suites (not available in Go stdlib): %v", unsupported)
	}
	return result, nil
}
