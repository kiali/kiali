package kubernetes

import (
	"fmt"
	"os"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"

	"github.com/kiali/kiali/config"
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

// SetConfig sets the global config for a test and restores it after the test.
func SetConfig(t *testing.T, newConfig config.Config) {
	oldConfig := config.Get()
	t.Cleanup(func() {
		config.Set(oldConfig)
	})
	config.Set(&newConfig)
}

// NewTestingClientFactory creates a client factory and a temporary token file.
// Without this token file, the client factory will try to read the token from
// the default path at /var/run/secrets/... which probably doesn't exist and
// we probably don't want to use it even if it does.
// This sets globals so it is NOT safe to use in parallel tests.
// It really should just be used for internal client factory tests
// since it has side effects with globals and local files/env vars.
// If you need a test client factory outside this package, use the mock implementation.
func NewTestingClientFactory(t *testing.T) *clientFactory {
	t.Helper()

	// Reset global vars after test
	originalToken := KialiTokenForHomeCluster
	originalPath := DefaultServiceAccountPath
	t.Cleanup(func() {
		KialiTokenForHomeCluster = originalToken
		DefaultServiceAccountPath = originalPath
	})

	DefaultServiceAccountPath = fmt.Sprintf("%s/kiali-testing-token-%s", t.TempDir(), time.Now())
	if err := os.WriteFile(DefaultServiceAccountPath, []byte("test-token"), 0o644); err != nil {
		t.Fatalf("Unable to create token file for testing. Err: %s", err)
	}

	clientConfig := rest.Config{}
	client, err := newClientFactory(config.Get(), &clientConfig)
	if err != nil {
		t.Fatalf("Error creating client factory: %v", err)
	}

	// Override global client factory for test
	factory = client

	// Reset after test is over
	t.Cleanup(func() {
		factory = nil
	})

	return client
}

func createTestRemoteClusterSecretFile(t *testing.T, parentDir string, name string, content string) string {
	childDir := fmt.Sprintf("%s/%s", parentDir, name)
	filename := fmt.Sprintf("%s/%s", childDir, name)
	if err := os.MkdirAll(childDir, 0o777); err != nil {
		t.Fatalf("Failed to create tmp remote cluster secret dir [%v]: %v", childDir, err)
	}
	f, err := os.Create(filename)
	if err != nil {
		t.Fatalf("Failed to create tmp remote cluster secret file [%v]: %v", filename, err)
	}
	defer f.Close()
	if _, err2 := f.WriteString(content); err2 != nil {
		t.Fatalf("Failed to write tmp remote cluster secret file [%v]: %v", filename, err2)
	}

	return filename
}

// Helper function to create a test remote cluster secret file from a RemoteSecret.
// It will cleanup after itself when the test is done.
func createTestRemoteClusterSecret(t *testing.T, cluster string, contents string) string {
	t.Helper()
	// create a mock volume mount directory where the test remote cluster secret content will go
	originalRemoteClusterSecretsDir := RemoteClusterSecretsDir
	t.Cleanup(func() {
		RemoteClusterSecretsDir = originalRemoteClusterSecretsDir
	})
	RemoteClusterSecretsDir = t.TempDir()

	return createTestRemoteClusterSecretFile(t, RemoteClusterSecretsDir, cluster, contents)
}

// ToRuntimeObjects takes a slice of something that implements runtime.Object
// and returns a new slice of the objects as the interface runtime.Object(s).
// Useful for testing where the fake client accepts variadic args and you first
// need to convert to a slice of the interface like:
//
// namespaces := []*corev1.Namespace{ns}
// client := FakeClient(namespaces...)
//
// This only works if you first use this function to convert the slice.
func ToRuntimeObjects[T runtime.Object](objs []T) []runtime.Object {
	var retObjs []runtime.Object
	for _, obj := range objs {
		o := obj
		retObjs = append(retObjs, o)
	}
	return retObjs
}
