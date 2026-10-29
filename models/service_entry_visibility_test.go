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
		{name: "ambient without policy defaults public", ambient: true, requester: "client", visible: true},
		{name: "ambient without policy ignores private export", ambient: true, definition: "definitions", exportTo: []string{"."}, requester: "client", visible: true},
		{name: "ambient without policy ignores mesh export default", ambient: true, definition: "definitions", mesh: &meshapi.MeshConfig{DefaultServiceExportTo: []string{"."}}, requester: "client", visible: true},
		{name: "ambient public ignores private export", ambient: true, definition: "definitions", exportTo: []string{"."}, mesh: visibilityMesh(meshapi.ServiceEntryVisibility_PUBLIC, false), requester: "client", visible: true},
		{name: "ambient public ignores no export", ambient: true, definition: "definitions", exportTo: []string{"~"}, mesh: visibilityMesh(meshapi.ServiceEntryVisibility_PUBLIC, false), requester: "client", visible: true},
		{
			ambient: true, definition: "definitions", mesh: &meshapi.MeshConfig{
				DefaultServiceExportTo: []string{"."},
				ServiceEntryVisibility: &meshapi.ServiceEntryVisibility{DefaultVisibility: meshapi.ServiceEntryVisibility_PUBLIC},
			},
			name: "ambient public ignores mesh export default", requester: "client", visible: true,
		},
		{name: "ambient namespace visibility ignores local export restriction", ambient: true, definition: "definitions", exportTo: []string{"client"}, mesh: visibilityMesh(meshapi.ServiceEntryVisibility_NAMESPACE, false), requester: "definitions", visible: true},
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

func TestServiceEntryVisibilityZeroValue(t *testing.T) {
	var visibility models.ServiceEntryVisibility
	for name, ambient := range map[string]bool{"sidecar": false, "ambient": true} {
		t.Run(name, func(t *testing.T) {
			assert.True(t, visibility.IsVisible(nil, "client", ambient), "omitted exportTo defaults to public")
			assert.True(t, visibility.IsVisible([]string{"*"}, "client", ambient))
			assert.True(t, visibility.IsVisible([]string{"client"}, "client", ambient))
			assert.Equal(t, ambient, visibility.IsVisible([]string{"other"}, "client", ambient), "ambient ignores named exports")
			assert.Equal(t, ambient, visibility.IsVisible([]string{"."}, "client", ambient), "ambient ignores private exports")
			assert.Equal(t, ambient, visibility.IsVisible([]string{"~"}, "client", ambient), "ambient ignores no-export declarations")
		})
	}
}

func TestServiceEntryExportTo(t *testing.T) {
	privateDefault := models.NewMeshConfig()
	privateDefault.DefaultServiceExportTo = []string{"."}
	privateDefault.PrepareServiceEntryVisibility()
	publicDefault := models.NewMeshConfig()
	publicDefault.DefaultServiceExportTo = []string{"*"}
	publicDefault.PrepareServiceEntryVisibility()
	for name, tt := range map[string]struct {
		exportTo  []string
		mesh      *models.MeshConfig
		requester string
		visible   bool
	}{
		"nil mesh defaults public": {
			requester: "client", visible: true,
		},
		"empty embedded mesh defaults public": {
			mesh: &models.MeshConfig{}, requester: "client", visible: true,
		},
		"private mesh default allows local namespace": {
			mesh: privateDefault, requester: "definitions", visible: true,
		},
		"private mesh default rejects another namespace": {
			mesh: privateDefault, requester: "client",
		},
		"public mesh default allows another namespace": {
			mesh: publicDefault, requester: "client", visible: true,
		},
		"explicit public export overrides private mesh default": {
			exportTo: []string{"*"}, mesh: privateDefault, requester: "client", visible: true,
		},
		"explicit private export overrides public mesh default": {
			exportTo: []string{"."}, mesh: publicDefault, requester: "client",
		},
		"explicit private export allows local namespace": {
			exportTo: []string{"."}, mesh: publicDefault, requester: "definitions", visible: true,
		},
		"named export overrides private mesh default": {
			exportTo: []string{"client"}, mesh: privateDefault, requester: "client", visible: true,
		},
		"named export rejects another namespace": {
			exportTo: []string{"other"}, mesh: publicDefault, requester: "client",
		},
		"empty embedded mesh honors explicit restrictions": {
			exportTo: []string{"."}, mesh: &models.MeshConfig{}, requester: "client",
		},
	} {
		t.Run(name, func(t *testing.T) {
			policy := tt.mesh.ServiceEntryVisibilityPolicy()
			assert.Equal(t, tt.visible, policy.IsExportedTo(tt.exportTo, "definitions", tt.requester))
			assert.Equal(t, tt.visible, policy.ForNamespace("definitions", nil).IsVisible(tt.exportTo, tt.requester, false))
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
		{name: "matching labels", labels: map[string]string{"trusted": "true"}, policies: []*meshapi.ServiceEntryVisibility_Policy{{MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{trusted}, Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}, visible: true},
		{name: "missing labels use default", policies: []*meshapi.ServiceEntryVisibility_Policy{{MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{trusted}, Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}},
		{name: "nonmatching labels use default", labels: map[string]string{"trusted": "false"}, policies: []*meshapi.ServiceEntryVisibility_Policy{{MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{trusted}, Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}},
		{name: "all matching rules required", labels: map[string]string{"trusted": "true"}, policies: []*meshapi.ServiceEntryVisibility_Policy{{MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{trusted, expression}, Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}},
		{name: "matching expressions", labels: map[string]string{"trusted": "true", "team": "platform"}, policies: []*meshapi.ServiceEntryVisibility_Policy{{MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{trusted, expression}, Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}, visible: true},
		{name: "first match wins", labels: map[string]string{"trusted": "true"}, policies: []*meshapi.ServiceEntryVisibility_Policy{{MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{trusted}, Visibility: meshapi.ServiceEntryVisibility_NAMESPACE}, {Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}},
		{name: "empty rule list matches all", policies: []*meshapi.ServiceEntryVisibility_Policy{{Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}, visible: true},
		{name: "empty selector matches all", policies: []*meshapi.ServiceEntryVisibility_Policy{{MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{namespaceRule(&meshapi.LabelSelector{})}, Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}, visible: true},
		{name: "unset rule does not match", policies: []*meshapi.ServiceEntryVisibility_Policy{{MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{{}}, Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}},
		{name: "invalid selector does not match", policies: []*meshapi.ServiceEntryVisibility_Policy{{MatchingRules: []*meshapi.ServiceEntryVisibility_MatchRule{namespaceRule(&meshapi.LabelSelector{MatchExpressions: []*meshapi.LabelSelectorRequirement{{Key: "team", Operator: "Invalid"}}})}, Visibility: meshapi.ServiceEntryVisibility_PUBLIC}}},
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
	serializedBefore, err := json.Marshal(public)
	require.NoError(t, err)
	public.PrepareServiceEntryVisibility()
	assert.True(t, public.ServiceEntryVisibilityPolicy().ForNamespace("definitions", nil).IsVisible(nil, "client", false))
	assert.False(t, private.ServiceEntryVisibilityPolicy().ForNamespace("definitions", nil).IsVisible(nil, "client", false))

	serializedAfter, err := json.Marshal(public)
	require.NoError(t, err)
	assert.JSONEq(t, string(serializedBefore), string(serializedAfter), "preparing visibility must not change the serialized mesh configuration")
}
