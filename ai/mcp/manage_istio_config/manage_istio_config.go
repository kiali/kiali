package manage_istio_config

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"unicode"

	jsonpatch "github.com/evanphx/json-patch/v5"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"

	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

func Execute(r *http.Request, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
	ctx := r.Context()
	// Extract parameters
	action, _ := args["action"].(string)
	confirmed, _ := args["confirmed"].(bool)
	// Validate input
	if err := validateIstioConfigInput(args); err != nil {
		return err.Error(), http.StatusBadRequest
	}

	// If the action targets a specific Istio/K8s config object type, validate it early.
	// This avoids prompting for confirmation for unsupported types.
	if action != "list" {
		group, _ := args["group"].(string)
		version, _ := args["version"].(string)
		kind, _ := args["kind"].(string)
		gvk := schema.GroupVersionKind{Group: group, Version: version, Kind: kind}
		if !business.GetIstioAPI(gvk) {
			// Friendly hint for common mismatch.
			if group == "gateway.networking.k8s.io" && kind == "Gateway" && version == "v1beta1" {
				return fmt.Sprintf("Object type not managed: %s. Hint: try version 'v1' for Gateway API resources.", gvk.String()), http.StatusBadRequest
			}
			return fmt.Sprintf("Object type not managed: %s", gvk.String()), http.StatusBadRequest
		}
	}

	sensitiveActions := map[string]bool{
		"create": true,
		"patch":  true,
		"delete": true,
	}

	// For create/patch we always return a file action so the UI can show the editor,
	// regardless of whether the operation is executed.
	if action == "create" || action == "patch" {
		previewActions := createFileAction(ctx, args, businessLayer, conf)
		if !confirmed {
			// Return the editor action. The UI can apply directly from the editor.
			return struct {
				Actions []get_action_ui.Action `json:"actions"`
				Result  string                 `json:"result"`
			}{
				Actions: previewActions,
				Result:  fmt.Sprintf("Edit the YAML and click %s to apply.", strings.Title(action)),
			}, 200 // Return success (200) so the AI processes the message
		}

		// Execute action and still provide the editor payload in the response.
		var res interface{}
		var status int
		if action == "create" {
			res, status = IstioCreate(r, args, businessLayer, conf)
		} else {
			res, status = IstioPatch(r, args, businessLayer, conf)
		}
		return struct {
			Actions []get_action_ui.Action `json:"actions"`
			Result  interface{}            `json:"result"`
		}{
			Actions: previewActions,
			Result:  res,
		}, status
	}

	if sensitiveActions[action] && !confirmed {
		previewActions := createFileAction(ctx, args, businessLayer, conf)
		// Return a response that forces the AI to stop and talk to the user
		return struct {
			Actions []get_action_ui.Action `json:"actions"`
			Result  string                 `json:"result"`
		}{
			Actions: previewActions,
			Result: fmt.Sprintf(
				"OPERATION PAUSED: You are about to perform a '%s' operation. "+
					"A YAML preview has been prepared (see the attached file). "+
					"Please ask the user: 'Does this look correct, and do you want me to proceed with %s?' "+
					"If they say yes, call this tool again with the exact same arguments and 'confirmed': true.",
				action, action),
		}, 200 // Return success (200) so the AI processes the message
	}

	// Execute action
	switch action {
	case "list":
		return IstioList(ctx, args, businessLayer, conf)
	case "get":
		return IstioGet(ctx, args, businessLayer, conf)
	case "delete":
		return IstioDelete(r, args, businessLayer, conf)
	default:
		return fmt.Errorf("invalid action %q: must be one of list, create, patch, get, delete", action), http.StatusBadRequest
	}
}

func createFileAction(ctx context.Context, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) []get_action_ui.Action {
	action, _ := args["action"].(string)
	operation := strings.ToLower(strings.TrimSpace(action))
	if operation != "create" && operation != "patch" && operation != "delete" {
		operation = ""
	}
	cluster, _ := args["cluster"].(string)
	object, _ := args["object"].(string)
	kind, _ := args["kind"].(string)
	group, _ := args["group"].(string)
	version, _ := args["version"].(string)
	namespace, _ := args["namespace"].(string)
	data, _ := args["data"].(string)

	// Get initials of Kind in lowercase
	var initials string
	for _, char := range kind {
		if unicode.IsUpper(char) {
			initials += string(unicode.ToLower(char))
		}
	}

	// Sanitize object name: replace spaces with underscores
	sanitizedObject := strings.ReplaceAll(object, " ", "_")

	fileName := fmt.Sprintf("%s_%s.yaml", initials, sanitizedObject)

	payload := data
	if strings.TrimSpace(data) != "" {
		// For patch previews, render the final object after applying the merge patch
		// so the user can see required fields that might be overwritten/removed.
		if action == "patch" && businessLayer != nil && conf != nil && strings.TrimSpace(namespace) != "" && strings.TrimSpace(group) != "" && strings.TrimSpace(version) != "" && strings.TrimSpace(kind) != "" && strings.TrimSpace(object) != "" {
			if merged, err := renderMergedPatchPreviewYAML(ctx, args, businessLayer, conf); err == nil && strings.TrimSpace(merged) != "" {
				payload = merged
			} else if yml, err := normalizeToYAML(data); err == nil {
				payload = yml
			}
		} else if yml, err := normalizeToYAML(data); err == nil {
			payload = yml
		}
	} else {
		apiVersion := version
		if strings.TrimSpace(group) != "" {
			apiVersion = strings.TrimSpace(group) + "/" + strings.TrimSpace(version)
		}
		if strings.TrimSpace(kind) != "" && strings.TrimSpace(object) != "" && strings.TrimSpace(namespace) != "" && strings.TrimSpace(apiVersion) != "" {
			payload = stubManifestYAML(apiVersion, kind, object, namespace)
		}
	}
	return []get_action_ui.Action{
		{
			Title:     fmt.Sprintf("Preview of files to %s", action),
			FileName:  fileName,
			Kind:      get_action_ui.ActionKindFile,
			Payload:   payload,
			Operation: operation,
			Cluster:   cluster,
			Namespace: namespace,
			Group:     group,
			Version:   version,
			KindName:  kind,
			Object:    object,
		},
	}
}

func renderMergedPatchPreviewYAML(ctx context.Context, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (string, error) {
	cluster, _ := args["cluster"].(string)
	namespace, _ := args["namespace"].(string)
	group, _ := args["group"].(string)
	version, _ := args["version"].(string)
	kind, _ := args["kind"].(string)
	object, _ := args["object"].(string)
	data, _ := args["data"].(string)

	if cluster == "" {
		cluster = conf.KubernetesConfig.ClusterName
	}

	gvk := schema.GroupVersionKind{Group: group, Version: version, Kind: kind}
	details, err := businessLayer.IstioConfig.GetIstioConfigDetails(ctx, cluster, namespace, gvk, object)
	if err != nil {
		return "", err
	}
	if details.Object == nil {
		return "", fmt.Errorf("no object returned for %s %s/%s", gvk.String(), namespace, object)
	}

	// Build a compact base document (type+name/ns+spec) and merge the patch onto it.
	u, err := runtime.DefaultUnstructuredConverter.ToUnstructured(details.Object)
	if err != nil {
		return "", err
	}
	base := map[string]interface{}{
		"apiVersion": gvk.GroupVersion().String(),
		"kind":       gvk.Kind,
		"metadata": map[string]interface{}{
			"name":      object,
			"namespace": namespace,
		},
	}
	if spec, ok := u["spec"]; ok {
		base["spec"] = spec
	}

	baseJSON, err := json.Marshal(base)
	if err != nil {
		return "", err
	}
	patchJSON, err := yaml.YAMLToJSON([]byte(data))
	if err != nil {
		return "", err
	}

	mergedJSON, err := jsonpatch.MergePatch(baseJSON, patchJSON)
	if err != nil {
		return "", err
	}
	mergedYAML, err := yaml.JSONToYAML(mergedJSON)
	if err != nil {
		return "", err
	}
	out := string(mergedYAML)
	if out != "" && !strings.HasSuffix(out, "\n") {
		out += "\n"
	}
	return out, nil
}

// validateIstioConfigInput centralizes validation rules for manage istio config tool.
// Rules:
// - If action is not "list": namespace, group, version, kind are required
// - If action is "create": data is required
// - If action is "patch": name and data is required
// - If action is "get": name is required
// - If action is "patch": name is required
func validateIstioConfigInput(args map[string]interface{}) error {
	action, _ := args["action"].(string)
	namespace, _ := args["namespace"].(string)
	group, _ := args["group"].(string)
	version, _ := args["version"].(string)
	kind, _ := args["kind"].(string)
	object, _ := args["object"].(string)
	data, _ := args["data"].(string)
	payload := data
	switch action {
	case "list", "create", "patch", "get", "delete":
		if action != "list" {
			if namespace == "" {
				return fmt.Errorf("namespace is required for action %q", action)
			}
			if group == "" {
				return fmt.Errorf("group is required for action %q", action)
			}
			if version == "" {
				return fmt.Errorf("version is required for action %q", action)
			}
			if kind == "" {
				return fmt.Errorf("kind is required for action %q", action)
			}
		}
		if action == "create" {
			if strings.TrimSpace(payload) == "" {
				return fmt.Errorf("data is required for action %q", action)
			}
			if object == "" {
				return fmt.Errorf("object is required for action %q", action)
			}
		}
		if action == "patch" {
			if object == "" {
				return fmt.Errorf("name is required for action %q", action)
			}
			if strings.TrimSpace(payload) == "" {
				return fmt.Errorf("data is required for action %q", action)
			}

		}
		if action == "get" {
			if object == "" {
				return fmt.Errorf("name is required for action %q", action)
			}
		}
		if action == "delete" {
			if object == "" {
				return fmt.Errorf("name is required for action %q", action)
			}
		}
	default:
		return fmt.Errorf("invalid action %q: must be one of list, create, patch, get, delete", action)
	}
	return nil
}

func normalizeToYAML(jsonOrYAML string) (string, error) {
	// Accept JSON or YAML; JSON is valid YAML, but YAMLToJSON normalizes either.
	jsonBytes, err := yaml.YAMLToJSON([]byte(jsonOrYAML))
	if err != nil {
		return "", err
	}

	var v interface{}
	if err := json.Unmarshal(jsonBytes, &v); err != nil {
		return "", err
	}

	yml, err := yaml.Marshal(v)
	if err != nil {
		return "", err
	}
	if len(yml) > 0 && yml[len(yml)-1] != '\n' {
		yml = append(yml, '\n')
	}
	return string(yml), nil
}

func stubManifestYAML(apiVersion, kind, name, namespace string) string {
	m := map[string]interface{}{
		"apiVersion": strings.TrimSpace(apiVersion),
		"kind":       strings.TrimSpace(kind),
		"metadata": map[string]interface{}{
			"name":      strings.TrimSpace(name),
			"namespace": strings.TrimSpace(namespace),
		},
	}
	b, err := yaml.Marshal(m)
	if err != nil {
		return ""
	}
	if len(b) > 0 && b[len(b)-1] != '\n' {
		b = append(b, '\n')
	}
	return string(b)
}
