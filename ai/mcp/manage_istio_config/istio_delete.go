package manage_istio_config

import (
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
)

func IstioDelete(r *http.Request, args map[string]interface{}, businessLayer *business.Layer, conf *config.Config) (res interface{}, status int) {
	ctx := r.Context()
	cluster := mcputil.GetStringArg(args, "clusterName")
	namespace := mcputil.GetStringArg(args, "namespace")
	group := mcputil.GetStringArg(args, "group")
	version := mcputil.GetStringArg(args, "version")
	kind := mcputil.GetStringArg(args, "kind")
	object := mcputil.GetStringArg(args, "object")

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

	if msg, code := checkNamespaceExists(ctx, businessLayer, namespace, cluster); code != 0 {
		return msg, code
	}

	defer recoverFromPanic(&res, &status, kind, object, namespace)

	// Check if the resource exists before attempting delete.
	// The business layer treats not-found deletes as idempotent no-ops (returns nil),
	// but the chatbot needs to know the resource was never there.
	_, err := businessLayer.IstioConfig.GetIstioConfigDetails(ctx, cluster, namespace, gvk, object)
	if err != nil {
		return classifyError(err, kind, object, namespace)
	}

	err = businessLayer.IstioConfig.DeleteIstioConfigDetail(ctx, cluster, namespace, gvk, object)
	if err != nil {
		return classifyError(err, kind, object, namespace)
	}

	audit(r, "DELETE", namespace, gvk.String(), "Name: ["+object+"]")
	return fmt.Sprintf("Successfully deleted %s %q from namespace %q", gvk.Kind, object, namespace), http.StatusOK
}
