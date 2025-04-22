package util

import (
	"fmt"
	"sort"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

const RolloutsLabel = "rollouts-pod-template-hash"

func RemoveNilValues(root interface{}) {
	if mRoot, isMap := root.(map[string]interface{}); isMap {
		for k, v := range mRoot {
			if v == nil {
				delete(mRoot, k)
			}
			if leaf, isLeafMap := v.(map[string]interface{}); isLeafMap {
				RemoveNilValues(leaf)
			}
		}
	}
}

func CopyStringMap(originalMap map[string]string) map[string]string {
	copyMap := make(map[string]string)

	if len(originalMap) == 0 {
		return copyMap
	}

	for key, value := range originalMap {
		copyMap[key] = value
	}

	return copyMap
}

func BuildNameNSKey(name string, namespace string) string {
	return name + "." + namespace
}

func BuildNameNSTypeKey(name string, namespace string, objType schema.GroupVersionKind) string {
	return BuildNameNSKey(name, namespace) + "/" + objType.String()
}

func ParseNameNSKey(nameNSKey string) (string, string) {
	// Find the last dot in the string to separate name and namespace
	lastDot := strings.LastIndex(nameNSKey, ".")
	if lastDot == -1 {
		// If there's no dot, it might be malformed, or it's a name with no namespace
		return nameNSKey, ""
	}
	// Split the name and namespace
	name := nameNSKey[:lastDot]
	namespace := nameNSKey[lastDot+1:]

	return name, namespace
}

// Helper function to parse the GVK string back into schema.GroupVersionKind
func StringToGVK(gvk string) (schema.GroupVersionKind, error) {
	// Split the GVK string into its components (group, version, kind)
	// Example: "gateway.networking.k8s.io/v1, Kind=Gateway"
	parts := strings.Split(gvk, ", Kind=")
	if len(parts) != 2 {
		// wor workloads, apps and services
		return schema.GroupVersionKind{
			Group:   "",
			Version: "",
			Kind:    gvk,
		}, nil
	}

	groupVersion := parts[0]
	kind := parts[1]

	// Split the groupVersion into group and version
	gvParts := strings.Split(groupVersion, "/")
	if len(gvParts) == 2 {
		return schema.GroupVersionKind{
			Group:   gvParts[0],
			Version: gvParts[1],
			Kind:    kind,
		}, nil
	}

	return schema.GroupVersionKind{}, fmt.Errorf("Invalid GVK format: %s", gvk)
}

func LabelsToSortedString(labels map[string]string) string {
	var keys []string
	for k := range labels {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var parts []string
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", k, labels[k]))
	}

	return strings.Join(parts, ",")
}

func IsRollout(name string, labels map[string]string) bool {
	return labels[RolloutsLabel] != "" &&
		strings.Contains(name, labels[RolloutsLabel])
}

func GetRolloutName(name string, labels map[string]string) string {
	// Heuristic for ArgoCD Rollout
	// ReplicaSets name contains rollouts label istio-rollout-6859f78556
	// Consider Pods as well, name can be istio-rollout-6859f78556-v527f
	if labels[RolloutsLabel] != "" {
		suffix := fmt.Sprintf("-%s", labels[RolloutsLabel])
		if idx := strings.LastIndex(name, suffix); idx != -1 {
			return name[:idx]
		}
	}
	return name
}

func JoinLabelsWithoutRollout(labelMaps ...map[string]string) map[string]string {
	joined := make(map[string]string)
	for _, m := range labelMaps {
		for k, v := range m {
			if k != RolloutsLabel {
				joined[k] = v
			}
		}
	}
	return joined
}
