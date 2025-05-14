package filetest

import (
	"os"
	"testing"
)

func TempFile(t *testing.T, contents []byte) *os.File {
	t.Helper()

	f, err := os.CreateTemp(t.TempDir(), "")
	if err != nil {
		t.Fatalf("Unable to create temp file: %s", err)
	}

	if _, err := f.Write(contents); err != nil {
		t.Fatalf("Unable to write contents to temp file %s: %s", f.Name(), err)
	}

	t.Cleanup(func() { f.Close() })
	return f
}
