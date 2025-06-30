package offline

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/util/yaml"

	kialikube "github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/log"
)

// NewOfflineClient creates a ClientInterface that reads YAML files from the specified directory path.
// It walks the directory recursively, finds all YAML files, parses them (including multiple YAML documents
// separated by ---), and returns a fake client containing all the parsed objects.
func NewOfflineClient(path string) (*kubetest.FakeK8sClient, error) {
	scheme, err := kialikube.NewScheme()
	if err != nil {
		return nil, fmt.Errorf("failed to create scheme: %w", err)
	}

	var objects []runtime.Object

	err = filepath.WalkDir(path, func(filePath string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
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

	return fakeClient, nil
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
			log.Warningf("Warning: failed to decode object in file %s (GVK: %v): %v\n", filePath, gvk, err)
			continue
		}

		objects = append(objects, obj)
	}

	return objects, nil
}
