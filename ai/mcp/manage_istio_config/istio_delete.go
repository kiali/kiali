package manage_istio_config

import (
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

func IstioDelete(r *http.Request, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
	ctx := r.Context()
	// Extract parameters
	cluster, _ := args["cluster"].(string)
	namespace, _ := args["namespace"].(string)
	group, _ := args["group"].(string)
	version, _ := args["version"].(string)
	kind, _ := args["kind"].(string)
	object, _ := args["object"].(string)

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

	err := businessLayer.IstioConfig.DeleteIstioConfigDetail(ctx, cluster, namespace, gvk, object)
	if err != nil {
		return err.Error(), http.StatusInternalServerError
	}

	audit(r, "DELETE", namespace, gvk.String(), "Name: ["+object+"]")
	return nil, http.StatusOK
}
