package tlspolicy

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"
	"sync"

	configv1 "github.com/openshift/api/config/v1"
	configclientset "github.com/openshift/client-go/config/clientset/versioned"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
)

// defaultCipherSuitesTLS12 and its sync.Once are used for lazy initialization of the
// default TLS 1.2 cipher suites list, built dynamically from Go's crypto/tls package.
var (
	defaultCipherSuitesTLS12     []uint16
	defaultCipherSuitesTLS12Once sync.Once
)

// getDefaultCipherSuitesTLS12 returns Go's secure cipher suites that support TLS 1.2.
// This is used as a fallback when no cipher suites are explicitly configured.
// Only secure ciphers from tls.CipherSuites() are included; insecure ciphers are excluded.
func getDefaultCipherSuitesTLS12() []uint16 {
	defaultCipherSuitesTLS12Once.Do(func() {
		var names []string
		for _, suite := range tls.CipherSuites() {
			for _, version := range suite.SupportedVersions {
				if version == tls.VersionTLS12 {
					defaultCipherSuitesTLS12 = append(defaultCipherSuitesTLS12, suite.ID)
					names = append(names, suite.Name)
					break
				}
			}
		}
		log.Tracef("Dynamically built default TLS 1.2 cipher suites list from Go stdlib: %v", names)
	})
	return defaultCipherSuitesTLS12
}

// cipherMap and its sync.Once are used for lazy initialization of the cipher name
// to ID mapping, built dynamically from Go's crypto/tls package.
var (
	cipherMap     map[string]uint16
	cipherMapOnce sync.Once
)

// opensslToIANA maps OpenSSL-style cipher names to their IANA equivalents.
// OpenShift TLS profiles use OpenSSL naming conventions, but Go's crypto/tls
// uses IANA names. This table provides the translation for cipher names that
// differ between the two conventions.
var opensslToIANA = map[string]string{
	"AES128-GCM-SHA256":             "TLS_RSA_WITH_AES_128_GCM_SHA256",
	"AES256-GCM-SHA384":             "TLS_RSA_WITH_AES_256_GCM_SHA384",
	"ECDHE-ECDSA-AES128-GCM-SHA256": "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
	"ECDHE-ECDSA-AES256-GCM-SHA384": "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384",
	"ECDHE-ECDSA-CHACHA20-POLY1305": "TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
	"ECDHE-RSA-AES128-GCM-SHA256":   "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
	"ECDHE-RSA-AES256-GCM-SHA384":   "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
	"ECDHE-RSA-CHACHA20-POLY1305":   "TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256",
}

// buildCipherMap constructs a map of cipher suite names to their Go crypto/tls IDs.
// It dynamically discovers all cipher suites supported by Go and adds OpenSSL-style
// aliases for compatibility with OpenShift TLS profiles.
func buildCipherMap() map[string]uint16 {
	m := make(map[string]uint16)

	// Dynamically add all cipher suites from Go's crypto/tls by their IANA names.
	// This automatically picks up new cipher suites added to Go.
	for _, suite := range tls.CipherSuites() {
		m[suite.Name] = suite.ID
	}
	// Also include insecure cipher suites (e.g., RSA key exchange without forward secrecy)
	// since some OpenShift TLS profiles (like "Old") may reference them.
	for _, suite := range tls.InsecureCipherSuites() {
		m[suite.Name] = suite.ID
	}

	// Add OpenSSL-style aliases for cipher names used by OpenShift TLS profiles.
	// These map to the same cipher IDs but use OpenSSL naming conventions.
	for openssl, iana := range opensslToIANA {
		if id, ok := m[iana]; ok {
			m[openssl] = id
		} else {
			log.Warningf("OpenSSL cipher alias [%s] -> [%s] has no matching Go cipher suite; alias will not be available", openssl, iana)
		}
	}

	return m
}

// getCipherMap returns the cached cipher map, building it on first call.
func getCipherMap() map[string]uint16 {
	cipherMapOnce.Do(func() {
		cipherMap = buildCipherMap()
		log.Tracef("Dynamically built cipher map from Go stdlib: %v", cipherMap)
	})
	return cipherMap
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
			"invalid deployment.tls_config.source [%s]; must be one of: [%s], [%s]",
			source, config.TLSConfigSourceAuto, config.TLSConfigSourceConfig)
	}
}

// policyFromConfig builds a TLS policy from explicit configuration values.
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

	// When minVersion is explicitly set to TLS 1.3, we enforce TLS 1.3-only mode.
	// This ensures cipher suites are managed by Go (TLS 1.3 cipher suites are not configurable).
	// If the user wants a range (e.g., TLS 1.2 to TLS 1.3), they should set min < TLS 1.3.
	if minVersion == tls.VersionTLS13 {
		return config.TLSPolicy{
			MinVersion: tls.VersionTLS13,
			MaxVersion: tls.VersionTLS13,
			Source:     config.TLSConfigSourceConfig,
		}, nil
	}

	// For TLS 1.2 and mixed TLS 1.2/1.3 ranges, configure cipher suites.
	// Note: cipher suites only apply to TLS 1.2 connections; TLS 1.3 uses Go's defaults.
	ciphers, err := parseCipherSuites(cfg.CipherSuites)
	if err != nil {
		return config.TLSPolicy{}, err
	}
	if len(ciphers) == 0 {
		ciphers = getDefaultCipherSuitesTLS12()
	}

	return config.TLSPolicy{
		MinVersion:   minVersion,
		MaxVersion:   maxVersion,
		CipherSuites: ciphers,
		Source:       config.TLSConfigSourceConfig,
	}, nil
}

// policyFromOpenShift queries the OpenShift APIServer to get the cluster's TLSSecurityProfile
// and builds a TLS policy from it. If no TLSSecurityProfile is configured in the cluster,
// the Intermediate profile is used as the default (matching OpenShift's default behavior).
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
		log.Debug("OpenShift APIServer has no TLSSecurityProfile configured; defaulting to Intermediate profile")
		profile = &configv1.TLSSecurityProfile{Type: configv1.TLSProfileIntermediateType}
	}

	spec, err := getTLSProfileSpec(profile)
	if err == nil {
		log.Debugf("OpenShift TLSSecurityProfile: type=[%s] minTLSVersion=[%s] ciphers=%v", profile.Type, spec.MinTLSVersion, spec.Ciphers)
	}
	if err != nil {
		return config.TLSPolicy{}, fmt.Errorf("invalid OpenShift TLSSecurityProfile: %w; set deployment.tls_config.source=config to use explicit policy", err)
	}
	return policyFromProfile(spec, config.TLSConfigSourceAuto)
}

// policyFromProfile converts an OpenShift TLSProfileSpec into a Kiali TLSPolicy.
func policyFromProfile(spec *configv1.TLSProfileSpec, source config.TLSConfigSource) (config.TLSPolicy, error) {
	if spec == nil {
		return config.TLSPolicy{}, fmt.Errorf("missing TLS profile specification")
	}

	minVersion, err := parseTLSVersion(string(spec.MinTLSVersion))
	if err != nil {
		return config.TLSPolicy{}, err
	}
	// MaxVersion is not part of OpenShift TLSSecurityProfile; we set it to 0 to allow Go
	// to negotiate the highest version supported by both client and server. However, when
	// the profile mandates TLS 1.3 as minimum, we enforce TLS 1.3 exclusively.
	maxVersion := uint16(0)

	// Validate version constraints (should not really occur with valid OpenShift profiles)
	if maxVersion != 0 && maxVersion < minVersion {
		return config.TLSPolicy{}, fmt.Errorf("OpenShift TLSSecurityProfile has invalid version constraints: max_version [%x] is lower than min_version [%x]", maxVersion, minVersion)
	}

	if minVersion == tls.VersionTLS13 {
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
		ciphers = getDefaultCipherSuitesTLS12()
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

// getTLSProfileSpec extracts the TLSProfileSpec from an OpenShift TLSSecurityProfile,
// handling both built-in profiles (Old, Intermediate, Modern) and custom profiles.
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
		return nil, fmt.Errorf("unknown TLS profile type: [%s]", profile.Type)
	}
}

// parseTLSVersion converts a TLS version string to Go's crypto/tls version constant.
// TLS 1.0 and 1.1 are rejected due to known security vulnerabilities.
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

// parseCipherSuites converts cipher suite names to Go's crypto/tls cipher IDs.
// Unsupported ciphers (e.g., DHE ciphers not available in Go) are logged and skipped.
func parseCipherSuites(names []string) ([]uint16, error) {
	if len(names) == 0 {
		return nil, nil
	}

	ciphers := getCipherMap()
	unsupported := make([]string, 0)
	result := make([]uint16, 0, len(names))
	for _, name := range names {
		normalized := strings.ToUpper(strings.TrimSpace(name))
		suite, found := ciphers[normalized]
		if !found {
			unsupported = append(unsupported, name)
			continue
		}
		result = append(result, suite)
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("no supported TLS cipher suites found from list: [%v]", unsupported)
	}
	if len(unsupported) > 0 {
		log.Warningf("Skipping unsupported TLS cipher suites (not available in Go stdlib): [%v]", unsupported)
	}
	return result, nil
}
