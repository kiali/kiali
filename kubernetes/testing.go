package kubernetes

import (
	"os"
	"testing"
)

// ReadFile reads a file's contents and calls t.Fatal if any error occurs.
func ReadFile(t *testing.T, path string) []byte {
	t.Helper()
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("Error while reading file: %s. Err: %s", path, err)
	}
	return contents
}
