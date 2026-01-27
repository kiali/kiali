package manage_istio_config

import (
	"fmt"
	"net/http"
	"strings"
	"unicode"

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
		// Return a response that forces the AI to stop and talk to the user
		return struct {
			Actions []get_action_ui.Action `json:"actions"`
			Result  string                 `json:"result"`
		}{
			Actions: createFileAction(args),
			Result: fmt.Sprintf(
				"⚠️ OPERATION PAUSED: You are about to perform a '%s' operation. "+
					"This is a sensitive action. Please ask the user: 'Are you sure you want to %s this Istio object?' "+
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
	object, _ := args["object"].(string)
	kind, _ := args["kind"].(string)
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
	return []get_action_ui.Action{
		{
			Title:    fmt.Sprintf("Preview of files to %s", action),
			FileName: fileName,
			Kind:     get_action_ui.ActionKindFile,
			Payload:  jsonData,
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
