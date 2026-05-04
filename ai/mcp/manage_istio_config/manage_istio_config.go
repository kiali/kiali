package manage_istio_config

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"unicode"

	jsonpatch "github.com/evanphx/json-patch/v5"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"

	"github.com/kiali/kiali/ai/mcp/get_action_ui"
	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

// ExecuteReadOnly runs read-only actions (list, get) for Istio config. Use this for the manage_istio_config_read tool.
// All errors are returned with HTTP 200 so the LLM can interpret and relay
// them to the user instead of the execution framework treating them as fatal.
func ExecuteReadOnly(kialiInterface *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	action := mcputil.GetStringArg(args, "action")
	namespace := mcputil.GetStringArg(args, "namespace")
	clusterName := mcputil.GetStringOrDefault(args, kialiInterface.Conf.KubernetesConfig.ClusterName, "clusterName")
	if err := validateReadOnlyIstioConfigInput(args); err != nil {
		return err.Error(), http.StatusOK
	}
	if action != "list" {
		group := mcputil.GetStringArg(args, "group")
		version := mcputil.GetStringArg(args, "version")
		kind := mcputil.GetStringArg(args, "kind")
		gvk := schema.GroupVersionKind{Group: group, Version: version, Kind: kind}
		if !business.GetIstioAPI(gvk) {
			if group == "gateway.networking.k8s.io" && kind == "Gateway" && version == "v1beta1" {
				return fmt.Sprintf("Object type not managed: %s. Hint: try version 'v1' for Gateway API resources.", gvk.String()), http.StatusOK
			}
			return fmt.Sprintf("Object type not managed: %s", gvk.String()), http.StatusOK
		}
	}

	if action == "get" {
		if msg, code := checkNamespaceExists(kialiInterface.Request.Context(), kialiInterface.BusinessLayer, namespace, clusterName); code != 0 {
			return msg, code
		}
	}
	if action == "list" && namespace != "" {
		if msg, code := checkNamespaceExists(kialiInterface.Request.Context(), kialiInterface.BusinessLayer, namespace, clusterName); code != 0 {
			return msg, code
		}
	}

	switch action {
	case "list":
		return IstioList(kialiInterface.Request.Context(), args, kialiInterface.BusinessLayer, kialiInterface.Conf)
	case "get":
		return IstioGet(kialiInterface.Request.Context(), args, kialiInterface.BusinessLayer, kialiInterface.Conf)
	default:
		return fmt.Sprintf("invalid action %q: must be one of list, get", action), http.StatusOK
	}
}

func Execute(kialiInterface *mcputil.KialiInterface, args map[string]interface{}) (interface{}, int) {
	action := mcputil.GetStringArg(args, "action")
	confirmed := mcputil.AsBool(args["confirmed"])
	mcpMode := mcputil.AsBoolOrDefault(args, false, "mcp_mode")

	if action == "list" || action == "get" {
		return "for list and get actions use the manage_istio_config_read tool", http.StatusBadRequest
	}
	if err := validateIstioConfigInput(args); err != nil {
		return err.Error(), http.StatusBadRequest
	}

	if action != "list" {
		group := mcputil.GetStringArg(args, "group")
		version := mcputil.GetStringArg(args, "version")
		kind := mcputil.GetStringArg(args, "kind")
		gvk := schema.GroupVersionKind{Group: group, Version: version, Kind: kind}
		if !business.GetIstioAPI(gvk) {
			if group == "gateway.networking.k8s.io" && kind == "Gateway" && version == "v1beta1" {
				return fmt.Sprintf("Object type not managed: %s. Hint: try version 'v1' for Gateway API resources.", gvk.String()), http.StatusBadRequest
			}
			return fmt.Sprintf("Object type not managed: %s", gvk.String()), http.StatusBadRequest
		}
	}

	// Validate namespace existence early, before building previews or executing
	// mutations, so the user never sees a YAML editor for a non-existent namespace.
	{
		namespace, _ := args["namespace"].(string)
		clusterName, _ := args["clusterName"].(string)
		if clusterName == "" {
			clusterName = kialiInterface.Conf.KubernetesConfig.ClusterName
		}
		if msg, code := checkNamespaceExists(kialiInterface.Request.Context(), kialiInterface.BusinessLayer, namespace, clusterName); code != 0 {
			return msg, code
		}
	}

	if action == "create" || action == "patch" {
		previewActions := createFileAction(kialiInterface.Request.Context(), args, kialiInterface.BusinessLayer, kialiInterface.Conf)
		if !confirmed && !mcpMode {
			// Return the editor action. The UI can apply directly from the editor.
			return struct {
				Actions []get_action_ui.Action `json:"actions"`
				Result  string                 `json:"result"`
			}{
				Actions: previewActions,
				Result: fmt.Sprintf(
					"PREVIEW READY: A YAML preview for the '%s' operation has been prepared (see the attached file). "+
						"The user can review and edit the YAML, then click %s to apply it. "+
						"Show the preview to the user and ask: 'Does this look correct, and do you want me to proceed with %s?' "+
						"If they say yes, call this tool again with the exact same arguments and 'confirmed': true.",
					action, cases.Title(language.Und).String(action), action),
			}, 200 // Return success (200) so the AI processes the message
		}

		// Execute action and still provide the editor payload in the response.
		var res interface{}
		var status int
		if action == "create" {
			res, status = IstioCreate(kialiInterface.Request, args, kialiInterface.BusinessLayer, kialiInterface.Conf)
		} else {
			res, status = IstioPatch(kialiInterface.Request, args, kialiInterface.BusinessLayer, kialiInterface.Conf)
		}
		// Always return HTTP 200 so the execution framework passes the result
		// to the LLM. Otherwise non-200 statuses are treated as fatal errors
		// and the LLM never sees the failure — it cannot tell the user what
		// went wrong.
		if status != http.StatusOK {
			res = fmt.Sprintf("ERROR: %s", res)
		}
		if !mcpMode {
			return struct {
				Actions []get_action_ui.Action `json:"actions"`
				Result  interface{}            `json:"result"`
			}{
				Actions: previewActions,
				Result:  res,
			}, http.StatusOK
		}
		return res, http.StatusOK
	}

	if action == "delete" && !confirmed {
		previewActions := createFileAction(kialiInterface.Request.Context(), args, kialiInterface.BusinessLayer, kialiInterface.Conf)
		// Return a response that forces the AI to stop and talk to the user
		return struct {
			Actions []get_action_ui.Action `json:"actions"`
			Result  string                 `json:"result"`
		}{
			Actions: previewActions,
			Result: fmt.Sprintf(
				"PREVIEW READY: A YAML preview for the '%s' operation has been prepared (see the attached file). "+
					"Show the preview to the user and ask: 'Does this look correct, and do you want me to proceed with %s?' "+
					"If they say yes, call this tool again with the exact same arguments and 'confirmed': true.",
				action, action),
		}, 200 // Return success (200) so the AI processes the message
	}

	switch action {
	case "delete":
		res, status := IstioDelete(kialiInterface.Request, args, kialiInterface.BusinessLayer, kialiInterface.Conf)
		if status != http.StatusOK {
			return fmt.Sprintf("ERROR: %s", res), http.StatusOK
		}
		return res, http.StatusOK
	default:
		return fmt.Sprintf("invalid action %q: must be one of create, patch, delete", action), http.StatusBadRequest
	}
}

func createFileAction(ctx context.Context, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) []get_action_ui.Action {
	action := mcputil.GetStringArg(args, "action")
	operation := strings.ToLower(strings.TrimSpace(action))
	if operation != "create" && operation != "patch" && operation != "delete" {
		operation = ""
	}
	clusterName := mcputil.GetStringArg(args, "clusterName")
	object := mcputil.GetStringArg(args, "object")
	kind := mcputil.GetStringArg(args, "kind")
	group := mcputil.GetStringArg(args, "group")
	version := mcputil.GetStringArg(args, "version")
	namespace := mcputil.GetStringArg(args, "namespace")
	data := mcputil.GetStringArg(args, "data")

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
		} else if action == "create" && businessLayer != nil && conf != nil {
			// For create, try to load existing object and merge LLM changes, or use template with defaults.
			if yml, err := ensureCompleteCreateYAML(args, data, ctx, businessLayer, conf); err == nil && strings.TrimSpace(yml) != "" {
				payload = yml
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
			Cluster:   clusterName,
			Namespace: namespace,
			Group:     group,
			Version:   version,
			KindName:  kind,
			Object:    object,
		},
	}
}

func renderMergedPatchPreviewYAML(ctx context.Context, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (string, error) {
	clusterName := mcputil.GetStringArg(args, "clusterName")
	namespace := mcputil.GetStringArg(args, "namespace")
	group := mcputil.GetStringArg(args, "group")
	version := mcputil.GetStringArg(args, "version")
	kind := mcputil.GetStringArg(args, "kind")
	object := mcputil.GetStringArg(args, "object")
	data := mcputil.GetStringArg(args, "data")

	if clusterName == "" {
		clusterName = conf.KubernetesConfig.ClusterName
	}

	gvk := schema.GroupVersionKind{Group: group, Version: version, Kind: kind}
	details, err := businessLayer.IstioConfig.GetIstioConfigDetails(ctx, clusterName, namespace, gvk, object)
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

// ensureCompleteCreateYAML ensures the YAML for CREATE has required Kubernetes metadata fields.
// Strategy: Try to load existing object first. If exists, merge LLM changes onto it.
// Otherwise, use template with required defaults.
func ensureCompleteCreateYAML(args map[string]interface{}, data string, ctx context.Context, businessLayer *business.Layer, conf *config.Config) (string, error) {
	clusterName := mcputil.GetStringArg(args, "clusterName")
	namespace := mcputil.GetStringArg(args, "namespace")
	group := mcputil.GetStringArg(args, "group")
	version := mcputil.GetStringArg(args, "version")
	kind := mcputil.GetStringArg(args, "kind")
	object := mcputil.GetStringArg(args, "object")

	if clusterName == "" {
		clusterName = conf.KubernetesConfig.ClusterName
	}

	gvk := schema.GroupVersionKind{Group: group, Version: version, Kind: kind}

	// Parse the LLM-provided YAML
	var llmData map[string]interface{}
	if err := yaml.Unmarshal([]byte(data), &llmData); err != nil {
		return "", err
	}

	// Check if the LLM provided a complete K8s document
	hasAPIVersion := llmData["apiVersion"] != nil && llmData["apiVersion"] != ""
	hasKind := llmData["kind"] != nil && llmData["kind"] != ""
	hasMetadata := false
	if meta, ok := llmData["metadata"].(map[string]interface{}); ok {
		hasMetadata = meta["name"] != nil && meta["name"] != ""
	}

	if hasAPIVersion && hasKind && hasMetadata {
		// LLM provided a complete document - use it as-is
		return normalizeToYAML(data)
	}

	// Try to load existing object from clusterName (same approach as PATCH preview)
	var base map[string]interface{}
	if details, err := businessLayer.IstioConfig.GetIstioConfigDetails(ctx, clusterName, namespace, gvk, object); err == nil && details.Object != nil {
		// Object exists - use it as the base for merging LLM changes
		u, err := runtime.DefaultUnstructuredConverter.ToUnstructured(details.Object)
		if err == nil {
			// Build a clean base (no metadata cruft like resourceVersion, uid, etc.)
			base = map[string]interface{}{
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
		}
	}

	// If no existing object, use template with required defaults
	if base == nil {
		base = buildResourceTemplate(gvk, object, namespace)
	}

	// Use JSON merge patch (same as PATCH preview) to merge LLM data onto base
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

// buildResourceTemplate creates a minimal valid template for each Istio resource type
// with all required fields populated with sensible defaults.
func buildResourceTemplate(gvk schema.GroupVersionKind, name, namespace string) map[string]interface{} {
	base := map[string]interface{}{
		"apiVersion": gvk.GroupVersion().String(),
		"kind":       gvk.Kind,
		"metadata": map[string]interface{}{
			"name":      name,
			"namespace": namespace,
		},
	}

	// Add resource-specific required fields with complete, valid examples
	switch {
	case gvk.Group == "networking.istio.io" && gvk.Kind == "Gateway":
		// Complete Gateway example with all required fields
		base["spec"] = map[string]interface{}{
			"selector": map[string]interface{}{
				"istio": "ingressgateway",
			},
			"servers": []interface{}{
				map[string]interface{}{
					"port": map[string]interface{}{
						"number":   80,
						"name":     "http",
						"protocol": "HTTP",
					},
					"hosts": []interface{}{"*"},
				},
			},
		}
	case gvk.Group == "networking.istio.io" && gvk.Kind == "VirtualService":
		base["spec"] = map[string]interface{}{
			"hosts": []interface{}{"*"},
			"http": []interface{}{
				map[string]interface{}{
					"route": []interface{}{
						map[string]interface{}{
							"destination": map[string]interface{}{
								"host": "example",
							},
						},
					},
				},
			},
		}
	case gvk.Group == "networking.istio.io" && gvk.Kind == "DestinationRule":
		base["spec"] = map[string]interface{}{
			"host": "example",
		}
	case gvk.Group == "security.istio.io" && gvk.Kind == "AuthorizationPolicy":
		base["spec"] = map[string]interface{}{
			"action": "ALLOW",
		}
	case gvk.Group == "security.istio.io" && gvk.Kind == "PeerAuthentication":
		base["spec"] = map[string]interface{}{
			"mtls": map[string]interface{}{
				"mode": "STRICT",
			},
		}
	}
	// For other resource types, just return the base (apiVersion, kind, metadata)
	// The LLM should provide a complete spec for those.

	return base
}

// allowedNetworkingIstioKinds are the Istio networking API kinds supported by manage_istio_config.
var allowedNetworkingIstioKinds = map[string]struct{}{
	"VirtualService":  {},
	"DestinationRule": {},
	"Gateway":         {},
	"ServiceEntry":    {},
	"Sidecar":         {},
	"WorkloadEntry":   {},
	"WorkloadGroup":   {},
	"EnvoyFilter":     {},
}

// allowedSecurityIstioKinds are the Istio security API kinds supported by manage_istio_config.
var allowedSecurityIstioKinds = map[string]struct{}{
	"AuthorizationPolicy":   {},
	"PeerAuthentication":    {},
	"RequestAuthentication": {},
}

// validateManagedIstioGroupAndKind ensures group is networking.istio.io or security.istio.io
// and kind is allowed for that API group.
func validateManagedIstioGroupAndKind(group, kind string) error {
	g := strings.TrimSpace(group)
	k := strings.TrimSpace(kind)
	if g == "" {
		return fmt.Errorf(`group is required and must be "networking.istio.io" or "security.istio.io"`)
	}
	if k == "" {
		return fmt.Errorf("kind is required for group %q", g)
	}
	switch g {
	case "networking.istio.io":
		if _, ok := allowedNetworkingIstioKinds[k]; !ok {
			return fmt.Errorf(
				"invalid kind %q for group %q: must be one of VirtualService, DestinationRule, Gateway, ServiceEntry, Sidecar, WorkloadEntry, WorkloadGroup, EnvoyFilter",
				k, g,
			)
		}
		return nil
	case "security.istio.io":
		if _, ok := allowedSecurityIstioKinds[k]; !ok {
			return fmt.Errorf(
				"invalid kind %q for group %q: must be one of AuthorizationPolicy, PeerAuthentication, RequestAuthentication",
				k, g,
			)
		}
		return nil
	default:
		return fmt.Errorf(`invalid group %q: must be "networking.istio.io" or "security.istio.io"`, g)
	}
}

// validateReadOnlyIstioConfigInput validates args for read-only actions (list, get).
func validateReadOnlyIstioConfigInput(args map[string]interface{}) error {
	action := mcputil.GetStringArg(args, "action")
	namespace := mcputil.GetStringArg(args, "namespace")
	group := mcputil.GetStringArg(args, "group")
	version := mcputil.GetStringArg(args, "version")
	kind := mcputil.GetStringArg(args, "kind")
	object := mcputil.GetStringArg(args, "object")
	switch action {
	case "list":
		if strings.TrimSpace(group) != "" || strings.TrimSpace(kind) != "" {
			return validateManagedIstioGroupAndKind(group, kind)
		}
		return nil
	case "get":
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
		if object == "" {
			return fmt.Errorf("name is required for action %q", action)
		}
		return validateManagedIstioGroupAndKind(group, kind)
	default:
		return fmt.Errorf("invalid action %q: must be one of list, get", action)
	}
}

// validateIstioConfigInput centralizes validation rules for manage istio config tool (write actions).
// It also normalizes args: if "object" is missing it falls back to "name" or
// extracts metadata.name from "data", writing the resolved value back into
// args["object"] so downstream code sees it.
func validateIstioConfigInput(args map[string]interface{}) error {
	action := mcputil.GetStringArg(args, "action")
	namespace := mcputil.GetStringArg(args, "namespace")
	group := mcputil.GetStringArg(args, "group")
	version := mcputil.GetStringArg(args, "version")
	kind := mcputil.GetStringArg(args, "kind")
	data := mcputil.GetStringArg(args, "data")
	payload := data

	object := resolveObjectName(args)

	switch action {
	case "create", "patch", "delete":
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
		if action == "create" {
			if strings.TrimSpace(payload) == "" {
				return fmt.Errorf("data is required for action %q", action)
			}
			if object == "" {
				return fmt.Errorf("object (resource name) is required for action %q — set the 'object' parameter or include metadata.name in the data", action)
			}
		}
		if action == "patch" {
			if object == "" {
				return fmt.Errorf("object (resource name) is required for action %q — set the 'object' parameter or include metadata.name in the data", action)
			}
			if strings.TrimSpace(payload) == "" {
				return fmt.Errorf("data is required for action %q", action)
			}
		}
		if action == "delete" {
			if object == "" {
				return fmt.Errorf("object (resource name) is required for action %q — set the 'object' parameter", action)
			}
		}
		return validateManagedIstioGroupAndKind(group, kind)
	default:
		return fmt.Errorf("invalid action %q: must be one of create, patch, delete", action)
	}
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
