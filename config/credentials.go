package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/kiali/kiali/log"
)

// ReadCredential reads a credential from file if it's a path, otherwise returns the value directly.
// This enables automatic credential rotation without pod restart when credentials are mounted as secrets.
//
// File Path Detection Heuristic:
//   - Values starting with "/" are treated as absolute file paths and will be read from disk
//   - All other values (including relative paths) are returned as literal credential values
//   - This design ensures backward compatibility with existing configurations that use literal credentials
//
// Auto-Rotation Behavior:
//   - When Kubernetes updates a mounted secret, the file content changes on disk (via atomic symlink swap)
//   - This function reads the file content on each call, automatically picking up rotated credentials
//   - No pod restart is required - new credentials are used on the next read
//
// Usage Examples:
//   - File path:   ReadCredential("/kiali-override-secrets/prometheus-token/value.txt")
//     → reads and returns the file content (supports auto-rotation)
//   - Literal:     ReadCredential("my-static-token-value")
//     → returns "my-static-token-value" as-is (no rotation)
//   - Relative:    ReadCredential("relative/path")
//     → returns "relative/path" as-is (treated as literal, not a file path)
//
// Error Handling:
//   - Returns error if file path is provided but file cannot be read
//   - File content is trimmed of leading/trailing whitespace (common when using echo/kubectl to create secrets)
func ReadCredential(value string) (string, error) {
	if value == "" {
		return "", nil
	}

	// If it looks like an absolute file path, read from file
	if strings.HasPrefix(value, "/") {
		content, err := os.ReadFile(value)
		if err != nil {
			return "", fmt.Errorf("failed to read credential from [%s]: %w", value, err)
		}
		result := strings.TrimSpace(string(content))
		log.Tracef("Credential loaded from file [%s]", value)
		return result, nil
	}

	// Otherwise return the literal value (backward compatibility)
	return value, nil
}

// GetToken returns the token value, reading from file if a.Token is a file path.
// Supports automatic credential rotation - reads file content on each call.
func (a *Auth) GetToken() (string, error) {
	return ReadCredential(a.Token)
}

// GetPassword returns the password value, reading from file if a.Password is a file path.
// Supports automatic credential rotation - reads file content on each call.
func (a *Auth) GetPassword() (string, error) {
	return ReadCredential(a.Password)
}

// GetUsername returns the username value, reading from file if a.Username is a file path.
// Supports automatic credential rotation - reads file content on each call.
func (a *Auth) GetUsername() (string, error) {
	return ReadCredential(a.Username)
}
