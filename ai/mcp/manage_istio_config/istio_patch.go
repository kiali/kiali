package manage_istio_config

import (
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"

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

	createdConfigDetails, err := businessLayer.IstioConfig.UpdateIstioConfigDetail(r.Context(), cluster, namespace, gvk, object, jsonData)
	if err != nil {
		return err.Error(), http.StatusInternalServerError
	}

	audit(r, "UPDATE", namespace, gvk.String(), "Name: ["+object+"], Patch: "+jsonData)
	return createdConfigDetails, http.StatusOK
}
