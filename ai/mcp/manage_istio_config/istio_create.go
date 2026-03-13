package manage_istio_config

import (
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

func IstioCreate(r *http.Request, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
	// Extract parameters
	cluster, _ := args["cluster"].(string)
	namespace, _ := args["namespace"].(string)
	group, _ := args["group"].(string)
	version, _ := args["version"].(string)
	kind, _ := args["kind"].(string)
	data, _ := args["data"].(string)

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

	// Accept either JSON or YAML input.
	body, err := yaml.YAMLToJSON([]byte(data))
	if err != nil {
		return fmt.Sprintf("Invalid data (must be valid JSON or YAML): %s", err.Error()), http.StatusBadRequest
	}
	createdConfigDetails, err := businessLayer.IstioConfig.CreateIstioConfigDetail(r.Context(), cluster, namespace, gvk, body)
	if err != nil {
		return err.Error(), http.StatusInternalServerError
	}
	audit(r, "CREATE", namespace, gvk.String(), "Object: "+data)
	return createdConfigDetails, http.StatusOK
}
