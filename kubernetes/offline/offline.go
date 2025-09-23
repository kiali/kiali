package offline

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	auth_v1 "k8s.io/api/authorization/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/util/yaml"

	kialikube "github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/log"
)

const namespaceDir = "namespaces"

// NewOfflineClient creates a ClientInterface that reads YAML files from the specified directory path.
// It walks the directory recursively, finds all YAML files, parses them (including multiple YAML documents
// separated by ---), and returns a fake client containing all the parsed objects.
func NewOfflineClient(path string) (*OfflineClient, error) {
	scheme, err := kialikube.NewScheme()
	if err != nil {
		return nil, fmt.Errorf("failed to create scheme: %w", err)
	}

	var objects []runtime.Object
	var namespacesDir string

	err = filepath.WalkDir(path, func(filePath string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Look for the "namespaces" dir and save that for later when fetching logs/dumps from pods.
		// TODO: There has to be a better way to do this.
		if d.Name() == namespaceDir {
			namespacesDir = filePath
		}

		// Skip directories - filepath.WalkDir will handle recursion
		if d.IsDir() {
			return nil
		}

		if !isYAMLFile(filePath) {
			return nil
		}

		fileObjects, err := parseYAMLFile(filePath, scheme)
		if err != nil {
			return fmt.Errorf("failed to parse YAML file %s: %w", filePath, err)
		}

		objects = append(objects, fileObjects...)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to walk directory %s: %w", path, err)
	}

	fakeClient := kubetest.NewFakeK8sClient(objects...)

	return &OfflineClient{
		namespacesDir: namespacesDir,
		FakeK8sClient: fakeClient,
	}, nil
}

func isYAMLFile(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	return ext == ".yaml" || ext == ".yml"
}

// parseYAMLFile reads a YAML file and parses it into kube runtime objects.
func parseYAMLFile(filePath string, scheme *runtime.Scheme) ([]runtime.Object, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	var objects []runtime.Object
	decoder := yaml.NewYAMLOrJSONDecoder(file, 4096)
	deserializer := serializer.NewCodecFactory(scheme).UniversalDeserializer()

	for {
		var rawObj runtime.RawExtension
		if err := decoder.Decode(&rawObj); err != nil {
			if err == io.EOF {
				break
			}
			return nil, fmt.Errorf("failed to decode YAML document: %w", err)
		}

		if len(rawObj.Raw) == 0 {
			continue
		}

		obj, gvk, err := deserializer.Decode(rawObj.Raw, nil, nil)
		if err != nil {
			// Log the error but continue with other documents
			log.Debugf("Failed to decode object in file %s (GVK: %v): %v\n", filePath, gvk, err)
			continue
		}

		objects = append(objects, obj)
	}

	return objects, nil
}

// OfflineClient wraps the FakeK8sClient and overrides some of the client methods to work
// offline where necesssary. Should only be used in "offline" mode.
type OfflineClient struct {
	// The path to the "namespaces" dir. Used to find logs/dumps from pods.
	namespacesDir string

	*kubetest.FakeK8sClient
}

// GetSelfSubjectAccessReview overrides the embedded FakeK8sClient method to always return
// "allowed" for any access review requests. Without this, a new access review is created
// each time which will cause an error the second time it is called since the object
// already exists in the fake client.
func (c *OfflineClient) GetSelfSubjectAccessReview(ctx context.Context, namespace, api, resourceType string, verbs []string) ([]*auth_v1.SelfSubjectAccessReview, error) {
	var reviews []*auth_v1.SelfSubjectAccessReview

	// Create an allowed review for each verb
	for _, verb := range verbs {
		review := &auth_v1.SelfSubjectAccessReview{
			Spec: auth_v1.SelfSubjectAccessReviewSpec{
				ResourceAttributes: &auth_v1.ResourceAttributes{
					Namespace: namespace,
					Verb:      verb,
					Group:     api,
					Resource:  resourceType,
				},
			},
			Status: auth_v1.SubjectAccessReviewStatus{
				Allowed: true,
				Reason:  "offline mode - all permissions granted",
			},
		}
		reviews = append(reviews, review)
	}

	return reviews, nil
}

// noopReadCloser is a simple implementation of io.ReadCloser that returns
// empty reads and does nothing on close. This is useful for offline mode
// where we don't want to actually stream logs.
type noopReadCloser struct{}

func (nrc *noopReadCloser) Read(p []byte) (n int, err error) {
	return 0, io.EOF
}

func (nrc *noopReadCloser) Close() error {
	return nil
}

// StreamPodLogs overrides the embedded FakeK8sClient method to read logs from local files
// for offline mode testing. This reads from the offline data directory structure.
func (c *OfflineClient) StreamPodLogs(namespace, name string, opts *core_v1.PodLogOptions) (io.ReadCloser, error) {
	// If container is specified, try to find logs for that specific container
	if opts != nil && opts.Container != "" {
		containerName := opts.Container
		logPath := filepath.Join(c.namespacesDir, namespace, "pods", name, containerName, containerName, "logs", "current.log")

		if file, err := os.Open(logPath); err == nil {
			log.Debugf("Successfully opened log file: %s", logPath)
			return file, nil
		} else {
			log.Debugf("Unable to open log file %s: %s", logPath, err)
		}

		// If specific container not found, return empty logs
		log.Debugf("No log file found for pod %s/%s container %s, returning empty logs", namespace, name, containerName)
		return &noopReadCloser{}, nil
	}

	log.Debugf("No containers with logs found for pod %s/%s, returning empty logs", namespace, name)
	return &noopReadCloser{}, nil
}

// GetConfigDump overrides the embedded FakeK8sClient method to read config dumps from local files
// for offline mode testing. This reads from the offline data directory structure.
func (c *OfflineClient) GetConfigDump(namespace, podName string) (*kialikube.ConfigDump, error) {
	configDumpPath := filepath.Join(c.namespacesDir, namespace, "pods", podName, "config_dump_proxy.json")

	data, err := os.ReadFile(configDumpPath)
	if err != nil {
		log.Debugf("Unable to read config dump file %s: %s", configDumpPath, err)
		// Return empty config dump when file not found
		return &kialikube.ConfigDump{
			Configs: []interface{}{},
		}, nil
	}

	log.Debugf("Successfully read config dump file: %s", configDumpPath)

	var configDump kialikube.ConfigDump
	if err := json.Unmarshal(data, &configDump); err != nil {
		log.Debugf("Failed to unmarshal config dump file %s: %s", configDumpPath, err)
		// Return empty config dump when JSON is invalid
		return &kialikube.ConfigDump{
			Configs: []interface{}{},
		}, nil
	}

	return &configDump, nil
}
