package manage_istio_config

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

func IstioGet(ctx context.Context, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (interface{}, int) {
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

	istioConfigDetails, err := businessLayer.IstioConfig.GetIstioConfigDetails(ctx, cluster, namespace, gvk, object)
	if err != nil {
		return err.Error(), http.StatusInternalServerError
	}

	// Reduce tool verbosity: return a compact YAML representation of the resource only.
	// (No validations/references/help fields; those add significant token usage.)
	obj := istioConfigDetails.Object
	if obj == nil {
		return fmt.Sprintf("No object returned for %s/%s/%s %s in namespace %s", group, version, kind, object, namespace), http.StatusInternalServerError
	}

	yml, yErr := compactRuntimeObjectYAML(obj, gvk)
	if yErr != nil {
		return fmt.Sprintf("Error while rendering istio config as YAML: %s", yErr.Error()), http.StatusInternalServerError
	}

	return "~~~\n" + yml + "~~~\n", http.StatusOK
}
