package analyze_ambient_policies

import (
	"testing"

	"github.com/stretchr/testify/assert"
	security_v1_api "istio.io/api/security/v1"
)

func TestIsL7Policy_HTTPMethods(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				To: []*security_v1_api.Rule_To{
					{
						Operation: &security_v1_api.Operation{
							Methods: []string{"GET", "POST"},
						},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.True(t, isL7, "Policy with HTTP methods should be L7")
	assert.Equal(t, "Uses HTTP methods field", reason)
}

func TestIsL7Policy_HTTPPaths(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				To: []*security_v1_api.Rule_To{
					{
						Operation: &security_v1_api.Operation{
							Paths: []string{"/api/*"},
						},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.True(t, isL7, "Policy with HTTP paths should be L7")
	assert.Equal(t, "Uses HTTP paths field", reason)
}

func TestIsL7Policy_RequestHeaders(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				When: []*security_v1_api.Condition{
					{
						Key:    "request.headers[x-custom]",
						Values: []string{"value"},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.True(t, isL7, "Policy with request.headers should be L7")
	assert.Contains(t, reason, "request.headers")
}

func TestIsL7Policy_JWTClaims(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				When: []*security_v1_api.Condition{
					{
						Key:    "request.auth.claims[iss]",
						Values: []string{"https://issuer.example.com"},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.True(t, isL7, "Policy with JWT claims should be L7")
	assert.Contains(t, reason, "request.auth.claims")
}

func TestIsL7Policy_RequestPrincipals(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				From: []*security_v1_api.Rule_From{
					{
						Source: &security_v1_api.Source{
							RequestPrincipals: []string{"cluster.local/ns/default/sa/myapp"},
						},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.True(t, isL7, "Policy with request principals should be L7")
	assert.Equal(t, "Uses request principals (JWT)", reason)
}

func TestIsL7Policy_L4Only(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{
			{
				From: []*security_v1_api.Rule_From{
					{
						Source: &security_v1_api.Source{
							Principals: []string{"cluster.local/ns/default/sa/myapp"},
							Namespaces: []string{"default"},
						},
					},
				},
				To: []*security_v1_api.Rule_To{
					{
						Operation: &security_v1_api.Operation{
							Ports: []string{"8080"},
						},
					},
				},
			},
		},
	}

	isL7, reason := isL7Policy(spec)
	assert.False(t, isL7, "Policy with only L4 fields should NOT be L7")
	assert.Empty(t, reason)
}

func TestIsL7Policy_EmptyPolicy(t *testing.T) {
	spec := &security_v1_api.AuthorizationPolicy{
		Rules: []*security_v1_api.Rule{},
	}

	isL7, reason := isL7Policy(spec)
	assert.False(t, isL7, "Empty policy should not be L7")
	assert.Empty(t, reason)
}

func TestIsL7Policy_NilPolicy(t *testing.T) {
	isL7, reason := isL7Policy(nil)
	assert.False(t, isL7, "Nil policy should not be L7")
	assert.Empty(t, reason)
}

func TestGenerateSummary_NoAmbient(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:      "test-ns",
		IsAmbient: false,
	}

	summary := generateSummary(2, 3, 0, nsStatus)
	assert.Contains(t, summary, "NOT in Ambient mode")
	assert.Contains(t, summary, "sidecars")
}

func TestGenerateSummary_AmbientWithWaypoint(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:         "test-ns",
		IsAmbient:    true,
		HasWaypoint:  true,
		WaypointName: "waypoint-proxy",
	}

	summary := generateSummary(1, 2, 0, nsStatus)
	assert.Contains(t, summary, "waypoint-proxy")
	assert.NotContains(t, summary, "WARNING")
}

func TestGenerateSummary_AmbientWithoutWaypoint(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:        "test-ns",
		IsAmbient:   true,
		HasWaypoint: false,
	}

	summary := generateSummary(1, 2, 2, nsStatus)
	assert.Contains(t, summary, "WARNING")
	assert.Contains(t, summary, "will NOT be enforced")
}

func TestGenerateRecommendations_NeedWaypoint(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:        "test-ns",
		IsAmbient:   true,
		HasWaypoint: false,
	}

	recommendations := generateRecommendations(nsStatus, 2, 2)
	assert.NotEmpty(t, recommendations)
	assert.Contains(t, recommendations[0], "Deploy a waypoint")
	assert.Contains(t, recommendations[0], "istioctl waypoint apply")
}

func TestGenerateRecommendations_NoIssues(t *testing.T) {
	nsStatus := NamespaceAmbientStatus{
		Name:         "test-ns",
		IsAmbient:    true,
		HasWaypoint:  true,
		WaypointName: "waypoint-proxy",
	}

	recommendations := generateRecommendations(nsStatus, 2, 0)
	assert.NotEmpty(t, recommendations)
	assert.Contains(t, recommendations[0], "No issues found")
}
