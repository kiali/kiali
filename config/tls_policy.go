package config

import (
	"crypto/tls"

	"github.com/kiali/kiali/log"
)

// TLSPolicy is the resolved TLS policy for the Kiali server and outbound clients.
type TLSPolicy struct {
	CipherSuites []uint16
	MaxVersion   uint16
	MinVersion   uint16
	Source       TLSConfigSource
}

// tlsVersionName returns a human-readable name for a TLS version constant.
func tlsVersionName(v uint16) string {
	switch v {
	case tls.VersionTLS10:
		return "TLS 1.0"
	case tls.VersionTLS11:
		return "TLS 1.1"
	case tls.VersionTLS12:
		return "TLS 1.2"
	case tls.VersionTLS13:
		return "TLS 1.3"
	default:
		return "unknown"
	}
}

// ApplyTo applies the policy to the given tls.Config, preserving existing
// NextProtos and CA/verification hooks configured elsewhere.
// If the policy is empty (no min/max version or cipher suites), it applies
// a secure default of TLS 1.2 minimum to prevent downgrade attacks.
// The policy always overrides cfg values; if cfg had a higher MinVersion that
// gets downgraded, a warning is logged to alert developers of a potential issue.
func (p TLSPolicy) ApplyTo(cfg *tls.Config) {
	if cfg == nil {
		return
	}

	// Apply secure defaults if the policy is empty (no explicit configuration)
	minVersion := p.MinVersion
	if minVersion == 0 && p.MaxVersion == 0 && len(p.CipherSuites) == 0 {
		minVersion = tls.VersionTLS12
	}

	// Warn if cfg had a higher MinVersion that will be downgraded by the policy
	// This is likely a developer error, so we log a warning.
	// We should not be passing in any MinVersion in cfg - TLS policy should be the source of truth.
	if cfg.MinVersion != 0 && minVersion != 0 && cfg.MinVersion > minVersion {
		log.Warningf("TLS MinVersion downgrade detected: cfg had [%s] but policy sets [%s]. "+
			"This may weaken security; consider setting a more secure MinVersion in your config.", tlsVersionName(cfg.MinVersion), tlsVersionName(minVersion))
	}

	if minVersion != 0 {
		cfg.MinVersion = minVersion
	}
	if p.MaxVersion != 0 {
		cfg.MaxVersion = p.MaxVersion
	}

	// TLS 1.3 ignores CipherSuites; leave nil to allow Go defaults.
	if cfg.MinVersion == tls.VersionTLS13 || cfg.MaxVersion == tls.VersionTLS13 {
		cfg.CipherSuites = nil
		return
	}

	if len(p.CipherSuites) > 0 {
		cfg.CipherSuites = p.CipherSuites
	}
}
