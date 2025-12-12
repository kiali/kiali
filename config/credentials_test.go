package config

import (
	"crypto/x509"
	_ "embed"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/util/certtest"
	"github.com/kiali/kiali/util/filetest"
	"github.com/kiali/kiali/util/polltest"
)

//go:embed testdata/test-ca.pem
var testCA []byte

func TestCredentialManager_LiteralValue(t *testing.T) {
	cm, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(cm.Close)

	// Test that literal values are returned as-is
	result, err := cm.Get("my-literal-token")
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "my-literal-token" {
		t.Errorf("Expected 'my-literal-token', got: %s", result)
	}
}

func TestCredentialManager_EmptyValue(t *testing.T) {
	cm, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(cm.Close)

	// Test that empty values return empty string
	result, err := cm.Get("")
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "" {
		t.Errorf("Expected empty string, got: %s", result)
	}
}

func TestCredentialManager_NonExistentFile(t *testing.T) {
	cm, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(cm.Close)

	// Test that non-existent file paths return error
	_, err = cm.Get("/non/existent/file")
	if err == nil {
		t.Error("Expected error for non-existent file, got nil")
	}
}

func TestCredentialManager_EmptyFile(t *testing.T) {
	cm, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(cm.Close)

	// Test that empty files return empty string (not error)
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "empty-credential")

	err = os.WriteFile(tmpFile, []byte(""), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	result, err := cm.Get(tmpFile)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "" {
		t.Errorf("Expected empty string, got [%s]", result)
	}
}

func TestCredentialManager_WhitespaceOnlyFile(t *testing.T) {
	cm, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(cm.Close)

	// Test that whitespace-only files return empty string after trimming
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "whitespace-credential")

	err = os.WriteFile(tmpFile, []byte("   \n\t  \n"), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	result, err := cm.Get(tmpFile)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "" {
		t.Errorf("Expected empty string after trim, got [%s]", result)
	}
}

func TestCredentialManager_RelativePathTreatedAsLiteral(t *testing.T) {
	cm, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(cm.Close)

	// Test that relative paths (not starting with /) are treated as literal values
	// This ensures we don't accidentally try to read from relative paths
	result, err := cm.Get("relative/path/to/file")
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "relative/path/to/file" {
		t.Errorf("Expected 'relative/path/to/file' (literal), got [%s]", result)
	}
}

func TestCredentialManager_FileWithTrailingWhitespace(t *testing.T) {
	cm, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(cm.Close)

	// Test that files with trailing whitespace/newlines are properly trimmed
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "credential-with-whitespace")
	content := "my-token-value  \n\n\t"

	err = os.WriteFile(tmpFile, []byte(content), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	result, err := cm.Get(tmpFile)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "my-token-value" {
		t.Errorf("Expected 'my-token-value' (trimmed), got [%s]", result)
	}
}

func TestCredentialManager_CachingBehavior(t *testing.T) {
	cm, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(cm.Close)

	// Test that credential is cached and reused on subsequent calls
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "cached-credential")
	initialContent := "initial-token"

	err = os.WriteFile(tmpFile, []byte(initialContent), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	// First read - should load from file and cache
	result1, err := cm.Get(tmpFile)
	if err != nil {
		t.Errorf("Expected no error on first read, got: %v", err)
	}
	if result1 != "initial-token" {
		t.Errorf("Expected 'initial-token' on first read, got [%s]", result1)
	}

	// Second read - should return cached value immediately
	result2, err := cm.Get(tmpFile)
	if err != nil {
		t.Errorf("Expected no error on second read, got: %v", err)
	}
	if result2 != "initial-token" {
		t.Errorf("Expected 'initial-token' on second read (from cache), got [%s]", result2)
	}

	// Verify both results are identical (proving cache works)
	if result1 != result2 {
		t.Errorf("Expected cached result to match initial result")
	}

	// Now test that fsnotify updates the cache when file changes
	updatedContent := "rotated-token"
	err = os.WriteFile(tmpFile, []byte(updatedContent), 0600)
	if err != nil {
		t.Fatalf("Failed to update temp file: %v", err)
	}

	// Wait for fsnotify to detect the change and update the cache
	// In real Kubernetes environments, this happens almost instantly
	// We'll poll for up to 2 seconds to account for different system speeds
	var result3 string
	cacheUpdated := polltest.PollForCondition(t, 2*time.Second, func() bool {
		result3, err = cm.Get(tmpFile)
		if err != nil {
			t.Errorf("Expected no error after file update, got: %v", err)
			return false
		}
		return result3 == "rotated-token"
	})

	if !cacheUpdated {
		t.Errorf("Expected fsnotify to update cache to 'rotated-token', still got: %s", result3)
	}
}

func TestCredentialManager_Reinitialize(t *testing.T) {
	// Test that cache can be re-initialized after closing
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "reinit-test")

	// First manager
	err := os.WriteFile(tmpFile, []byte("token1"), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	cm1, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create first CredentialManager: %v", err)
	}

	result1, err := cm1.Get(tmpFile)
	if err != nil {
		t.Fatalf("First read failed: %v", err)
	}
	if result1 != "token1" {
		t.Errorf("Expected 'token1', got: %s", result1)
	}

	// Close the first manager
	cm1.Close()

	// Update the file
	err = os.WriteFile(tmpFile, []byte("token2"), 0600)
	if err != nil {
		t.Fatalf("Failed to update temp file: %v", err)
	}

	// Create new manager - should get the new value
	cm2, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create second CredentialManager: %v", err)
	}
	t.Cleanup(cm2.Close)

	result2, err := cm2.Get(tmpFile)
	if err != nil {
		t.Fatalf("Second read after close failed: %v", err)
	}
	if result2 != "token2" {
		t.Errorf("Expected 'token2' after re-initialization, got: %s", result2)
	}
}

func TestCredentialManager_SymlinkRotation(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink semantics differ on Windows")
	}

	cm, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(cm.Close)

	tmpDir := t.TempDir()
	secretDir := filepath.Join(tmpDir, "secret")
	dataDir1 := filepath.Join(tmpDir, "data1")
	dataDir2 := filepath.Join(tmpDir, "data2")

	if err := os.MkdirAll(secretDir, 0o700); err != nil {
		t.Fatalf("failed to create secret dir: %v", err)
	}
	if err := os.MkdirAll(dataDir1, 0o700); err != nil {
		t.Fatalf("failed to create data dir: %v", err)
	}

	// Write the initial secret content in the first data directory.
	token1 := filepath.Join(dataDir1, "token")
	if err := os.WriteFile(token1, []byte("first"), 0o600); err != nil {
		t.Fatalf("failed to write first token: %v", err)
	}

	// Simulate the Kubernetes volume layout:
	//   secretDir/token -> ..data/token
	//   secretDir/..data -> dataDir1 (timestamped dir in real Kubernetes)
	dataLink := filepath.Join(secretDir, "..data")
	if err := os.Symlink(dataDir1, dataLink); err != nil {
		t.Fatalf("failed to create ..data symlink: %v", err)
	}

	mountedToken := filepath.Join(secretDir, "token")
	if err := os.Symlink(filepath.Join("..data", "token"), mountedToken); err != nil {
		t.Fatalf("failed to symlink token: %v", err)
	}

	val, err := cm.Get(mountedToken)
	if err != nil {
		t.Fatalf("initial read failed: %v", err)
	}
	if val != "first" {
		t.Fatalf("expected first token, got [%s]", val)
	}

	// Prepare rotated secret content similar to Kubernetes atomic symlink swap.
	if err := os.MkdirAll(dataDir2, 0o700); err != nil {
		t.Fatalf("failed to create rotation dir: %v", err)
	}
	token2 := filepath.Join(dataDir2, "token")
	if err := os.WriteFile(token2, []byte("second"), 0o600); err != nil {
		t.Fatalf("failed to write rotated token: %v", err)
	}

	// Rotate by flipping ..data to point to the new data directory (Kubernetes behavior).
	newDataLink := filepath.Join(secretDir, ".tmp-data")
	if err := os.Symlink(dataDir2, newDataLink); err != nil {
		t.Fatalf("failed to create temporary ..data symlink: %v", err)
	}
	if err := os.Rename(newDataLink, dataLink); err != nil {
		t.Fatalf("failed to swap ..data symlink: %v", err)
	}

	// Poll until cache returns rotated value.
	var rotated string
	success := polltest.PollForCondition(t, 2*time.Second, func() bool {
		rotated, err = cm.Get(mountedToken)
		return err == nil && rotated == "second"
	})

	if !success {
		t.Fatalf("expected rotated token 'second', got [%q]. err: %v", rotated, err)
	}
}

func TestCredentialManager_RemovesCacheOnDelete(t *testing.T) {
	cm, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(cm.Close)

	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "credential")
	if err := os.WriteFile(tmpFile, []byte("value"), 0o600); err != nil {
		t.Fatalf("failed to write credential: %v", err)
	}

	if _, err := cm.Get(tmpFile); err != nil {
		t.Fatalf("initial read failed: %v", err)
	}

	if err := os.Remove(tmpFile); err != nil {
		t.Fatalf("failed to remove credential: %v", err)
	}

	var readErr error
	// Poll with shorter interval (25ms) since we're waiting for error, not success
	success := polltest.PollForCondition(t, 1*time.Second, func() bool {
		_, readErr = cm.Get(tmpFile)
		return readErr != nil
	})

	if !success || readErr == nil {
		t.Fatal("expected error reading removed credential but got nil")
	}
}

func TestConfig_GetCredential_WithCredentialManager(t *testing.T) {
	// Test Config.GetCredential when CredentialManager is initialized
	conf := NewConfig()
	var err error
	conf.Credentials, err = NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(conf.Credentials.Close)

	// Create a temp file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "test-token")
	if err := os.WriteFile(tmpFile, []byte("file-token-value\n"), 0600); err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	// Test literal value
	result, err := conf.GetCredential("literal-value")
	if err != nil {
		t.Errorf("Expected no error for literal, got: %v", err)
	}
	if result != "literal-value" {
		t.Errorf("Expected 'literal-value', got [%s]", result)
	}

	// Test file path
	result, err = conf.GetCredential(tmpFile)
	if err != nil {
		t.Errorf("Expected no error for file path, got: %v", err)
	}
	if result != "file-token-value" {
		t.Errorf("Expected 'file-token-value', got [%s]", result)
	}
}

func TestConfig_GetCredential_WithoutCredentialManager(t *testing.T) {
	// Test Config.GetCredential when CredentialManager is nil (fallback behavior)
	conf := NewConfig()
	// Explicitly don't initialize conf.Credentials

	// Create a temp file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "test-token")
	if err := os.WriteFile(tmpFile, []byte("file-token-value\n"), 0600); err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	// Test literal value
	result, err := conf.GetCredential("literal-value")
	if err != nil {
		t.Errorf("Expected no error for literal, got: %v", err)
	}
	if result != "literal-value" {
		t.Errorf("Expected 'literal-value', got [%s]", result)
	}

	// Test file path (should work via fallback, just without caching)
	result, err = conf.GetCredential(tmpFile)
	if err != nil {
		t.Errorf("Expected no error for file path, got: %v", err)
	}
	if result != "file-token-value" {
		t.Errorf("Expected 'file-token-value', got [%s]", result)
	}
}

func TestConfig_Close(t *testing.T) {
	conf := NewConfig()
	var err error
	conf.Credentials, err = NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}

	// Closing should not panic and should set Credentials to nil
	conf.Close()
	if conf.Credentials != nil {
		t.Error("Expected Credentials to be nil after Close()")
	}

	// Closing again should be safe (no panic)
	conf.Close()
}

func TestMultipleCredentialManagers(t *testing.T) {
	// Test that multiple CredentialManagers can coexist (important for testing)
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "shared-credential")
	if err := os.WriteFile(tmpFile, []byte("shared-value"), 0600); err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	cm1, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create first CredentialManager: %v", err)
	}
	t.Cleanup(cm1.Close)

	cm2, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create second CredentialManager: %v", err)
	}
	t.Cleanup(cm2.Close)

	// Both should be able to read the same file
	result1, err := cm1.Get(tmpFile)
	if err != nil {
		t.Errorf("First manager read failed: %v", err)
	}
	result2, err := cm2.Get(tmpFile)
	if err != nil {
		t.Errorf("Second manager read failed: %v", err)
	}

	if result1 != "shared-value" || result2 != "shared-value" {
		t.Errorf("Expected both managers to read 'shared-value', got [%s] and [%s]", result1, result2)
	}
}

// The following tests ensure that Auth struct fields work correctly with Config.GetCredential.

func TestConfig_GetCredential_AuthToken_Literal(t *testing.T) {
	conf := NewConfig()
	conf.ExternalServices.Prometheus.Auth.Token = "literal-token"

	result, err := conf.GetCredential(conf.ExternalServices.Prometheus.Auth.Token)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "literal-token" {
		t.Errorf("Expected 'literal-token', got [%s]", result)
	}
}

func TestConfig_GetCredential_AuthToken_FilePath(t *testing.T) {
	conf := NewConfig()
	var err error
	conf.Credentials, err = NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(conf.Close)

	// Create a temporary file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "token-file")
	if err := os.WriteFile(tmpFile, []byte("file-token\n"), 0600); err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	conf.ExternalServices.Prometheus.Auth.Token = tmpFile
	result, err := conf.GetCredential(conf.ExternalServices.Prometheus.Auth.Token)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "file-token" {
		t.Errorf("Expected 'file-token', got [%s]", result)
	}
}

func TestConfig_GetCredential_AuthPassword_Literal(t *testing.T) {
	conf := NewConfig()
	conf.ExternalServices.Grafana.Auth.Password = "literal-password"

	result, err := conf.GetCredential(conf.ExternalServices.Grafana.Auth.Password)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "literal-password" {
		t.Errorf("Expected 'literal-password', got [%s]", result)
	}
}

func TestConfig_GetCredential_AuthPassword_FilePath(t *testing.T) {
	conf := NewConfig()
	var err error
	conf.Credentials, err = NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(conf.Close)

	// Create a temporary file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "password-file")
	if err := os.WriteFile(tmpFile, []byte("file-password"), 0600); err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	conf.ExternalServices.Grafana.Auth.Password = tmpFile
	result, err := conf.GetCredential(conf.ExternalServices.Grafana.Auth.Password)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "file-password" {
		t.Errorf("Expected 'file-password', got [%s]", result)
	}
}

func TestConfig_GetCredential_AuthUsername_Literal(t *testing.T) {
	conf := NewConfig()
	conf.ExternalServices.Grafana.Auth.Username = "literal-user"

	result, err := conf.GetCredential(conf.ExternalServices.Grafana.Auth.Username)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "literal-user" {
		t.Errorf("Expected 'literal-user', got [%s]", result)
	}
}

func TestConfig_GetCredential_AuthUsername_FilePath(t *testing.T) {
	conf := NewConfig()
	var err error
	conf.Credentials, err = NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(conf.Close)

	// Create a temporary file with trailing whitespace (common scenario)
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "username-file")
	if err := os.WriteFile(tmpFile, []byte("file-user  \n"), 0600); err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	conf.ExternalServices.Grafana.Auth.Username = tmpFile
	result, err := conf.GetCredential(conf.ExternalServices.Grafana.Auth.Username)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "file-user" {
		t.Errorf("Expected 'file-user' (trimmed), got [%s]", result)
	}
}

func TestConfig_GetCredential_AuthToken_Empty(t *testing.T) {
	conf := NewConfig()
	conf.ExternalServices.Prometheus.Auth.Token = ""

	result, err := conf.GetCredential(conf.ExternalServices.Prometheus.Auth.Token)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "" {
		t.Errorf("Expected empty string, got [%s]", result)
	}
}

// TestCredentialManager_InitializeCertPool tests various scenarios for InitializeCertPool,
// including valid CAs, non-existent files, invalid CA content, and loading the same CA multiple times.
func TestCredentialManager_InitializeCertPool(t *testing.T) {
	systemPool, err := x509.SystemCertPool()
	require.NoError(t, err)

	additionalCAPool := systemPool.Clone()
	require.True(t, additionalCAPool.AppendCertsFromPEM(testCA), "unable to add testCA to system pool")

	invalidCA := filetest.TempFile(t, []byte("notarealCA")).Name()

	cases := map[string]struct {
		additionalBundles []string
		expected          *x509.CertPool
		expectedErr       bool
	}{
		"No additional CAs loads system pool": {
			expected: systemPool.Clone(),
		},
		"Additional CAs loads system pool plus custom CA": {
			additionalBundles: []string{"testdata/test-ca.pem"},
			expected:          additionalCAPool,
		},
		"Non-existent CA file does not return err and still loads system pool": {
			additionalBundles: []string{"non-existent"},
			expected:          systemPool.Clone(),
		},
		"CA file with bogus contents returns err": {
			additionalBundles: []string{invalidCA},
			expected:          nil, // Pool is not set when InitializeCertPool returns error
			expectedErr:       true,
		},
		// Need to test this for OpenShift serving cert that may come from multiple places.
		"Loading the same CA multiple times": {
			additionalBundles: []string{"testdata/test-ca.pem", "testdata/test-ca.pem"},
			expected:          additionalCAPool,
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			cm, err := NewCredentialManager()
			require.NoError(err)
			t.Cleanup(cm.Close)

			err = cm.InitializeCertPool(tc.additionalBundles)
			if tc.expectedErr {
				require.Error(err)
			} else {
				require.NoError(err)
			}

			actual := cm.GetCertPool()
			if tc.expected == nil {
				require.Nil(actual)
			} else {
				require.True(tc.expected.Equal(actual))
			}
		})
	}
}

func TestCredentialManager_CertPoolReloadsOnFileChange(t *testing.T) {
	cm, err := NewCredentialManager()
	require.NoError(t, err)
	t.Cleanup(cm.Close)

	tmpDir := t.TempDir()
	caFile := filepath.Join(tmpDir, "ca.pem")

	initialCA := certtest.BuildTestCertificate(t, "initial-ca")
	require.NoError(t, os.WriteFile(caFile, initialCA, 0o600))

	err = cm.InitializeCertPool([]string{caFile})
	require.NoError(t, err)

	// Rotate CA
	rotatedCA := certtest.BuildTestCertificate(t, "rotated-ca")
	require.NoError(t, os.WriteFile(caFile, rotatedCA, 0o600))

	// Wait for fsnotify event and pool rebuild
	rotatedSubject := certtest.SubjectFromPEM(t, rotatedCA)
	require.Eventually(t, func() bool {
		pool := cm.GetCertPool()
		return certtest.CertPoolHasSubject(pool, rotatedSubject)
	}, time.Second, 10*time.Millisecond, "pool should contain rotated CA")
}

func TestCredentialManager_GetCertPoolBeforeInit(t *testing.T) {
	cm, err := NewCredentialManager()
	require.NoError(t, err)
	t.Cleanup(cm.Close)

	// GetCertPool before InitializeCertPool should return nil
	pool := cm.GetCertPool()
	require.Nil(t, pool)
}

// TestCredentialManager_CertPoolGlobalConfig tests that when using the global config singleton
// (via Get()/Set()), the rotated CA bundle is observed by all callers. This ensures the
// CredentialManager's cert pool rotation works correctly when accessed through the global config.
func TestCredentialManager_CertPoolGlobalConfig(t *testing.T) {
	t.Cleanup(func() {
		Set(NewConfig())
	})

	conf := NewConfig()
	credentialManager, err := NewCredentialManager()
	require.NoError(t, err)
	conf.Credentials = credentialManager

	caFile := filetest.TempFile(t, testCA)

	require.NoError(t, conf.Credentials.InitializeCertPool([]string{caFile.Name()}))

	Set(conf)

	rotatedCA := certtest.BuildTestCertificate(t, "rotated-global")
	require.NoError(t, os.WriteFile(caFile.Name(), rotatedCA, 0o600))
	rotatedSubject := certtest.SubjectFromPEM(t, rotatedCA)

	require.Eventually(t, func() bool {
		pool := Get().CertPool()
		return certtest.CertPoolHasSubject(pool, rotatedSubject)
	}, time.Second, 10*time.Millisecond, "global config never observed rotated CA bundle")

	pool := Get().CertPool()
	require.True(t, certtest.CertPoolHasSubject(pool, rotatedSubject), "all callers should observe the rotated CA bundle")
}

// TestCredentialManager_CertPoolSymlinkRotation tests that the certificate pool is correctly
// rebuilt when a CA bundle is rotated using the Kubernetes ..data symlink swap mechanism.
//
// This is different from TestCredentialManager_CertPoolReloadsOnFileChange, which tests
// direct file writes (os.WriteFile). In real Kubernetes environments, secret rotation happens
// via atomic symlink swap: Kubernetes creates a new timestamped directory with updated content,
// then atomically swaps the ..data symlink to point to it. This test verifies that the
// credential manager correctly detects the ..data change and rebuilds the certificate pool.
func TestCredentialManager_CertPoolSymlinkRotation(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink semantics differ on Windows")
	}

	cm, err := NewCredentialManager()
	require.NoError(t, err)
	t.Cleanup(cm.Close)

	tmpDir := t.TempDir()
	secretDir := filepath.Join(tmpDir, "ca-secret")
	dataDir1 := filepath.Join(tmpDir, "data1")
	dataDir2 := filepath.Join(tmpDir, "data2")

	require.NoError(t, os.MkdirAll(secretDir, 0o700))
	require.NoError(t, os.MkdirAll(dataDir1, 0o700))

	// Create initial CA certificate in first data directory
	initialCA := certtest.BuildTestCertificate(t, "initial-ca")
	caFile1 := filepath.Join(dataDir1, "ca.pem")
	require.NoError(t, os.WriteFile(caFile1, initialCA, 0o600))

	// Simulate Kubernetes volume layout:
	//   secretDir/ca.pem -> ..data/ca.pem
	//   secretDir/..data -> dataDir1
	dataLink := filepath.Join(secretDir, "..data")
	require.NoError(t, os.Symlink(dataDir1, dataLink))

	mountedCA := filepath.Join(secretDir, "ca.pem")
	require.NoError(t, os.Symlink(filepath.Join("..data", "ca.pem"), mountedCA))

	// Initialize cert pool with the mounted CA path
	err = cm.InitializeCertPool([]string{mountedCA})
	require.NoError(t, err)

	// Verify initial CA is in the pool
	initialSubject := certtest.SubjectFromPEM(t, initialCA)
	pool := cm.GetCertPool()
	require.True(t, certtest.CertPoolHasSubject(pool, initialSubject), "pool should contain initial CA")

	// Prepare rotated CA in second data directory
	require.NoError(t, os.MkdirAll(dataDir2, 0o700))
	rotatedCA := certtest.BuildTestCertificate(t, "rotated-ca")
	caFile2 := filepath.Join(dataDir2, "ca.pem")
	require.NoError(t, os.WriteFile(caFile2, rotatedCA, 0o600))

	// Rotate by atomically swapping ..data symlink (Kubernetes behavior)
	newDataLink := filepath.Join(secretDir, ".tmp-data")
	require.NoError(t, os.Symlink(dataDir2, newDataLink))
	require.NoError(t, os.Rename(newDataLink, dataLink))

	// Wait for fsnotify to detect ..data change and rebuild cert pool
	rotatedSubject := certtest.SubjectFromPEM(t, rotatedCA)
	require.Eventually(t, func() bool {
		pool := cm.GetCertPool()
		return certtest.CertPoolHasSubject(pool, rotatedSubject)
	}, 2*time.Second, 50*time.Millisecond, "pool should contain rotated CA after symlink swap")
}

// TestCredentialManager_ConcurrentAccess tests thread safety of the CredentialManager
// under concurrent access from multiple goroutines. It verifies that:
//  1. Concurrent reads return correct values without data corruption
//  2. Cache is properly populated after concurrent access
//  3. Concurrent reads during file updates see consistent (old or new) values
//
// For stronger race detection, run with: CGO_ENABLED=1 go test -race -run TestCredentialManager_ConcurrentAccess
// (requires GCC installed for CGO support)
func TestCredentialManager_ConcurrentAccess(t *testing.T) {
	cm, err := NewCredentialManager()
	require.NoError(t, err)
	t.Cleanup(cm.Close)

	tmpDir := t.TempDir()

	// Create multiple credential files
	numFiles := 5
	files := make([]string, numFiles)
	for i := 0; i < numFiles; i++ {
		files[i] = filepath.Join(tmpDir, fmt.Sprintf("credential-%d", i))
		content := fmt.Sprintf("token-%d", i)
		require.NoError(t, os.WriteFile(files[i], []byte(content), 0o600))
	}

	// Phase 1: Concurrent reads - multiple goroutines reading same files simultaneously
	// This tests the check-then-act pattern in getFromCache() where multiple goroutines
	// might see a cache miss and try to populate the cache concurrently.
	numGoroutines := 20
	numReadsPerGoroutine := 50
	// Channel capacity must handle worst case: each goroutine sends up to (numFiles + 1 literal) errors per iteration
	errChan := make(chan error, numGoroutines*numReadsPerGoroutine*(numFiles+1))
	var wg sync.WaitGroup

	for g := 0; g < numGoroutines; g++ {
		wg.Add(1)
		go func(goroutineID int) {
			defer wg.Done()
			for r := 0; r < numReadsPerGoroutine; r++ {
				// Each goroutine reads from all files
				for i, file := range files {
					expected := fmt.Sprintf("token-%d", i)
					result, err := cm.Get(file)
					if err != nil {
						errChan <- fmt.Errorf("goroutine %d, read %d, file %d: %w", goroutineID, r, i, err)
						continue
					}
					if result != expected {
						errChan <- fmt.Errorf("goroutine %d, read %d, file %d: expected %q, got %q", goroutineID, r, i, expected, result)
					}
				}
				// Also test literal values concurrently (these bypass the cache)
				literal := fmt.Sprintf("literal-%d-%d", goroutineID, r)
				result, err := cm.Get(literal)
				if err != nil {
					errChan <- fmt.Errorf("goroutine %d, literal read %d: %w", goroutineID, r, err)
					continue
				}
				if result != literal {
					errChan <- fmt.Errorf("goroutine %d, literal read %d: expected %q, got %q", goroutineID, r, literal, result)
				}
			}
		}(g)
	}

	wg.Wait()
	close(errChan)

	// Check for any errors from concurrent reads
	var errors []error
	for err := range errChan {
		errors = append(errors, err)
	}
	require.Empty(t, errors, "concurrent reads produced errors: %v", errors)

	// Phase 2: Verify caching behavior - all files should now be cached
	// After concurrent access, verify files are in the cache by checking that
	// subsequent reads return the same values (this also implicitly tests that
	// the cache wasn't corrupted by concurrent writes).
	for i, file := range files {
		expected := fmt.Sprintf("token-%d", i)
		result, err := cm.Get(file)
		require.NoError(t, err, "post-concurrent read failed for file %d", i)
		require.Equal(t, expected, result, "cached value incorrect for file %d", i)
	}

	// Phase 3: Concurrent reads during file updates
	// This tests the interaction between the watcher goroutine updating the cache
	// and reader goroutines accessing the cache simultaneously.
	numReadsPhase3 := 10
	// Channel capacity must handle worst case: each goroutine sends up to numFiles errors per iteration
	errChan2 := make(chan error, numGoroutines*numReadsPhase3*numFiles)
	var wg2 sync.WaitGroup

	// Start readers
	for g := 0; g < numGoroutines; g++ {
		wg2.Add(1)
		go func(goroutineID int) {
			defer wg2.Done()
			for r := 0; r < numReadsPhase3; r++ {
				for i, file := range files {
					result, err := cm.Get(file)
					if err != nil {
						errChan2 <- fmt.Errorf("concurrent read during update, goroutine %d: %w", goroutineID, err)
						continue
					}
					// Value should be either old or new, but never corrupted
					oldVal := fmt.Sprintf("token-%d", i)
					newVal := fmt.Sprintf("updated-%d", i)
					if result != oldVal && result != newVal {
						errChan2 <- fmt.Errorf("goroutine %d got corrupted value %q for file %d", goroutineID, result, i)
					}
				}
				time.Sleep(time.Millisecond) // Small delay to interleave with updates
			}
		}(g)
	}

	// Concurrently update files
	for i, file := range files {
		newContent := fmt.Sprintf("updated-%d", i)
		require.NoError(t, os.WriteFile(file, []byte(newContent), 0o600))
		time.Sleep(5 * time.Millisecond) // Stagger updates
	}

	wg2.Wait()
	close(errChan2)

	var errors2 []error
	for err := range errChan2 {
		errors2 = append(errors2, err)
	}
	require.Empty(t, errors2, "concurrent reads during updates produced errors: %v", errors2)

	// Phase 4: Verify final state - all files should have updated values
	for i, file := range files {
		expected := fmt.Sprintf("updated-%d", i)
		require.Eventually(t, func() bool {
			result, err := cm.Get(file)
			return err == nil && result == expected
		}, 2*time.Second, 50*time.Millisecond, "file %d should have updated value", i)
	}
}
