package manage_istio_config

import (
	"context"
	"fmt"
	"net/http"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/business"
)


func Execute(ctx context.Context, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
	// Extract parameters
	action, _ := args["action"].(string)
	namespace, _ := args["namespace"].(string)
	group, _ := args["group"].(string)
	version, _ := args["version"].(string)
	kind, _ := args["kind"].(string)
	object, _ := args["object"].(string)
	jsonData, _ := args["json_data"].(string)

	// Validate input
	if err := validateIstioConfigInput(action, namespace, group, version, kind, object, jsonData); err != nil {
		return err.Error(), http.StatusBadRequest
	}

	// Execute action
	switch action {
	case "list":
		return IstioList(ctx, args, businessLayer, conf)
	case "create":
		return fmt.Errorf("invalid action %q: must be one of list, create, patch, get, delete", action), http.StatusBadRequest
	
		//return IstioCreate(ctx, args, businessLayer, conf)
	case "patch":
		return fmt.Errorf("invalid action %q: must be one of list, create, patch, get, delete", action), http.StatusBadRequest
		//return IstioPatch(ctx, args, businessLayer, conf)
	case "get":
		return IstioGet(ctx, args, businessLayer, conf)
	case "delete":
		return fmt.Errorf("invalid action %q: must be one of list, create, patch, get, delete", action), http.StatusBadRequest
		//return IstioDelete(ctx, args, businessLayer, conf)
	default:
		return fmt.Errorf("invalid action %q: must be one of list, create, patch, get, delete", action), http.StatusBadRequest
	}
}

// validateIstioConfigInput centralizes validation rules for manage istio config tool.
// Rules:
// - If action is not "list": namespace, group, version, kind are required
// - If action is "create": json_data are required
// - If action is "patch": name and json_data is required
// - If action is "get": name is required
// - If action is "patch": name is required
func validateIstioConfigInput(action, namespace, group, version, kind, name, jsonData string) error {
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
		}
		if action == "patch" {
			if name == "" {
				return fmt.Errorf("name is required for action %q", action)
			}
			if jsonData == "" {
				return fmt.Errorf("json_data is required for action %q", action)
			}
		}
		if action == "get" {
			if name == "" {
				return fmt.Errorf("name is required for action %q", action)
			}
		}
		if action == "delete" {
			if name == "" {
				return fmt.Errorf("name is required for action %q", action)
			}
		}
	default:
		return fmt.Errorf("invalid action %q: must be one of list, create, patch, get, delete", action)
	}
	return nil
}
