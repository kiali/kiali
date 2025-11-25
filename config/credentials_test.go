package config

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestReadCredential_LiteralValue(t *testing.T) {
	// Test that literal values are returned as-is
	result, err := ReadCredential("my-literal-token")
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "my-literal-token" {
		t.Errorf("Expected 'my-literal-token', got: %s", result)
	}
}

func TestReadCredential_EmptyValue(t *testing.T) {
	// Test that empty values return empty string
	result, err := ReadCredential("")
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "" {
		t.Errorf("Expected empty string, got: %s", result)
	}
}

func TestReadCredential_FilePath(t *testing.T) {
	// Create a temporary file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "test-credential")
	content := "test-token-from-file\n"

	err := os.WriteFile(tmpFile, []byte(content), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	// Test that file paths are read and trimmed
	result, err := ReadCredential(tmpFile)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "test-token-from-file" {
		t.Errorf("Expected 'test-token-from-file', got: %s", result)
	}
}

func TestReadCredential_NonExistentFile(t *testing.T) {
	// Test that non-existent file paths return error
	_, err := ReadCredential("/non/existent/file")
	if err == nil {
		t.Error("Expected error for non-existent file, got nil")
	}
}

func TestAuth_GetToken_Literal(t *testing.T) {
	auth := Auth{Token: "literal-token"}
	result, err := auth.GetToken()
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "literal-token" {
		t.Errorf("Expected 'literal-token', got: %s", result)
	}
}

func TestAuth_GetToken_FilePath(t *testing.T) {
	// Create a temporary file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "token-file")
	err := os.WriteFile(tmpFile, []byte("file-token\n"), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	auth := Auth{Token: tmpFile}
	result, err := auth.GetToken()
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "file-token" {
		t.Errorf("Expected 'file-token', got: %s", result)
	}
}

func TestAuth_GetPassword_Literal(t *testing.T) {
	auth := Auth{Password: "literal-password"}
	result, err := auth.GetPassword()
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "literal-password" {
		t.Errorf("Expected 'literal-password', got: %s", result)
	}
}

func TestAuth_GetPassword_FilePath(t *testing.T) {
	// Create a temporary file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "password-file")
	err := os.WriteFile(tmpFile, []byte("file-password"), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	auth := Auth{Password: tmpFile}
	result, err := auth.GetPassword()
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "file-password" {
		t.Errorf("Expected 'file-password', got: %s", result)
	}
}

func TestAuth_GetUsername_Literal(t *testing.T) {
	auth := Auth{Username: "literal-user"}
	result, err := auth.GetUsername()
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "literal-user" {
		t.Errorf("Expected 'literal-user', got: %s", result)
	}
}

func TestAuth_GetUsername_FilePath(t *testing.T) {
	// Create a temporary file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "username-file")
	err := os.WriteFile(tmpFile, []byte("file-user  \n"), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	auth := Auth{Username: tmpFile}
	result, err := auth.GetUsername()
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "file-user" {
		t.Errorf("Expected 'file-user' (trimmed), got: %s", result)
	}
}

func TestAuth_GetToken_Empty(t *testing.T) {
	auth := Auth{Token: ""}
	result, err := auth.GetToken()
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "" {
		t.Errorf("Expected empty string, got: %s", result)
	}
}

func TestReadCredential_EmptyFile(t *testing.T) {
	// Test that empty files return empty string (not error)
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "empty-credential")

	err := os.WriteFile(tmpFile, []byte(""), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	result, err := ReadCredential(tmpFile)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "" {
		t.Errorf("Expected empty string, got: '%s'", result)
	}
}

func TestReadCredential_WhitespaceOnlyFile(t *testing.T) {
	// Test that whitespace-only files return empty string after trimming
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "whitespace-credential")

	err := os.WriteFile(tmpFile, []byte("   \n\t  \n"), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	result, err := ReadCredential(tmpFile)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "" {
		t.Errorf("Expected empty string after trim, got: '%s'", result)
	}
}

func TestReadCredential_RelativePathTreatedAsLiteral(t *testing.T) {
	// Test that relative paths (not starting with /) are treated as literal values
	// This ensures we don't accidentally try to read from relative paths
	result, err := ReadCredential("relative/path/to/file")
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "relative/path/to/file" {
		t.Errorf("Expected 'relative/path/to/file' (literal), got: %s", result)
	}
}

func TestReadCredential_FileWithTrailingWhitespace(t *testing.T) {
	// Test that files with trailing whitespace/newlines are properly trimmed
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "credential-with-whitespace")
	content := "my-token-value  \n\n\t"

	err := os.WriteFile(tmpFile, []byte(content), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	result, err := ReadCredential(tmpFile)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if result != "my-token-value" {
		t.Errorf("Expected 'my-token-value' (trimmed), got: '%s'", result)
	}
}

func TestReadCredential_CachingBehavior(t *testing.T) {
	t.Cleanup(CloseWatchedCredentials)
	// Test that credential is cached and reused on subsequent calls
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "cached-credential")
	initialContent := "initial-token"

	err := os.WriteFile(tmpFile, []byte(initialContent), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	// First read - should load from file and cache
	result1, err := ReadCredential(tmpFile)
	if err != nil {
		t.Errorf("Expected no error on first read, got: %v", err)
	}
	if result1 != "initial-token" {
		t.Errorf("Expected 'initial-token' on first read, got: %s", result1)
	}

	// Second read - should return cached value immediately
	result2, err := ReadCredential(tmpFile)
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
		result3, err = ReadCredential(tmpFile)
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

func TestCloseWatchedCredentials_AllowsReinitialization(t *testing.T) {
	t.Cleanup(CloseWatchedCredentials)
	// Test that cache can be re-initialized after closing
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "reinit-test")

	// First initialization
	err := os.WriteFile(tmpFile, []byte("token1"), 0600)
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	result1, err := ReadCredential(tmpFile)
	if err != nil {
		t.Fatalf("First read failed: %v", err)
	}
	if result1 != "token1" {
		t.Errorf("Expected 'token1', got: %s", result1)
	}

	// Close the cache
	CloseWatchedCredentials()

	// Update the file
	err = os.WriteFile(tmpFile, []byte("token2"), 0600)
	if err != nil {
		t.Fatalf("Failed to update temp file: %v", err)
	}

	// Read again - should re-initialize cache and get new value
	result2, err := ReadCredential(tmpFile)
	if err != nil {
		t.Fatalf("Second read after close failed: %v", err)
	}
	if result2 != "token2" {
		t.Errorf("Expected 'token2' after re-initialization, got: %s", result2)
	}

	// Verify cache is working again by reading cached value
	result3, err := ReadCredential(tmpFile)
	if err != nil {
		t.Fatalf("Third read failed: %v", err)
	}
	if result3 != "token2" {
		t.Errorf("Expected cached 'token2', got: %s", result3)
	}

	// Clean up for other tests
	CloseWatchedCredentials()
}

func TestReadCredential_SymlinkRotation(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink semantics differ on Windows")
	}
	t.Cleanup(CloseWatchedCredentials)

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

	token1 := filepath.Join(dataDir1, "token")
	if err := os.WriteFile(token1, []byte("first"), 0o600); err != nil {
		t.Fatalf("failed to write first token: %v", err)
	}

	mountedToken := filepath.Join(secretDir, "token")
	if err := os.Symlink(token1, mountedToken); err != nil {
		t.Fatalf("failed to symlink token: %v", err)
	}

	val, err := ReadCredential(mountedToken)
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

	newLink := filepath.Join(secretDir, ".tmp-token")
	if err := os.Symlink(token2, newLink); err != nil {
		t.Fatalf("failed to create temporary symlink: %v", err)
	}
	if err := os.Rename(newLink, mountedToken); err != nil {
		t.Fatalf("failed to swap symlink: %v", err)
	}

	// Poll until cache returns rotated value.
	var rotated string
	for i := 0; i < 40; i++ {
		time.Sleep(50 * time.Millisecond)
		rotated, err = ReadCredential(mountedToken)
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

func TestReadCredential_RemovesCacheOnDelete(t *testing.T) {
	t.Cleanup(CloseWatchedCredentials)

	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "credential")
	if err := os.WriteFile(tmpFile, []byte("value"), 0o600); err != nil {
		t.Fatalf("failed to write credential: %v", err)
	}

	if _, err := ReadCredential(tmpFile); err != nil {
		t.Fatalf("initial read failed: %v", err)
	}

	if err := os.Remove(tmpFile); err != nil {
		t.Fatalf("failed to remove credential: %v", err)
	}

	var readErr error
	for i := 0; i < 40; i++ {
		time.Sleep(25 * time.Millisecond)
		_, readErr = ReadCredential(tmpFile)
		if readErr != nil {
			break
		}
	}

	if readErr == nil {
		t.Fatal("expected error reading removed credential but got nil")
	}
}
