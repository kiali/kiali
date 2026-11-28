package kubernetes

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	meta "k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
)

// countingDelegate records delegated calls so tests can tell static answers from delegation.
type countingDelegate struct {
	requests atomic.Int64
	answers  map[schema.GroupKind]error
}

func (d *countingDelegate) RESTMapping(gk schema.GroupKind, versions ...string) (*meta.RESTMapping, error) {
	d.requests.Add(1)
	if err, found := d.answers[gk]; found {
		return nil, err
	}
	return &meta.RESTMapping{
		Resource:         schema.GroupVersionResource{Group: gk.Group, Version: "v1", Resource: "deployments"},
		GroupVersionKind: schema.GroupVersionKind{Group: gk.Group, Version: "v1", Kind: gk.Kind},
		Scope:            meta.RESTScopeNamespace,
	}, nil
}

func (d *countingDelegate) RESTMappings(gk schema.GroupKind, versions ...string) ([]*meta.RESTMapping, error) {
	mapping, err := d.RESTMapping(gk, versions...)
	if err != nil {
		return nil, err
	}
	return []*meta.RESTMapping{mapping}, nil
}

func (d *countingDelegate) KindFor(input schema.GroupVersionResource) (schema.GroupVersionKind, error) {
	d.requests.Add(1)
	return schema.GroupVersionKind{}, &meta.NoKindMatchError{}
}

func (d *countingDelegate) KindsFor(input schema.GroupVersionResource) ([]schema.GroupVersionKind, error) {
	d.requests.Add(1)
	return nil, &meta.NoKindMatchError{}
}

func (d *countingDelegate) ResourcesFor(input schema.GroupVersionResource) ([]schema.GroupVersionResource, error) {
	d.requests.Add(1)
	return nil, &meta.NoResourceMatchError{}
}

func (d *countingDelegate) ResourceFor(input schema.GroupVersionResource) (schema.GroupVersionResource, error) {
	d.requests.Add(1)
	return schema.GroupVersionResource{}, &meta.NoResourceMatchError{}
}

func (d *countingDelegate) ResourceSingularizer(resource string) (string, error) {
	d.requests.Add(1)
	return resource, nil
}

func TestStaticFallbackMapperAnswersCoreTypesWithoutServer(t *testing.T) {
	// A server that fails the test if the mapper ever contacts it: the whole point of the
	// static answers is that cluster.New succeeds without a reachable remote.
	var requests atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	config := &rest.Config{Host: server.URL}
	mapper, err := NewStaticFallbackMapper(config, nil, 10*time.Second)
	if err != nil {
		t.Fatalf("NewStaticFallbackMapper should succeed without contacting the server: %v", err)
	}

	for _, gk := range []schema.GroupKind{{Group: "", Kind: "Pod"}, {Group: "", Kind: "Service"}} {
		mapping, err := mapper.RESTMapping(gk, "v1")
		if err != nil {
			t.Fatalf("RESTMapping(%v) failed: %v", gk, err)
		}
		if mapping.Scope.Name() != meta.RESTScopeNameNamespace {
			t.Errorf("RESTMapping(%v) scope = %q, want namespace", gk, mapping.Scope.Name())
		}
		if mapping.Resource.Version != "v1" {
			t.Errorf("RESTMapping(%v) resource version = %q, want v1", gk, mapping.Resource.Version)
		}
	}

	if got := requests.Load(); got != 0 {
		t.Errorf("static mapper contacted the server %d times, want 0", got)
	}
}

func TestStaticFallbackMapperAnswersPluralAndEmptyVersions(t *testing.T) {
	mapper := &staticFallbackMapper{delegate: &countingDelegate{}}

	mappings, err := mapper.RESTMappings(schema.GroupKind{Group: "", Kind: "Pod"})
	if err != nil {
		t.Fatalf("RESTMappings(Pod) failed: %v", err)
	}
	if len(mappings) != 1 || mappings[0].Resource.Resource != "pods" {
		t.Errorf("RESTMappings(Pod) = %+v, want one mapping to pods", mappings)
	}

	mapping, err := mapper.RESTMapping(schema.GroupKind{Group: "", Kind: "Service"})
	if err != nil {
		t.Fatalf("RESTMapping(Service) with no version failed: %v", err)
	}
	if mapping.Resource.Resource != "services" {
		t.Errorf("RESTMapping(Service) resource = %q, want services", mapping.Resource.Resource)
	}
}

func TestStaticFallbackMapperDelegatesUnknownKinds(t *testing.T) {
	delegate := &countingDelegate{}
	mapper := &staticFallbackMapper{delegate: delegate}

	// A non-static kind goes to the delegate, whatever the version.
	mapping, err := mapper.RESTMapping(schema.GroupKind{Group: "apps", Kind: "Deployment"}, "v1")
	if err != nil {
		t.Fatalf("RESTMapping(Deployment) failed: %v", err)
	}
	if mapping.GroupVersionKind.Kind != "Deployment" {
		t.Errorf("RESTMapping(Deployment) = %+v, want the delegate's answer", mapping)
	}

	// A static kind with a non-v1 version falls through to the delegate rather than guessing.
	if _, err := mapper.RESTMapping(schema.GroupKind{Group: "", Kind: "Pod"}, "v2"); err != nil {
		t.Fatalf("RESTMapping(Pod, v2) failed: %v", err)
	}

	// KindFor is never answered statically: it delegates.
	if _, err := mapper.KindFor(schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"}); err == nil {
		t.Error("KindFor(pods) should delegate (and the delegate errors)")
	}

	if got := delegate.requests.Load(); got != 3 {
		t.Errorf("delegate called %d times, want 3", got)
	}
}
