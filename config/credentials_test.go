package config

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/util/filetest"
)

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

func TestCredentialManager_FilePath(t *testing.T) {
	cm, err := NewCredentialManager()
	if err != nil {
		t.Fatalf("Failed to create CredentialManager: %v", err)
	}
	t.Cleanup(cm.Close)

	// Create a temporary file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "test-credential")
	content := "test-token-from-file\n"

	err = os.WriteFile(tmpFile, []byte(content), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	// Test that file paths are read and trimmed
	result, err := cm.Get(tmpFile)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "test-token-from-file" {
		t.Errorf("Expected 'test-token-from-file', got: %s", result)
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
		t.Errorf("Expected empty string, got: '%s'", result)
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
		t.Errorf("Expected empty string after trim, got: '%s'", result)
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
		t.Errorf("Expected 'relative/path/to/file' (literal), got: %s", result)
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
		t.Errorf("Expected 'my-token-value' (trimmed), got: '%s'", result)
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
		t.Errorf("Expected 'initial-token' on first read, got: %s", result1)
	}

	// Second read - should return cached value immediately
	result2, err := cm.Get(tmpFile)
	if err != nil {
		t.Errorf("Expected no error on second read, got: %v", err)
	}
	if result2 != "initial-token" {
		t.Errorf("Expected 'initial-token' on second read (from cache), got: %s", result2)
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
	cacheUpdated := false
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		result3, err = cm.Get(tmpFile)
		if err != nil {
			t.Errorf("Expected no error after file update, got: %v", err)
			break
		}
		if result3 == "rotated-token" {
			cacheUpdated = true
			break
		}
	}

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
		t.Fatalf("expected first token, got %s", val)
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
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		rotated, err = cm.Get(mountedToken)
		if err != nil {
			continue
		}
		if rotated == "second" {
			break
		}
	}

	if rotated != "second" {
		t.Fatalf("expected rotated token 'second', got %q (err=%v)", rotated, err)
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
	for i := 0; i < 40; i++ {
		time.Sleep(25 * time.Millisecond)
		_, readErr = cm.Get(tmpFile)
		if readErr != nil {
			break
		}
	}

	if readErr == nil {
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
		t.Errorf("Expected 'literal-value', got: %s", result)
	}

	// Test file path
	result, err = conf.GetCredential(tmpFile)
	if err != nil {
		t.Errorf("Expected no error for file path, got: %v", err)
	}
	if result != "file-token-value" {
		t.Errorf("Expected 'file-token-value', got: %s", result)
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
		t.Errorf("Expected 'literal-value', got: %s", result)
	}

	// Test file path (should work via fallback, just without caching)
	result, err = conf.GetCredential(tmpFile)
	if err != nil {
		t.Errorf("Expected no error for file path, got: %v", err)
	}
	if result != "file-token-value" {
		t.Errorf("Expected 'file-token-value', got: %s", result)
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
		t.Errorf("Expected both managers to read 'shared-value', got: %s, %s", result1, result2)
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
		t.Errorf("Expected 'literal-token', got: %s", result)
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
		t.Errorf("Expected 'file-token', got: %s", result)
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
		t.Errorf("Expected 'literal-password', got: %s", result)
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
		t.Errorf("Expected 'file-password', got: %s", result)
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
		t.Errorf("Expected 'literal-user', got: %s", result)
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
		t.Errorf("Expected 'file-user' (trimmed), got: %s", result)
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
		t.Errorf("Expected empty string, got: %s", result)
	}
}

func TestCredentialManager_InitializeCertPool(t *testing.T) {
	cm, err := NewCredentialManager()
	require.NoError(t, err)
	t.Cleanup(cm.Close)

	caFile := filetest.TempFile(t, testCA)

	err = cm.InitializeCertPool([]string{caFile.Name()})
	require.NoError(t, err)

	pool := cm.GetCertPool()
	require.NotNil(t, pool)
}

func TestCredentialManager_CertPoolReloadsOnFileChange(t *testing.T) {
	cm, err := NewCredentialManager()
	require.NoError(t, err)
	t.Cleanup(cm.Close)

	tmpDir := t.TempDir()
	caFile := filepath.Join(tmpDir, "ca.pem")

	initialCA := buildTestCertificate(t, "initial-ca")
	require.NoError(t, os.WriteFile(caFile, initialCA, 0o600))

	err = cm.InitializeCertPool([]string{caFile})
	require.NoError(t, err)

	// Rotate CA
	rotatedCA := buildTestCertificate(t, "rotated-ca")
	require.NoError(t, os.WriteFile(caFile, rotatedCA, 0o600))

	// Wait for fsnotify event and pool rebuild
	rotatedSubject := subjectFromPEM(t, rotatedCA)
	require.Eventually(t, func() bool {
		pool := cm.GetCertPool()
		return certPoolHasSubject(pool, rotatedSubject)
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
