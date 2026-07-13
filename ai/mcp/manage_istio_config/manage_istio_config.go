package manage_istio_config

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
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
	isGatewayAPIEnabled := isGatewayAPIEnabled(kialiInterface, clusterName)
	isInferenceAPIEnabled := isInferenceAPIEnabled(kialiInterface, clusterName)
	if err := validateReadOnlyIstioConfigInput(args, isGatewayAPIEnabled, isInferenceAPIEnabled); err != nil {
		return err.Error(), http.StatusOK
	}
	if action != "list" {
		group := mcputil.GetStringArg(args, "group")
		version := mcputil.GetStringArg(args, "version")
		kind := mcputil.GetStringArg(args, "kind")
		gvk := schema.GroupVersionKind{Group: group, Version: version, Kind: kind}
		if !business.GetIstioAPI(gvk) {
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
		return IstioList(kialiInterface.Request.Context(), args, kialiInterface.BusinessLayer, kialiInterface.Conf, isGatewayAPIEnabled, isInferenceAPIEnabled)
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
	clusterName := mcputil.GetStringOrDefault(args, kialiInterface.Conf.KubernetesConfig.ClusterName, "clusterName")
	isGatewayAPIEnabled := isGatewayAPIEnabled(kialiInterface, clusterName)
	isInferenceAPIEnabled := isInferenceAPIEnabled(kialiInterface, clusterName)

	if action == "list" || action == "get" {
		return "for list and get actions use the manage_istio_config_read tool", http.StatusBadRequest
	}
	if err := validateIstioConfigInput(args, isGatewayAPIEnabled, isInferenceAPIEnabled); err != nil {
		return err.Error(), http.StatusBadRequest
	}

	if action != "list" {
		group := mcputil.GetStringArg(args, "group")
		version := mcputil.GetStringArg(args, "version")
		kind := mcputil.GetStringArg(args, "kind")
		gvk := schema.GroupVersionKind{Group: group, Version: version, Kind: kind}
		if !business.GetIstioAPI(gvk) {
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

	// When data is empty, return the template directly as a complete resource
	if strings.TrimSpace(data) == "" {
		base := buildResourceTemplate(gvk, object, namespace)
		baseYAML, err := yaml.Marshal(base)
		if err != nil {
			return "", err
		}
		return string(baseYAML), nil
	}

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
		// LLM provided a complete document — but if spec is empty/missing,
		// merge onto the template so required fields are populated.
		spec, _ := llmData["spec"].(map[string]interface{})
		if len(spec) > 0 {
			normalized, err := normalizeToYAML(data)
			if err != nil {
				return "", err
			}
			return applyGVKFixups(gvk, normalized)
		}
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

	mergedJSON = applyGVKFixupsJSON(gvk, mergedJSON)

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

// applyGVKFixupsJSON applies GVK-specific corrections to JSON data in-place.
func applyGVKFixupsJSON(gvk schema.GroupVersionKind, data []byte) []byte {
	if gvk.Group == "gateway.networking.k8s.io" && gvk.Kind == "HTTPRoute" {
		data = fixHTTPRoutePathTypes(data)
	}
	if gvk.Group == "inference.networking.k8s.io" && gvk.Kind == "InferencePool" {
		data = fixInferencePoolSpec(data)
	}
	return data
}

// applyGVKFixups applies GVK-specific corrections to a YAML string.
func applyGVKFixups(gvk schema.GroupVersionKind, yamlData string) (string, error) {
	jsonData, err := yaml.YAMLToJSON([]byte(yamlData))
	if err != nil {
		return yamlData, nil
	}
	fixed := applyGVKFixupsJSON(gvk, jsonData)
	fixedYAML, err := yaml.JSONToYAML(fixed)
	if err != nil {
		return yamlData, nil
	}
	return string(fixedYAML), nil
}

// fixHTTPRoutePathTypes corrects common LLM mistakes in HTTPRoute path match types.
// LLMs frequently generate "Prefix" instead of the correct "PathPrefix".
func fixHTTPRoutePathTypes(data []byte) []byte {
	var obj map[string]interface{}
	if err := json.Unmarshal(data, &obj); err != nil {
		return data
	}
	spec, _ := obj["spec"].(map[string]interface{})
	if spec == nil {
		return data
	}
	rules, _ := spec["rules"].([]interface{})
	for _, r := range rules {
		rule, _ := r.(map[string]interface{})
		if rule == nil {
			continue
		}
		matches, _ := rule["matches"].([]interface{})
		for _, m := range matches {
			match, _ := m.(map[string]interface{})
			if match == nil {
				continue
			}
			path, _ := match["path"].(map[string]interface{})
			if path == nil {
				continue
			}
			if t, ok := path["type"].(string); ok && t == "Prefix" {
				path["type"] = "PathPrefix"
			}
		}
	}
	fixed, err := json.Marshal(obj)
	if err != nil {
		return data
	}
	return fixed
}

// fixInferencePoolSpec corrects common LLM mistakes in InferencePool specs.
// LLMs frequently produce the deprecated flat format instead of the required v1 structure:
//   - "targetPortNumber" (int) → "targetPorts" (array of {number: int})
//   - flat "selector: {app: x}" → "selector: {matchLabels: {app: x}}"
//   - missing "endpointPickerRef" → adds default
func fixInferencePoolSpec(data []byte) []byte {
	var obj map[string]interface{}
	if err := json.Unmarshal(data, &obj); err != nil {
		return data
	}
	spec, _ := obj["spec"].(map[string]interface{})
	if spec == nil {
		return data
	}

	// Fix targetPortNumber → targetPorts
	if portNum, ok := spec["targetPortNumber"]; ok {
		delete(spec, "targetPortNumber")
		if num, ok := portNum.(float64); ok {
			spec["targetPorts"] = []interface{}{map[string]interface{}{"number": num}}
		}
	}
	if spec["targetPorts"] == nil {
		spec["targetPorts"] = []interface{}{map[string]interface{}{"number": float64(8000)}}
	}

	// Fix flat selector → selector.matchLabels
	if sel, ok := spec["selector"].(map[string]interface{}); ok {
		if _, hasMatchLabels := sel["matchLabels"]; !hasMatchLabels {
			spec["selector"] = map[string]interface{}{"matchLabels": sel}
		}
	}

	// Ensure endpointPickerRef exists
	if spec["endpointPickerRef"] == nil {
		spec["endpointPickerRef"] = map[string]interface{}{
			"group":       "",
			"kind":        "Service",
			"name":        "example-model-epp",
			"port":        map[string]interface{}{"number": float64(9002)},
			"failureMode": "FailClose",
		}
	}

	fixed, err := json.Marshal(obj)
	if err != nil {
		return data
	}
	return fixed
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
	case gvk.Group == "gateway.networking.k8s.io" && gvk.Kind == "Gateway":
		base["spec"] = map[string]interface{}{
			"gatewayClassName": "istio",
			"listeners": []interface{}{
				map[string]interface{}{
					"name":     "http",
					"port":     80,
					"protocol": "HTTP",
				},
			},
		}
	case gvk.Group == "gateway.networking.k8s.io" && gvk.Kind == "HTTPRoute":
		base["spec"] = map[string]interface{}{
			"parentRefs": []interface{}{
				map[string]interface{}{
					"name": "example-gateway",
				},
			},
			"rules": []interface{}{
				map[string]interface{}{
					"matches": []interface{}{
						map[string]interface{}{
							"path": map[string]interface{}{
								"type":  "PathPrefix",
								"value": "/",
							},
						},
					},
					"backendRefs": []interface{}{
						map[string]interface{}{
							"name": "example",
							"port": 80,
						},
					},
				},
			},
		}
	case gvk.Group == "inference.networking.k8s.io" && gvk.Kind == "InferencePool":
		base["spec"] = map[string]interface{}{
			"targetPorts": []interface{}{
				map[string]interface{}{
					"number": 8000,
				},
			},
			"selector": map[string]interface{}{
				"matchLabels": map[string]interface{}{
					"app": "example-model",
				},
			},
			"endpointPickerRef": map[string]interface{}{
				"group": "",
				"kind":  "Service",
				"name":  "example-model-epp",
				"port": map[string]interface{}{
					"number": 9002,
				},
				"failureMode": "FailClose",
			},
		}
	}

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

// allowedGatewayAPIKinds are the Gateway API kinds supported when Gateway API CRDs are installed.
var allowedGatewayAPIKinds = map[string]struct{}{
	"Gateway":        {},
	"GRPCRoute":      {},
	"HTTPRoute":      {},
	"ReferenceGrant": {},
	"TCPRoute":       {},
	"TLSRoute":       {},
}

// allowedInferenceAPIKinds are the Inference API kinds supported when inference.networking.k8s.io CRDs are installed.
var allowedInferenceAPIKinds = map[string]struct{}{
	"InferencePool": {},
}

// inferGroupFromKind attempts to resolve the API group from the kind alone.
// Returns the group if the kind unambiguously belongs to one group, or "" if ambiguous
// (e.g. "Gateway" exists in both networking.istio.io and gateway.networking.k8s.io).
func inferGroupFromKind(kind string, isGatewayAPIEnabled, isInferenceAPIEnabled bool) string {
	if _, ok := allowedSecurityIstioKinds[kind]; ok {
		return "security.istio.io"
	}
	if _, ok := allowedInferenceAPIKinds[kind]; ok && isInferenceAPIEnabled {
		return "inference.networking.k8s.io"
	}
	inNetworking := false
	if _, ok := allowedNetworkingIstioKinds[kind]; ok {
		inNetworking = true
	}
	inGatewayAPI := false
	if _, ok := allowedGatewayAPIKinds[kind]; ok && isGatewayAPIEnabled {
		inGatewayAPI = true
	}
	if inNetworking && !inGatewayAPI {
		return "networking.istio.io"
	}
	if inGatewayAPI && !inNetworking {
		return "gateway.networking.k8s.io"
	}
	return ""
}

// validateManagedIstioGroupAndKind ensures group is networking.istio.io, security.istio.io,
// (when Gateway API is discovered) gateway.networking.k8s.io, or (when Inference API is
// discovered) inference.networking.k8s.io, and kind is allowed for that group.
// When group is empty but kind is unambiguous, the group is inferred automatically.
// The variadic flags parameter accepts: [0] = isGatewayAPIEnabled, [1] = isInferenceAPIEnabled.
func validateManagedIstioGroupAndKind(group, kind string, flags ...bool) error {
	g := strings.TrimSpace(group)
	k := strings.TrimSpace(kind)
	isGatewayAPIEnabled := len(flags) > 0 && flags[0]
	isInferenceAPIEnabled := len(flags) > 1 && flags[1]
	if g == "" && k != "" {
		if inferred := inferGroupFromKind(k, isGatewayAPIEnabled, isInferenceAPIEnabled); inferred != "" {
			g = inferred
		}
	}
	if g == "" {
		groups := []string{`"networking.istio.io"`, `"security.istio.io"`}
		if isGatewayAPIEnabled {
			groups = append(groups, `"gateway.networking.k8s.io"`)
		}
		if isInferenceAPIEnabled {
			groups = append(groups, `"inference.networking.k8s.io"`)
		}
		return fmt.Errorf("group is required and must be %s", strings.Join(groups, ", "))
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
	case "gateway.networking.k8s.io":
		if !isGatewayAPIEnabled {
			return fmt.Errorf(`invalid group %q: Gateway API CRDs are not installed on the cluster`, g)
		}
		if _, ok := allowedGatewayAPIKinds[k]; !ok {
			return fmt.Errorf(
				"invalid kind %q for group %q: must be one of Gateway, HTTPRoute, GRPCRoute, ReferenceGrant, TCPRoute, TLSRoute",
				k, g,
			)
		}
		return nil
	case "inference.networking.k8s.io":
		if !isInferenceAPIEnabled {
			return fmt.Errorf(`invalid group %q: Inference API CRDs are not installed on the cluster`, g)
		}
		if _, ok := allowedInferenceAPIKinds[k]; !ok {
			return fmt.Errorf(
				"invalid kind %q for group %q: must be InferencePool",
				k, g,
			)
		}
		return nil
	default:
		groups := []string{`"networking.istio.io"`, `"security.istio.io"`}
		if isGatewayAPIEnabled {
			groups = append(groups, `"gateway.networking.k8s.io"`)
		}
		if isInferenceAPIEnabled {
			groups = append(groups, `"inference.networking.k8s.io"`)
		}
		return fmt.Errorf("invalid group %q: must be %s", g, strings.Join(groups, ", "))
	}
}

// readableGroupKinds lists all API groups and their kinds that manage_istio_config_read supports.
// This is a superset of the write tool (which only covers networking/security.istio.io).
var readableGroupKinds = map[string]map[string]struct{}{
	"networking.istio.io": {
		"VirtualService":  {},
		"DestinationRule": {},
		"Gateway":         {},
		"ServiceEntry":    {},
		"Sidecar":         {},
		"WorkloadEntry":   {},
		"WorkloadGroup":   {},
		"EnvoyFilter":     {},
	},
	"security.istio.io": {
		"AuthorizationPolicy":   {},
		"PeerAuthentication":    {},
		"RequestAuthentication": {},
	},
	"gateway.networking.k8s.io": {
		"Gateway":        {},
		"HTTPRoute":      {},
		"GRPCRoute":      {},
		"TCPRoute":       {},
		"TLSRoute":       {},
		"UDPRoute":       {},
		"ReferenceGrant": {},
	},
	"inference.networking.k8s.io": {
		"InferencePool": {},
	},
	"extensions.istio.io": {
		"WasmPlugin":       {},
		"TrafficExtension": {},
	},
	"telemetry.istio.io": {
		"Telemetry": {},
	},
}

// validateReadableGroupAndKind checks that the group/kind combination is supported
// by the read-only tool.
func validateReadableGroupAndKind(group, kind string) error {
	g := strings.TrimSpace(group)
	k := strings.TrimSpace(kind)
	kinds, ok := readableGroupKinds[g]
	if !ok {
		return fmt.Errorf("invalid group %q: not a supported Istio or Gateway API group", g)
	}
	if k == "" {
		return fmt.Errorf("kind is required for group %q", g)
	}
	if _, ok := kinds[k]; !ok {
		validKinds := make([]string, 0, len(kinds))
		for k := range kinds {
			validKinds = append(validKinds, k)
		}
		sort.Strings(validKinds)
		return fmt.Errorf("invalid kind %q for group %q: must be one of %s", k, g, strings.Join(validKinds, ", "))
	}
	return nil
}

// validateReadOnlyIstioConfigInput validates args for read-only actions (list, get).
// The variadic flags parameter accepts: [0] = isGatewayAPIEnabled, [1] = isInferenceAPIEnabled.
func validateReadOnlyIstioConfigInput(args map[string]interface{}, flags ...bool) error {
	action := mcputil.GetStringArg(args, "action")
	namespace := mcputil.GetStringArg(args, "namespace")
	group := mcputil.GetStringArg(args, "group")
	version := mcputil.GetStringArg(args, "version")
	kind := mcputil.GetStringArg(args, "kind")
	object := mcputil.GetStringArg(args, "object")
	switch action {
	case "list":
		hasGroup := strings.TrimSpace(group) != ""
		hasKind := strings.TrimSpace(kind) != ""
		if !hasGroup && !hasKind {
			return nil
		}
		if hasKind && !hasGroup {
			isGatewayAPIEnabled := len(flags) > 0 && flags[0]
			isInferenceAPIEnabled := len(flags) > 1 && flags[1]
			inferred := inferGroupFromKind(kind, isGatewayAPIEnabled, isInferenceAPIEnabled)
			if inferred != "" {
				return validateReadableGroupAndKind(inferred, kind)
			}
			return fmt.Errorf("group is required when kind is specified for action %q", action)
		}
		if hasGroup && !hasKind {
			return fmt.Errorf("kind is required when group is specified for action %q", action)
		}
		return validateReadableGroupAndKind(group, kind)
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
		return validateReadableGroupAndKind(group, kind)
	default:
		return fmt.Errorf("invalid action %q: must be one of list, get", action)
	}
}

// validateIstioConfigInput centralizes validation rules for manage istio config tool (write actions).
// It also normalizes args: if "object" is missing it falls back to "name" or
// extracts metadata.name from "data", writing the resolved value back into
// args["object"] so downstream code sees it.
// The variadic flags parameter accepts: [0] = isGatewayAPIEnabled, [1] = isInferenceAPIEnabled.
func validateIstioConfigInput(args map[string]interface{}, flags ...bool) error {
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
		return validateManagedIstioGroupAndKind(group, kind, flags...)
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
