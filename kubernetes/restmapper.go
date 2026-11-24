package kubernetes

import (
	"net/http"
	"slices"
	"time"

	meta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
	"sigs.k8s.io/controller-runtime/pkg/client/apiutil"
)

// staticNamespacedMappings are the core v1 types Kiali passes in the controller-runtime cache's
// ByObject option (see cmd.cacheTransforms). cache.New resolves whether every ByObject type is
// namespaced at construction time, which forces the lazy RESTMapper's first discovery round trip
// - the very call that fails against a remote with invalid credentials. These types are
// scheme-known and unambiguously namespaced, so the mapper can answer for them without
// contacting the server and construction succeeds regardless of remote reachability.
var staticNamespacedMappings = map[schema.GroupKind]string{
	{Group: "", Kind: "Pod"}:     "pods",
	{Group: "", Kind: "Service"}: "services",
}

// IsStaticallyMapped reports whether the mapper answers the GroupKind without a discovery round
// trip. Used by tests to keep this set in sync with the ByObject option in cmd.cacheTransforms.
func IsStaticallyMapped(gk schema.GroupKind) bool {
	_, found := staticNamespacedMappings[gk]
	return found
}

// NewStaticFallbackMapper returns a RESTMapper that answers core v1 Pod and Service lookups
// statically (no server contact) and delegates everything else to controller-runtime's lazy
// dynamic RESTMapper, built with a discovery client whose round trips are bounded by
// discoveryTimeout. It is meant to be used as the cluster.Options MapperProvider for remote
// clusters: it keeps cluster.New from requiring a reachable, credentialed API server at
// construction while bounding the lazy discovery that happens later, on first use.
//
// The httpClient argument is ignored: the mapper needs its own client, built from a copy of the
// config with a request timeout, which the caller-provided client (shared with the informers)
// must not carry because it would kill long watches. The discoveryTimeout argument bounds each
// discovery round trip (kiali_internal.kubernetes_client.discovery_timeout): discovery calls
// take no caller context and would otherwise hang for the kernel TCP timeout against a
// connected-but-stalled cluster. A request timeout is safe here because discovery involves no
// watches; <= 0 disables the bound.
func NewStaticFallbackMapper(config *rest.Config, _ *http.Client, discoveryTimeout time.Duration) (meta.RESTMapper, error) {
	discoveryConfig := rest.CopyConfig(config)
	discoveryConfig.Timeout = discoveryTimeout
	httpClient, err := rest.HTTPClientFor(discoveryConfig)
	if err != nil {
		return nil, err
	}

	delegate, err := apiutil.NewDynamicRESTMapper(discoveryConfig, httpClient)
	if err != nil {
		return nil, err
	}

	return &staticFallbackMapper{delegate: delegate}, nil
}

// staticFallbackMapper answers the statically known core types itself and delegates the rest.
type staticFallbackMapper struct {
	delegate meta.RESTMapper
}

// staticMapping returns the v1 mapping for a statically known GroupKind, and whether it is one.
func staticMapping(gk schema.GroupKind, versions []string) (*meta.RESTMapping, bool) {
	resource, known := staticNamespacedMappings[gk]
	if !known {
		return nil, false
	}
	// The static answer only covers v1, the sole version these core types have ever had. An
	// empty version list or one containing v1 is answered statically; any other requested
	// version falls through to the delegate rather than guessing.
	if len(versions) > 0 && !slices.Contains(versions, "v1") {
		return nil, false
	}
	return &meta.RESTMapping{
		Resource:         schema.GroupVersionResource{Group: gk.Group, Version: "v1", Resource: resource},
		GroupVersionKind: schema.GroupVersionKind{Group: gk.Group, Version: "v1", Kind: gk.Kind},
		Scope:            meta.RESTScopeNamespace,
	}, true
}

func (m *staticFallbackMapper) RESTMapping(gk schema.GroupKind, versions ...string) (*meta.RESTMapping, error) {
	if mapping, ok := staticMapping(gk, versions); ok {
		return mapping, nil
	}
	return m.delegate.RESTMapping(gk, versions...)
}

func (m *staticFallbackMapper) RESTMappings(gk schema.GroupKind, versions ...string) ([]*meta.RESTMapping, error) {
	if mapping, ok := staticMapping(gk, versions); ok {
		return []*meta.RESTMapping{mapping}, nil
	}
	return m.delegate.RESTMappings(gk, versions...)
}

func (m *staticFallbackMapper) KindFor(input schema.GroupVersionResource) (schema.GroupVersionKind, error) {
	return m.delegate.KindFor(input)
}

func (m *staticFallbackMapper) KindsFor(input schema.GroupVersionResource) ([]schema.GroupVersionKind, error) {
	return m.delegate.KindsFor(input)
}

func (m *staticFallbackMapper) ResourcesFor(input schema.GroupVersionResource) ([]schema.GroupVersionResource, error) {
	return m.delegate.ResourcesFor(input)
}

func (m *staticFallbackMapper) ResourceFor(input schema.GroupVersionResource) (schema.GroupVersionResource, error) {
	return m.delegate.ResourceFor(input)
}

func (m *staticFallbackMapper) ResourceSingularizer(resource string) (string, error) {
	return m.delegate.ResourceSingularizer(resource)
}
