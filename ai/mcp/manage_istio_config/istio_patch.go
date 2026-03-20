package manage_istio_config

import (
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

func IstioPatch(r *http.Request, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (res interface{}, status int) {
	cluster, _ := args["cluster"].(string)
	namespace, _ := args["namespace"].(string)
	group, _ := args["group"].(string)
	version, _ := args["version"].(string)
	kind, _ := args["kind"].(string)
	object, _ := args["object"].(string)
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

	if msg, code := checkNamespaceExists(r.Context(), businessLayer, namespace, cluster); code != 0 {
		return msg, code
	}

	patchBytes, err := yaml.YAMLToJSON([]byte(data))
	if err != nil {
		return fmt.Sprintf("Invalid data (must be valid JSON or YAML): %s", err.Error()), http.StatusBadRequest
	}

	// Pre-check: verify the resource exists before attempting the patch.
	_, err = businessLayer.IstioConfig.GetIstioConfigDetails(r.Context(), cluster, namespace, gvk, object)
	if err != nil {
		return classifyError(err, kind, object, namespace)
	}

	defer recoverFromPanic(&res, &status, kind, object, namespace)

	_, err = businessLayer.IstioConfig.UpdateIstioConfigDetail(r.Context(), cluster, namespace, gvk, object, string(patchBytes))
	if err != nil {
		return classifyError(err, kind, object, namespace)
	}

	audit(r, "UPDATE", namespace, gvk.String(), "Name: ["+object+"], Patch: "+data)
	return fmt.Sprintf("Successfully patched %s %q in namespace %q", kind, object, namespace), http.StatusOK
}
