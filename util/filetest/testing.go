package filetest

import (
	"io/fs"
	"os"
	"path"
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

func StaticAssetDir(t *testing.T) fs.FS {
	t.Helper()
	dir := t.TempDir()

	if err := os.MkdirAll(path.Join(dir, "./console"), 0o777); err != nil {
		t.Fatalf("Unable to make console dir: %s", err)
	}
	if _, err := os.Create(path.Join(dir, "index.html")); err != nil {
		t.Fatalf("Unable to create index.html file: %s", err)
	}

	return os.DirFS(dir)
}

func WriteFile(t *testing.T, path string, contents []byte) {
	t.Helper()

	if err := os.WriteFile(path, contents, 0o644); err != nil {
		t.Fatalf("Failed to write file %s: %v", path, err)
	}
}
