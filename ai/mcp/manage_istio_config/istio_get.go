package manage_istio_config

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"

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

func compactRuntimeObjectYAML(obj runtime.Object, fallbackGVK schema.GroupVersionKind) (string, error) {
	if obj == nil {
		return "", fmt.Errorf("nil object")
	}

	typeAccessor, _ := meta.TypeAccessor(obj)
	objAccessor, _ := meta.Accessor(obj)

	apiVersion := ""
	kind := ""
	if typeAccessor != nil {
		apiVersion = typeAccessor.GetAPIVersion()
		kind = typeAccessor.GetKind()
	}
	if apiVersion == "" {
		apiVersion = fallbackGVK.GroupVersion().String()
	}
	if kind == "" {
		kind = fallbackGVK.Kind
	}

	name := ""
	namespace := ""
	if objAccessor != nil {
		name = objAccessor.GetName()
		namespace = objAccessor.GetNamespace()
	}

	// Convert to generic map to reliably extract spec and avoid large metadata.
	u, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return "", err
	}

	out := map[string]interface{}{
		"apiVersion": apiVersion,
		"kind":       kind,
		"metadata": map[string]interface{}{
			"name":      name,
			"namespace": namespace,
		},
	}
	if spec, ok := u["spec"]; ok {
		out["spec"] = spec
	}

	b, err := yaml.Marshal(out)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
