package offline

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestNewOfflineClient(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "offline-client-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	testYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: test-namespace-1
---
apiVersion: v1
kind: Namespace
metadata:
  name: test-namespace-2
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-configmap
  namespace: test-namespace-1
data:
  key1: value1
  key2: value2
`

	testFile := filepath.Join(tempDir, "test.yaml")
	if err := os.WriteFile(testFile, []byte(testYAML), 0o644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	singleDocYAML := `apiVersion: v1
kind: Secret
metadata:
  name: test-secret
  namespace: test-namespace-1
type: Opaque
data:
  username: dGVzdA== # test
  password: cGFzc3dvcmQ= # password
`

	testFile2 := filepath.Join(tempDir, "secret.yml")
	if err := os.WriteFile(testFile2, []byte(singleDocYAML), 0o644); err != nil {
		t.Fatalf("Failed to write test file 2: %v", err)
	}

	offlineClient, err := NewOfflineClient(tempDir)
	if err != nil {
		t.Fatalf("NewOfflineClient failed: %v", err)
	}

	ctx := context.Background()

	namespaces, err := offlineClient.Kube().CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list namespaces: %v", err)
	}

	if len(namespaces.Items) != 2 {
		t.Errorf("Expected 2 namespaces, got %d", len(namespaces.Items))
	}

	namespaceNames := make(map[string]bool)
	for _, ns := range namespaces.Items {
		namespaceNames[ns.Name] = true
	}

	if !namespaceNames["test-namespace-1"] || !namespaceNames["test-namespace-2"] {
		t.Errorf("Expected namespaces test-namespace-1 and test-namespace-2, got %v", namespaceNames)
	}

	configMap, err := offlineClient.Kube().CoreV1().ConfigMaps("test-namespace-1").Get(ctx, "test-configmap", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Failed to get configmap: %v", err)
	}

	if configMap.Data["key1"] != "value1" {
		t.Errorf("Expected configmap key1=value1, got %s", configMap.Data["key1"])
	}

	secret, err := offlineClient.Kube().CoreV1().Secrets("test-namespace-1").Get(ctx, "test-secret", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Failed to get secret: %v", err)
	}

	if string(secret.Data["username"]) != "test" {
		t.Errorf("Expected secret username=test, got %s", string(secret.Data["username"]))
	}
}

func TestNewOfflineClient_EmptyDirectory(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "offline-client-empty-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	offlineClient, err := NewOfflineClient(tempDir)
	if err != nil {
		t.Fatalf("NewOfflineClient failed: %v", err)
	}

	ctx := context.Background()

	namespaces, err := offlineClient.Kube().CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list namespaces: %v", err)
	}

	if len(namespaces.Items) != 0 {
		t.Errorf("Expected 0 namespaces, got %d", len(namespaces.Items))
	}
}

func TestNewOfflineClient_InvalidYAML(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "offline-client-invalid-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	invalidYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: test-namespace
  invalid: yaml: structure: here:
    - this is not valid
      because: indentation is wrong
`

	testFile := filepath.Join(tempDir, "invalid.yaml")
	if err := os.WriteFile(testFile, []byte(invalidYAML), 0o644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	_, err = NewOfflineClient(tempDir)
	if err == nil {
		t.Fatalf("Expected NewOfflineClient to fail with invalid YAML, but it succeeded")
	}
}

func TestNewOfflineClient_Subdirectories(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "offline-client-subdir-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	subDir1 := filepath.Join(tempDir, "subdir1")
	subDir2 := filepath.Join(tempDir, "subdir2", "nested")
	if err := os.MkdirAll(subDir1, 0o755); err != nil {
		t.Fatalf("Failed to create subdir1: %v", err)
	}
	if err := os.MkdirAll(subDir2, 0o755); err != nil {
		t.Fatalf("Failed to create subdir2/nested: %v", err)
	}

	rootYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: root-namespace
`
	if err := os.WriteFile(filepath.Join(tempDir, "root.yaml"), []byte(rootYAML), 0o644); err != nil {
		t.Fatalf("Failed to write root YAML: %v", err)
	}

	subdir1YAML := `apiVersion: v1
kind: ConfigMap
metadata:
  name: subdir1-config
  namespace: root-namespace
data:
  config: value1
`
	if err := os.WriteFile(filepath.Join(subDir1, "config.yaml"), []byte(subdir1YAML), 0o644); err != nil {
		t.Fatalf("Failed to write subdir1 YAML: %v", err)
	}

	nestedYAML := `apiVersion: v1
kind: Secret
metadata:
  name: nested-secret
  namespace: root-namespace
type: Opaque
data:
  password: bmVzdGVkCg== # nested
`
	if err := os.WriteFile(filepath.Join(subDir2, "secret.yml"), []byte(nestedYAML), 0o644); err != nil {
		t.Fatalf("Failed to write nested YAML: %v", err)
	}

	if err := os.WriteFile(filepath.Join(subDir1, "ignore.txt"), []byte("this should be ignored"), 0o644); err != nil {
		t.Fatalf("Failed to write ignore file: %v", err)
	}

	offlineClient, err := NewOfflineClient(tempDir)
	if err != nil {
		t.Fatalf("NewOfflineClient failed: %v", err)
	}

	ctx := context.Background()

	namespace, err := offlineClient.Kube().CoreV1().Namespaces().Get(ctx, "root-namespace", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Failed to get root namespace: %v", err)
	}
	if namespace.Name != "root-namespace" {
		t.Errorf("Expected namespace name root-namespace, got %s", namespace.Name)
	}

	configMap, err := offlineClient.Kube().CoreV1().ConfigMaps("root-namespace").Get(ctx, "subdir1-config", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Failed to get configmap from subdir1: %v", err)
	}

	if configMap.Data["config"] != "value1" {
		t.Errorf("Expected configmap config=value1, got %s", configMap.Data["config"])
	}

	secret, err := offlineClient.Kube().CoreV1().Secrets("root-namespace").Get(ctx, "nested-secret", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("Failed to get secret from nested subdir: %v", err)
	}

	if string(secret.Data["password"]) != "nested\n" {
		t.Errorf("Expected secret password=nested\\n, got %s", string(secret.Data["password"]))
	}

	namespaces, err := offlineClient.Kube().CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list namespaces: %v", err)
	}

	configMaps, err := offlineClient.Kube().CoreV1().ConfigMaps("root-namespace").List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list configmaps: %v", err)
	}

	secrets, err := offlineClient.Kube().CoreV1().Secrets("root-namespace").List(ctx, metav1.ListOptions{})
	if err != nil {
		t.Fatalf("Failed to list secrets: %v", err)
	}

	totalObjects := len(namespaces.Items) + len(configMaps.Items) + len(secrets.Items)
	if totalObjects != 3 {
		t.Errorf("Expected 3 total objects (1 namespace + 1 configmap + 1 secret), got %d", totalObjects)
	}
}
