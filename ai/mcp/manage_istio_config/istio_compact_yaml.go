package manage_istio_config

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/kubernetes"
)

func compactIstioConfigAsYAML(
	virtualServices []*networking_v1.VirtualService,
	destinationRules []*networking_v1.DestinationRule,
	gateways []*networking_v1.Gateway,
	warnings []string,
) (string, error) {
	docs := []string{}

	for _, w := range warnings {
		// Keep warnings as YAML comments (low token cost, useful for debugging missing refs).
		if strings.TrimSpace(w) != "" {
			docs = append(docs, "# "+strings.TrimSpace(w))
		}
	}

	for _, vs := range virtualServices {
		doc, err := compactRuntimeObjectYAML(vs, kubernetes.VirtualServices)
		if err != nil {
			return "", err
		}
		docs = append(docs, doc)
	}
	for _, dr := range destinationRules {
		doc, err := compactRuntimeObjectYAML(dr, kubernetes.DestinationRules)
		if err != nil {
			return "", err
		}
		docs = append(docs, doc)
	}
	for _, gw := range gateways {
		doc, err := compactRuntimeObjectYAML(gw, kubernetes.Gateways)
		if err != nil {
			return "", err
		}
		docs = append(docs, doc)
	}

	out := strings.Join(docs, "\n---\n")
	if out != "" && !strings.HasSuffix(out, "\n") {
		out += "\n"
	}
	return out, nil
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

func normalizeToYAML(jsonOrYAML string) (string, error) {
	// Accept JSON or YAML; JSON is valid YAML, but YAMLToJSON normalizes either.
	jsonBytes, err := yaml.YAMLToJSON([]byte(jsonOrYAML))
	if err != nil {
		return "", err
	}

	var v interface{}
	if err := json.Unmarshal(jsonBytes, &v); err != nil {
		return "", err
	}

	yml, err := yaml.Marshal(v)
	if err != nil {
		return "", err
	}
	if len(yml) > 0 && yml[len(yml)-1] != '\n' {
		yml = append(yml, '\n')
	}
	return string(yml), nil
}

func stubManifestYAML(apiVersion, kind, name, namespace string) string {
	m := map[string]interface{}{
		"apiVersion": strings.TrimSpace(apiVersion),
		"kind":       strings.TrimSpace(kind),
		"metadata": map[string]interface{}{
			"name":      strings.TrimSpace(name),
			"namespace": strings.TrimSpace(namespace),
		},
	}
	b, err := yaml.Marshal(m)
	if err != nil {
		return ""
	}
	if len(b) > 0 && b[len(b)-1] != '\n' {
		b = append(b, '\n')
	}
	return string(b)
}

func filterGatewaysReferencedByVirtualServices(
	ctx context.Context,
	businessLayer *business.Layer,
	cluster string,
	virtualServices []*networking_v1.VirtualService,
	gatewaysInNamespace []*networking_v1.Gateway,
) ([]*networking_v1.Gateway, []string) {
	warnings := []string{}

	// Collect gateway refs from VS.
	type gwRef struct {
		Namespace string
		Name      string
	}
	refs := map[gwRef]struct{}{}
	for _, vs := range virtualServices {
		if vs == nil {
			continue
		}
		for _, gw := range vs.Spec.Gateways {
			gw = strings.TrimSpace(gw)
			if gw == "" || gw == "mesh" {
				continue
			}
			refNS := vs.Namespace
			refName := gw
			if parts := strings.Split(gw, "/"); len(parts) == 2 {
				refNS = strings.TrimSpace(parts[0])
				refName = strings.TrimSpace(parts[1])
			}
			if refNS == "" || refName == "" {
				continue
			}
			refs[gwRef{Namespace: refNS, Name: refName}] = struct{}{}
		}
	}

	// Index already-fetched gateways in the current namespace list.
	byNSName := map[gwRef]*networking_v1.Gateway{}
	for _, gw := range gatewaysInNamespace {
		if gw == nil {
			continue
		}
		byNSName[gwRef{Namespace: gw.Namespace, Name: gw.Name}] = gw
	}

	// Resolve refs, fetching cross-namespace gateways on-demand.
	out := []*networking_v1.Gateway{}
	for ref := range refs {
		if gw, ok := byNSName[ref]; ok {
			out = append(out, gw)
			continue
		}

		details, err := businessLayer.IstioConfig.GetIstioConfigDetails(ctx, cluster, ref.Namespace, kubernetes.Gateways, ref.Name)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("warning: failed to fetch referenced Gateway %s/%s: %v", ref.Namespace, ref.Name, err))
			continue
		}
		if details.Gateway != nil {
			out = append(out, details.Gateway)
		}
	}

	// Stable ordering (helps diffs, reduces “randomness” for the model).
	sort.Slice(out, func(i, j int) bool {
		if out[i].Namespace != out[j].Namespace {
			return out[i].Namespace < out[j].Namespace
		}
		return out[i].Name < out[j].Name
	})
	sort.Strings(warnings)
	return out, warnings
}
