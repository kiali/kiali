package config

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/util/certtest"
)

// Test helper: generate CA certificate missing CertSign key usage
func generateCAMissingKeyUsage(t *testing.T) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "bad-ca"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature, // Missing CertSign!
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	require.NoError(t, err)
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
}

// Test helper: write cert to temp file
func writeTempCertFile(t *testing.T, certPEM []byte) string {
	t.Helper()
	tmpFile := filepath.Join(t.TempDir(), "test-ca.crt")
	require.NoError(t, os.WriteFile(tmpFile, certPEM, 0600))
	return tmpFile
}

func TestCredentialManager_RejectsExpiredCertificate(t *testing.T) {
	expiredCA := certtest.MustGenCAWithValidity(t, "expired-ca",
		time.Now().Add(-48*time.Hour),
		time.Now().Add(-24*time.Hour), // Expired yesterday
	)
	tmpFile := writeTempCertFile(t, expiredCA)

	// Expired certificate is logged but doesn't fail - manager is created with system CAs
	cm, err := NewCredentialManager([]string{tmpFile})
	require.NoError(t, err)
	defer cm.Close()

	// Custom CA should not be loaded (expired cert was skipped)
	require.False(t, cm.HasCustomCAs())
}

func TestCredentialManager_AcceptsNotYetValidCertificate(t *testing.T) {
	futureCA := certtest.MustGenCAWithValidity(t, "future-ca",
		time.Now().Add(24*time.Hour), // Valid tomorrow
		time.Now().Add(365*24*time.Hour),
	)
	tmpFile := writeTempCertFile(t, futureCA)

	cm, err := NewCredentialManager([]string{tmpFile})
	require.NoError(t, err)
	defer cm.Close()

	// Should accept not-yet-valid certificates for pre-staging
	require.True(t, cm.HasCustomCAs())
}

func TestCredentialManager_RejectsWeakRSAKey(t *testing.T) {
	weakCA := certtest.MustGenCAWithKeySize(t, "weak-ca", 1024) // Weak 1024-bit key
	tmpFile := writeTempCertFile(t, weakCA)

	// Weak key is logged but doesn't fail - manager is created with system CAs
	cm, err := NewCredentialManager([]string{tmpFile})
	require.NoError(t, err)
	defer cm.Close()

	// Custom CA should not be loaded (weak key cert was skipped)
	require.False(t, cm.HasCustomCAs())
}

func TestCredentialManager_AcceptsStrongRSAKeys(t *testing.T) {
	cases := []struct {
		name         string
		keySize      int
		expectCustom bool // Whether custom CA should be loaded
	}{
		{"RSA 2048 (minimum)", 2048, true},
		{"RSA 3072", 3072, true},
		{"RSA 4096", 4096, true},
		{"RSA 1024 (weak)", 1024, false}, // Weak keys are skipped, not an error
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cert := certtest.MustGenCAWithKeySize(t, "test-rsa-ca", tc.keySize)
			tmpFile := writeTempCertFile(t, cert)

			// NewCredentialManager no longer fails on invalid certs
			cm, err := NewCredentialManager([]string{tmpFile})
			require.NoError(t, err)
			defer cm.Close()

			require.Equal(t, tc.expectCustom, cm.HasCustomCAs())
		})
	}
}

func TestCredentialManager_AcceptsStrongECDSAKeys(t *testing.T) {
	cases := []struct {
		name         string
		curveSize    int
		expectCustom bool // Whether custom CA should be loaded
	}{
		{"ECDSA P-256 (minimum)", 256, true},
		{"ECDSA P-384", 384, true},
		{"ECDSA P-521", 521, true},
		{"ECDSA P-224 (weak)", 224, false}, // Weak keys are skipped, not an error
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cert := certtest.MustGenECDSACA(t, "test-ecdsa-ca", tc.curveSize)
			tmpFile := writeTempCertFile(t, cert)

			// NewCredentialManager no longer fails on invalid certs
			cm, err := NewCredentialManager([]string{tmpFile})
			require.NoError(t, err)
			defer cm.Close()

			require.Equal(t, tc.expectCustom, cm.HasCustomCAs())
		})
	}
}

func TestCredentialManager_RejectsCAMissingKeyUsage(t *testing.T) {
	badCA := generateCAMissingKeyUsage(t)
	tmpFile := writeTempCertFile(t, badCA)

	// CA with KeyUsage but missing CertSign is logged but doesn't fail
	cm, err := NewCredentialManager([]string{tmpFile})
	require.NoError(t, err)
	defer cm.Close()

	// Custom CA should not be loaded (invalid key usage cert was skipped)
	require.False(t, cm.HasCustomCAs())
}

func TestCredentialManager_RejectsMalformedCertificate(t *testing.T) {
	cases := []struct {
		name    string
		content []byte
	}{
		{
			name:    "Invalid PEM",
			content: []byte("not-a-valid-pem-certificate"),
		},
		{
			name:    "Truncated certificate",
			content: []byte("-----BEGIN CERTIFICATE-----\nMIIC/DCCAeSgAwIBAgIQ\n-----END CERTIFICATE-----"),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tmpFile := writeTempCertFile(t, tc.content)

			// Malformed certificates are logged but don't fail - manager is created
			cm, err := NewCredentialManager([]string{tmpFile})
			require.NoError(t, err)
			defer cm.Close()

			// Custom CA should not be loaded (malformed cert was skipped)
			require.False(t, cm.HasCustomCAs())
		})
	}
}

func TestCredentialManager_EmptyCABundle(t *testing.T) {
	// Empty file is silently skipped (no error) but results in no custom CAs
	tmpFile := writeTempCertFile(t, []byte(""))

	cm, err := NewCredentialManager([]string{tmpFile})
	require.NoError(t, err)
	defer cm.Close()

	// No custom CAs loaded because file was empty
	require.False(t, cm.HasCustomCAs())
}

func TestCredentialManager_AcceptsValidCertificate(t *testing.T) {
	// Use existing certtest helper for valid CA
	validCA := certtest.BuildTestCertificate(t, "valid-ca")
	tmpFile := writeTempCertFile(t, validCA)

	cm, err := NewCredentialManager([]string{tmpFile})
	require.NoError(t, err)
	defer cm.Close()

	require.True(t, cm.HasCustomCAs())
}

func TestCredentialManager_AcceptsValidCertificateAfterRotation(t *testing.T) {
	// Start with valid cert
	initialCA := certtest.BuildTestCertificate(t, "initial-ca")
	tmpFile := writeTempCertFile(t, initialCA)

	cm, err := NewCredentialManager([]string{tmpFile})
	require.NoError(t, err)
	defer cm.Close()

	require.True(t, cm.HasCustomCAs())

	// Rotate to another valid certificate
	rotatedCA := certtest.BuildTestCertificate(t, "rotated-ca")
	require.NoError(t, os.WriteFile(tmpFile, rotatedCA, 0600))

	// Sync the file to ensure write is flushed to disk before checking
	file, err := os.OpenFile(tmpFile, os.O_RDONLY, 0o600)
	require.NoError(t, err)
	require.NoError(t, file.Sync())
	file.Close()

	// Wait for rotation detection - verify the rotated cert is in the pool
	// Using a longer timeout for CI environments where filesystem events may be delayed
	rotatedCert := certtest.ParseCertPEM(t, rotatedCA)
	require.Eventually(t, func() bool {
		pool := cm.GetCertPool()
		return certtest.CertPoolContainsCert(pool, rotatedCert)
	}, 5*time.Second, 50*time.Millisecond)
}

func TestCredentialManager_RecoverFromInvalidCertAfterRotation(t *testing.T) {
	// Start with expired cert - custom CAs should not be loaded
	expiredCA := certtest.MustGenCAWithValidity(t, "expired-ca",
		time.Now().Add(-48*time.Hour),
		time.Now().Add(-24*time.Hour),
	)
	tmpFile := writeTempCertFile(t, expiredCA)

	cm, err := NewCredentialManager([]string{tmpFile})
	require.NoError(t, err)
	defer cm.Close()

	// Starting with invalid cert - no custom CAs loaded
	require.False(t, cm.HasCustomCAs())

	// Rotate to valid certificate
	validCA := certtest.BuildTestCertificate(t, "valid-ca")
	require.NoError(t, os.WriteFile(tmpFile, validCA, 0600))

	// Sync the file to ensure write is flushed to disk before checking
	file, err := os.OpenFile(tmpFile, os.O_RDONLY, 0o600)
	require.NoError(t, err)
	require.NoError(t, file.Sync())
	file.Close()

	// Wait for rotation detection - should recover and have custom CAs now
	// Using a longer timeout for CI environments where filesystem events may be delayed
	require.Eventually(t, func() bool {
		return cm.HasCustomCAs()
	}, 5*time.Second, 50*time.Millisecond)
}
