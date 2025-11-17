package config

import (
	"os"
	"path/filepath"
	"testing"
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
