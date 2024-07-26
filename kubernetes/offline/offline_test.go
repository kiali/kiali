package offline

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"testing"

	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/util/filetest"
)

func TestNewOfflineClient(t *testing.T) {
	tempDir := t.TempDir()

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
	filetest.WriteFile(t, testFile, []byte(testYAML))

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
	filetest.WriteFile(t, testFile2, []byte(singleDocYAML))

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
	tempDir := t.TempDir()

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
	tempDir := t.TempDir()

	invalidYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: test-namespace
  invalid: yaml: structure: here:
    - this is not valid
      because: indentation is wrong
`

	testFile := filepath.Join(tempDir, "invalid.yaml")
	filetest.WriteFile(t, testFile, []byte(invalidYAML))

	_, err := NewOfflineClient(tempDir)
	if err == nil {
		t.Fatalf("Expected NewOfflineClient to fail with invalid YAML, but it succeeded")
	}
}

func TestNewOfflineClient_Subdirectories(t *testing.T) {
	tempDir := t.TempDir()

	subDir1 := filepath.Join(tempDir, "subdir1")
	subDir2 := filepath.Join(tempDir, "subdir2", "nested")
	mkdirAll(t, subDir1)
	mkdirAll(t, subDir2)

	rootYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: root-namespace
`
	filetest.WriteFile(t, filepath.Join(tempDir, "root.yaml"), []byte(rootYAML))

	subdir1YAML := `apiVersion: v1
kind: ConfigMap
metadata:
  name: subdir1-config
  namespace: root-namespace
data:
  config: value1
`
	filetest.WriteFile(t, filepath.Join(subDir1, "config.yaml"), []byte(subdir1YAML))

	nestedYAML := `apiVersion: v1
kind: Secret
metadata:
  name: nested-secret
  namespace: root-namespace
type: Opaque
data:
  password: bmVzdGVkCg== # nested
`
	filetest.WriteFile(t, filepath.Join(subDir2, "secret.yml"), []byte(nestedYAML))

	filetest.WriteFile(t, filepath.Join(subDir1, "ignore.txt"), []byte("this should be ignored"))

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

func mkdirAll(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatalf("Failed to create directory: %v", err)
	}
}

func TestGetConfigDump(t *testing.T) {
	tmpDir := t.TempDir()

	namespace := "test-namespace"
	podName := "test-pod"

	namespacesDir := filepath.Join(tmpDir, "buried", "layers", "deep", "namespaces")
	mkdirAll(t, namespacesDir)

	testYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: ` + namespace + `
`
	filetest.WriteFile(t, filepath.Join(tmpDir, "test.yaml"), []byte(testYAML))

	configDumpDir := filepath.Join(namespacesDir, namespace, "pods", podName)
	mkdirAll(t, configDumpDir)

	testConfigDump := `{
  "configs": [
    {
      "@type": "type.googleapis.com/envoy.admin.v3.ClustersConfigDump",
      "dynamic_active_clusters": [
        {
          "cluster": {
            "name": "test-cluster",
            "type": "EDS"
          }
        }
      ]
    }
  ]
}`
	configDumpFile := filepath.Join(configDumpDir, "config_dump_proxy.json")
	filetest.WriteFile(t, configDumpFile, []byte(testConfigDump))

	client, err := NewOfflineClient(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create offline client: %v", err)
	}

	configDump, err := client.GetConfigDump(namespace, podName)
	if err != nil {
		t.Fatalf("Failed to get config dump: %v", err)
	}

	if len(configDump.Configs) != 1 {
		t.Errorf("Expected 1 config in dump, got %d", len(configDump.Configs))
	}
}

func TestGetConfigDump_NotFound(t *testing.T) {
	tmpDir := t.TempDir()

	namespacesDir := filepath.Join(tmpDir, "namespaces")
	mkdirAll(t, namespacesDir)

	testYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: test-namespace
`
	filetest.WriteFile(t, filepath.Join(tmpDir, "test.yaml"), []byte(testYAML))

	client, err := NewOfflineClient(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create offline client: %v", err)
	}

	configDump, err := client.GetConfigDump("nonexistent-namespace", "nonexistent-pod")
	if err != nil {
		t.Fatalf("Failed to get config dump: %v", err)
	}

	if len(configDump.Configs) != 0 {
		t.Errorf("Expected empty config dump, got %d configs", len(configDump.Configs))
	}
}

func TestGetConfigDump_InvalidJSON(t *testing.T) {
	tmpDir := t.TempDir()

	namespace := "test-namespace"
	podName := "test-pod"

	namespacesDir := filepath.Join(tmpDir, "namespaces")
	mkdirAll(t, namespacesDir)

	testYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: ` + namespace + `
`
	filetest.WriteFile(t, filepath.Join(tmpDir, "test.yaml"), []byte(testYAML))

	configDumpDir := filepath.Join(namespacesDir, namespace, "pods", podName)
	mkdirAll(t, configDumpDir)

	invalidJSON := `{
  "configs": [
    {
      "@type": "type.googleapis.com/envoy.admin.v3.ClustersConfigDump",
      "dynamic_active_clusters": [
        // invalid comment in JSON
        {
          "cluster": {
            "name": "test-cluster"
            "type": "EDS"  // missing comma
          }
        }
      ]
    }
  ]
}`
	configDumpFile := filepath.Join(configDumpDir, "config_dump_proxy.json")
	filetest.WriteFile(t, configDumpFile, []byte(invalidJSON))

	client, err := NewOfflineClient(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create offline client: %v", err)
	}

	configDump, err := client.GetConfigDump(namespace, podName)
	if err != nil {
		t.Fatalf("Failed to get config dump: %v", err)
	}

	if len(configDump.Configs) != 0 {
		t.Errorf("Expected empty config dump due to invalid JSON, got %d configs", len(configDump.Configs))
	}
}

func TestStreamPodLogs(t *testing.T) {
	tmpDir := t.TempDir()

	namespace := "test-namespace"
	podName := "test-pod"
	containerName := "test-container"
	testLogs := "test log line 1\ntest log line 2\ntest log line 3\n"

	namespacesDir := filepath.Join(tmpDir, "namespaces")
	mkdirAll(t, namespacesDir)

	testYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: ` + namespace + `
`
	filetest.WriteFile(t, filepath.Join(tmpDir, "test.yaml"), []byte(testYAML))

	// Create log directory with must-gather structure: container/container/logs/current.log
	logDir := filepath.Join(namespacesDir, namespace, "pods", podName, containerName, containerName, "logs")
	mkdirAll(t, logDir)
	logFile := filepath.Join(logDir, "current.log")
	filetest.WriteFile(t, logFile, []byte(testLogs))

	client, err := NewOfflineClient(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create offline client: %v", err)
	}

	opts := &core_v1.PodLogOptions{Container: containerName}
	reader, err := client.StreamPodLogs(namespace, podName, opts)
	if err != nil {
		t.Fatalf("Failed to stream pod logs: %v", err)
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("Failed to read log data: %v", err)
	}

	if string(data) != testLogs {
		t.Errorf("Expected log content %q, got %q", testLogs, string(data))
	}
}

func TestStreamPodLogs_ContainerNotFound(t *testing.T) {
	tmpDir := t.TempDir()

	namespacesDir := filepath.Join(tmpDir, "namespaces")
	mkdirAll(t, namespacesDir)

	testYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: test-namespace
`
	filetest.WriteFile(t, filepath.Join(tmpDir, "test.yaml"), []byte(testYAML))

	client, err := NewOfflineClient(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create offline client: %v", err)
	}

	opts := &core_v1.PodLogOptions{Container: "nonexistent-container"}
	reader, err := client.StreamPodLogs("test-namespace", "test-pod", opts)
	if err != nil {
		t.Fatalf("Failed to stream pod logs: %v", err)
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("Failed to read log data: %v", err)
	}

	if len(data) != 0 {
		t.Errorf("Expected empty log content, got %q", string(data))
	}
}

func TestStreamPodLogs_NoContainerSpecified(t *testing.T) {
	tmpDir := t.TempDir()

	namespacesDir := filepath.Join(tmpDir, "namespaces")
	mkdirAll(t, namespacesDir)

	testYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: test-namespace
`
	filetest.WriteFile(t, filepath.Join(tmpDir, "test.yaml"), []byte(testYAML))

	client, err := NewOfflineClient(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create offline client: %v", err)
	}

	reader, err := client.StreamPodLogs("test-namespace", "test-pod", nil)
	if err != nil {
		t.Fatalf("Failed to stream pod logs: %v", err)
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("Failed to read log data: %v", err)
	}

	if len(data) != 0 {
		t.Errorf("Expected empty log content when no container specified, got %q", string(data))
	}
}

func TestStreamPodLogs_EmptyPodLogOptions(t *testing.T) {
	tmpDir := t.TempDir()

	namespacesDir := filepath.Join(tmpDir, "namespaces")
	mkdirAll(t, namespacesDir)

	testYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: test-namespace
`
	filetest.WriteFile(t, filepath.Join(tmpDir, "test.yaml"), []byte(testYAML))

	client, err := NewOfflineClient(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create offline client: %v", err)
	}

	opts := &core_v1.PodLogOptions{Container: ""}
	reader, err := client.StreamPodLogs("test-namespace", "test-pod", opts)
	if err != nil {
		t.Fatalf("Failed to stream pod logs: %v", err)
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("Failed to read log data: %v", err)
	}

	if len(data) != 0 {
		t.Errorf("Expected empty log content when container is empty string, got %q", string(data))
	}
}

func TestStreamPodLogs_NonexistentNamespace(t *testing.T) {
	tmpDir := t.TempDir()

	namespacesDir := filepath.Join(tmpDir, "namespaces")
	mkdirAll(t, namespacesDir)

	testYAML := `apiVersion: v1
kind: Namespace
metadata:
  name: test-namespace
`
	filetest.WriteFile(t, filepath.Join(tmpDir, "test.yaml"), []byte(testYAML))

	client, err := NewOfflineClient(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create offline client: %v", err)
	}

	opts := &core_v1.PodLogOptions{Container: "test-container"}
	reader, err := client.StreamPodLogs("nonexistent-namespace", "test-pod", opts)
	if err != nil {
		t.Fatalf("Failed to stream pod logs: %v", err)
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("Failed to read log data: %v", err)
	}

	if len(data) != 0 {
		t.Errorf("Expected empty log content for nonexistent namespace, got %q", string(data))
	}
}
