package manage_istio_config

import (
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

func IstioCreate(r *http.Request, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (res interface{}, status int) {
	cluster := mcputil.GetStringArg(args, "clusterName")
	namespace := mcputil.GetStringArg(args, "namespace")
	group := mcputil.GetStringArg(args, "group")
	version := mcputil.GetStringArg(args, "version")
	kind := mcputil.GetStringArg(args, "kind")
	object := mcputil.GetStringArg(args, "object")
	data := mcputil.GetStringArg(args, "data")

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

	body, err := yaml.YAMLToJSON([]byte(data))
	if err != nil {
		return fmt.Sprintf("Invalid data (must be valid JSON or YAML): %s", err.Error()), http.StatusBadRequest
	}

	// Pre-check: if the resource already exists, return a clear 409 instead of
	// letting the business layer panic on the nil pointer after a failed Create.
	if object != "" {
		if _, getErr := businessLayer.IstioConfig.GetIstioConfigDetails(r.Context(), cluster, namespace, gvk, object); getErr == nil {
			return fmt.Sprintf("Resource already exists: %s %q in namespace %q already exists. Use the 'patch' action to update it.", kind, object, namespace), http.StatusConflict
		}
	}

	defer recoverFromPanic(&res, &status, kind, object, namespace)

	_, err = businessLayer.IstioConfig.CreateIstioConfigDetail(r.Context(), cluster, namespace, gvk, body)
	if err != nil {
		return classifyError(err, kind, object, namespace)
	}
	audit(r, "CREATE", namespace, gvk.String(), "Object: "+data)
	return fmt.Sprintf("Successfully created %s %q in namespace %q", kind, object, namespace), http.StatusOK
}
