package manage_istio_config

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	api_errors "k8s.io/apimachinery/pkg/api/errors"
	"sigs.k8s.io/yaml"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

func audit(r *http.Request, operation, namespace, gvk, message string) {
	if config.Get().Server.AuditLog {
		user := r.Header.Get("Kiali-User")
		log.FromRequest(r).
			Info().
			Str("operation", operation).
			Str("namespace", namespace).
			Str("gvk", gvk).
			Str("user", user).
			Msgf("AUDIT: %s", message)
	}
}

// checkNamespaceExists verifies that the target namespace exists in the cluster.
// Returns a user-friendly (message, status) tuple if the namespace is missing
// or inaccessible, or ("", 0) when it exists and is accessible.
func checkNamespaceExists(ctx context.Context, businessLayer *business.Layer, namespace, cluster string) (string, int) {
	if errMsg, code := mcputil.ValidateNamespaceAccess(ctx, businessLayer, namespace, cluster); errMsg != "" {
		return errMsg, code
	}
	return "", 0
}

// resolveObjectName tries to determine the resource name from the args map.
// It checks "object" first, and if not found, extracts metadata.name from
// the "data" YAML/JSON payload. If a name is found from data, it is written
// back into args["object"] so that downstream functions can use it consistently.
func resolveObjectName(args map[string]interface{}) string {
	if v, ok := args["object"].(string); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	if data, ok := args["data"].(string); ok && strings.TrimSpace(data) != "" {
		jsonBytes, err := yaml.YAMLToJSON([]byte(data))
		if err == nil {
			var doc map[string]interface{}
			if json.Unmarshal(jsonBytes, &doc) == nil {
				if meta, ok := doc["metadata"].(map[string]interface{}); ok {
					if name, ok := meta["name"].(string); ok && strings.TrimSpace(name) != "" {
						args["object"] = strings.TrimSpace(name)
						return strings.TrimSpace(name)
					}
				}
			}
		}
	}
	return ""
}

// recoverFromPanic catches panics from the business layer (e.g. nil pointer
// dereferences when a K8s API call returns nil + error) and converts them into
// a clean error response instead of crashing.
func recoverFromPanic(res *interface{}, status *int, kind, object, namespace string) {
	if r := recover(); r != nil {
		*res = fmt.Sprintf("Internal error while processing %s %q in namespace %q: %v", kind, object, namespace, r)
		*status = http.StatusInternalServerError
	}
}

// classifyError maps Kubernetes API errors to appropriate HTTP status codes
// and returns a clear message for the chatbot.
func classifyError(err error, kind, object, namespace string) (string, int) {
	switch {
	case api_errors.IsNotFound(err):
		return fmt.Sprintf("Resource not found: %s %q in namespace %q does not exist", kind, object, namespace), http.StatusNotFound
	case api_errors.IsAlreadyExists(err):
		return fmt.Sprintf("Resource already exists: %s %q in namespace %q already exists. Use the 'patch' action to update it.", kind, object, namespace), http.StatusConflict
	case api_errors.IsForbidden(err):
		return fmt.Sprintf("Access denied: you do not have permission to modify %s %q in namespace %q", kind, object, namespace), http.StatusForbidden
	case api_errors.IsConflict(err):
		return fmt.Sprintf("Conflict: %s %q in namespace %q was modified by another process. Try again.", kind, object, namespace), http.StatusConflict
	case api_errors.IsInvalid(err):
		return fmt.Sprintf("Invalid resource: %s", err.Error()), http.StatusBadRequest
	case api_errors.IsBadRequest(err):
		return fmt.Sprintf("Bad request: %s", err.Error()), http.StatusBadRequest
	default:
		return err.Error(), http.StatusInternalServerError
	}
}
