package manage_istio_config

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"unicode"

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

	sensitiveActions := map[string]bool{
		"create": true,
		"patch":  true,
		"delete": true,
	}
	if sensitiveActions[action] && !confirmed {
		previewActions := createFileAction(args)
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
	case "create":
		return IstioCreate(r, args, businessLayer, conf)
	case "patch":
		return IstioPatch(r, args, businessLayer, conf)
	case "get":
		return IstioGet(ctx, args, businessLayer, conf)
	case "delete":
		return IstioDelete(r, args, businessLayer, conf)
	default:
		return fmt.Errorf("invalid action %q: must be one of list, create, patch, get, delete", action), http.StatusBadRequest
	}
}

func createFileAction(args map[string]interface{}) []get_action_ui.Action {
	action, _ := args["action"].(string)
	cluster, _ := args["cluster"].(string)
	object, _ := args["object"].(string)
	kind, _ := args["kind"].(string)
	group, _ := args["group"].(string)
	version, _ := args["version"].(string)
	namespace, _ := args["namespace"].(string)
	jsonData, _ := args["json_data"].(string)

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

	payload := jsonData
	if strings.TrimSpace(jsonData) != "" {
		if yml, err := normalizeToYAML(jsonData); err == nil {
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
			Operation: action,
			Cluster:   cluster,
			Namespace: namespace,
			Group:     group,
			Version:   version,
			KindName:  kind,
			Object:    object,
		},
	}
}

// validateIstioConfigInput centralizes validation rules for manage istio config tool.
// Rules:
// - If action is not "list": namespace, group, version, kind are required
// - If action is "create": json_data are required
// - If action is "patch": name and json_data is required
// - If action is "get": name is required
// - If action is "patch": name is required
func validateIstioConfigInput(args map[string]interface{}) error {
	action, _ := args["action"].(string)
	namespace, _ := args["namespace"].(string)
	group, _ := args["group"].(string)
	version, _ := args["version"].(string)
	kind, _ := args["kind"].(string)
	object, _ := args["object"].(string)
	jsonData, _ := args["json_data"].(string)
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
			if jsonData == "" {
				return fmt.Errorf("json_data is required for action %q", action)
			}
			if object == "" {
				return fmt.Errorf("object is required for action %q", action)
			}
		}
		if action == "patch" {
			if object == "" {
				return fmt.Errorf("name is required for action %q", action)
			}
			if jsonData == "" {
				return fmt.Errorf("json_data is required for action %q", action)
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
