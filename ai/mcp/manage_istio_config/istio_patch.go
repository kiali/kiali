package manage_istio_config

import (
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

func IstioPatch(r *http.Request, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
	// Extract parameters
	cluster, _ := args["cluster"].(string)
	namespace, _ := args["namespace"].(string)
	group, _ := args["group"].(string)
	version, _ := args["version"].(string)
	kind, _ := args["kind"].(string)
	object, _ := args["object"].(string)
	jsonData, _ := args["json_data"].(string)

	if cluster == "" {
		cluster = conf.KubernetesConfig.ClusterName
	}

	gvk := schema.GroupVersionKind{
		Group:   group,
		Version: version,
		Kind:    kind,
	}

	if !business.GetIstioAPI(gvk) {
		return fmt.Sprintf("Object type not managed: %s", gvk.String()), http.StatusBadRequest
	}

	// Accept either JSON or YAML input (normalized to JSON for merge patch).
	patchBytes, err := yaml.YAMLToJSON([]byte(jsonData))
	if err != nil {
		return fmt.Sprintf("Invalid json_data (must be valid JSON or YAML): %s", err.Error()), http.StatusBadRequest
	}

	createdConfigDetails, err := businessLayer.IstioConfig.UpdateIstioConfigDetail(r.Context(), cluster, namespace, gvk, object, string(patchBytes))
	if err != nil {
		return err.Error(), http.StatusInternalServerError
	}

	audit(r, "UPDATE", namespace, gvk.String(), "Name: ["+object+"], Patch: "+jsonData)
	return createdConfigDetails, http.StatusOK
}
