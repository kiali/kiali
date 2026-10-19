package models_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	meshapi "istio.io/api/mesh/v1alpha1"

	"github.com/kiali/kiali/models"
)

func TestServiceEntryVisibility(t *testing.T) {
	tests := []struct {
		ambient    bool
		definition string
		exportTo   []string
		mesh       *meshapi.MeshConfig
		name       string
		requester  string
		visible    bool
	}{
		{name: "no mesh config preserves public default", requester: "client", visible: true},
		{name: "explicit export remains private", definition: "definitions", exportTo: []string{"."}, requester: "client"},
		{name: "mesh export default remains private", definition: "definitions", mesh: &meshapi.MeshConfig{DefaultServiceExportTo: []string{"."}}, requester: "client"},
		{name: "ambient without policy preserves legacy export", ambient: true, requester: "client", visible: true},
		{name: "sidecar ignores ceiling without opt in", definition: "definitions", mesh: visibilityMesh(meshapi.ServiceEntryVisibility_NAMESPACE, false), requester: "client", visible: true},
		{name: "ambient honors ceiling", ambient: true, definition: "definitions", mesh: visibilityMesh(meshapi.ServiceEntryVisibility_NAMESPACE, false), requester: "client"},
		{name: "sidecar only deployment honors ceiling", definition: "definitions", exportTo: []string{"*"}, mesh: visibilityMesh(meshapi.ServiceEntryVisibility_NAMESPACE, true), requester: "client"},
		{name: "namespace ceiling allows definition namespace", definition: "definitions", mesh: visibilityMesh(meshapi.ServiceEntryVisibility_NAMESPACE, true), requester: "definitions", visible: true},
		{name: "namespace ceiling cannot widen explicit export", definition: "definitions", exportTo: []string{"client"}, mesh: visibilityMesh(meshapi.ServiceEntryVisibility_NAMESPACE, true), requester: "definitions"},
		{name: "none hides even locally", ambient: true, definition: "definitions", mesh: visibilityMesh(meshapi.ServiceEntryVisibility_NONE, false), requester: "definitions"},
		{name: "public cannot widen explicit export", definition: "definitions", exportTo: []string{"."}, mesh: visibilityMesh(meshapi.ServiceEntryVisibility_PUBLIC, true), requester: "client"},
		{name: "public cannot widen mesh export default", definition: "definitions", mesh: &meshapi.MeshConfig{DefaultServiceExportTo: []string{"."}, ServiceEntryVisibility: &meshapi.ServiceEntryVisibility{ApplyToSidecars: true, DefaultVisibility: meshapi.ServiceEntryVisibility_PUBLIC}}, requester: "client"},
		{name: "unset visibility means public", ambient: true, mesh: visibilityMesh(meshapi.ServiceEntryVisibility_VISIBILITY_UNSPECIFIED, false), requester: "client", visible: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var mc *models.MeshConfig
			if tt.mesh != nil {
				mc = &models.MeshConfig{MeshConfig: tt.mesh}
				mc.PrepareServiceEntryVisibility()
			}
			visibility := mc.ServiceEntryVisibilityPolicy().ForNamespace(tt.definition, nil)
			assert.Equal(t, tt.visible, visibility.IsVisible(tt.exportTo, tt.requester, tt.ambient))
		})
	}
}

func visibilityMesh(visibility meshapi.ServiceEntryVisibility_Visibility, sidecars bool) *meshapi.MeshConfig {
	return &meshapi.MeshConfig{ServiceEntryVisibility: &meshapi.ServiceEntryVisibility{
		ApplyToSidecars: sidecars, DefaultVisibility: visibility,
	}}
}

func namespaceRule(selector *meshapi.LabelSelector) *meshapi.ServiceEntryVisibility_MatchRule {
	return &meshapi.ServiceEntryVisibility_MatchRule{Matcher: &meshapi.ServiceEntryVisibility_MatchRule_NamespaceSelector{NamespaceSelector: selector}}
}

func TestServiceEntryVisibilityPolicies(t *testing.T) {
	trusted := namespaceRule(&meshapi.LabelSelector{MatchLabels: map[string]string{"trusted": "true"}})
	expression := namespaceRule(&meshapi.LabelSelector{MatchExpressions: []*meshapi.LabelSelectorRequirement{{Key: "team", Operator: "In", Values: []string{"platform"}}}})
	tests := []struct {
		labels   map[string]string
		name     string
		policies []*meshapi.ServiceEntryVisibility_Policy
		visible  bool
	}{
		{name: "matching labels", labels: map[string]string{"trusted": "true"}, policies: []*meshapi.ServiceEntryVisibility_Policy{{Visibility: meshapi.ServiceEntryVisibility_PUBLIC, MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{trusted}}}, visible: true},
		{name: "nonmatching labels use default", labels: map[string]string{"trusted": "false"}, policies: []*meshapi.ServiceEntryVisibility_Policy{{Visibility: meshapi.ServiceEntryVisibility_PUBLIC, MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{trusted}}}},
		{name: "all matching rules required", labels: map[string]string{"trusted": "true"}, policies: []*meshapi.ServiceEntryVisibility_Policy{{Visibility: meshapi.ServiceEntryVisibility_PUBLIC, MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{trusted, expression}}}},
		{name: "matching expressions", labels: map[string]string{"trusted": "true", "team": "platform"}, policies: []*meshapi.ServiceEntryVisibility_Policy{{Visibility: meshapi.ServiceEntryVisibility_PUBLIC, MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{trusted, expression}}}, visible: true},
		{name: "first match wins", labels: map[string]string{"trusted": "true"}, policies: []*meshapi.ServiceEntryVisibility_Policy{{Visibility: meshapi.ServiceEntryVisibility_NAMESPACE, MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{trusted}}, {Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}},
		{name: "empty rule list matches all", policies: []*meshapi.ServiceEntryVisibility_Policy{{Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}, visible: true},
		{name: "empty selector matches all", policies: []*meshapi.ServiceEntryVisibility_Policy{{Visibility: meshapi.ServiceEntryVisibility_PUBLIC, MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{namespaceRule(&meshapi.LabelSelector{})}}}, visible: true},
		{name: "unset rule does not match", policies: []*meshapi.ServiceEntryVisibility_Policy{{Visibility: meshapi.ServiceEntryVisibility_PUBLIC, MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{{}}}}},
		{name: "invalid selector does not match", policies: []*meshapi.ServiceEntryVisibility_Policy{{Visibility: meshapi.ServiceEntryVisibility_PUBLIC, MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{namespaceRule(&meshapi.LabelSelector{MatchExpressions: []*meshapi.LabelSelectorRequirement{{Key: "team", Operator: "Invalid"}}})}}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mc := &models.MeshConfig{MeshConfig: visibilityMesh(meshapi.ServiceEntryVisibility_NAMESPACE, true)}
			mc.ServiceEntryVisibility.Policies = tt.policies
			mc.PrepareServiceEntryVisibility()
			visibility := mc.ServiceEntryVisibilityPolicy().ForNamespace("definitions", tt.labels)
			assert.Equal(t, tt.visible, visibility.IsVisible([]string{"*"}, "client", false))
		})
	}
}

func TestServiceEntryVisibilityMeshSnapshot(t *testing.T) {
	private := &models.MeshConfig{MeshConfig: visibilityMesh(meshapi.ServiceEntryVisibility_NAMESPACE, true)}
	private.PrepareServiceEntryVisibility()
	assert.Same(t, private.ServiceEntryVisibilityPolicy(), private.ServiceEntryVisibilityPolicy())
	assert.False(t, private.ServiceEntryVisibilityPolicy().ForNamespace("definitions", nil).IsVisible(nil, "client", false))

	// Discovery replaces the snapshot when the mesh cache refreshes; readers of the old
	// snapshot must remain valid while the new policy takes effect.
	public := &models.MeshConfig{MeshConfig: visibilityMesh(meshapi.ServiceEntryVisibility_PUBLIC, true)}
	public.PrepareServiceEntryVisibility()
	assert.True(t, public.ServiceEntryVisibilityPolicy().ForNamespace("definitions", nil).IsVisible(nil, "client", false))
	assert.False(t, private.ServiceEntryVisibilityPolicy().ForNamespace("definitions", nil).IsVisible(nil, "client", false))

	serialized, err := json.Marshal(public)
	require.NoError(t, err)
	assert.NotContains(t, string(serialized), "serviceEntryVisibilityPolicy")
}
