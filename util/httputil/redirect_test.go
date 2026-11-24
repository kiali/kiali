package httputil

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProbeRedirectPolicies(t *testing.T) {
	cases := []struct {
		name          string
		from          string
		to            string
		authenticated bool
		anonymous     bool
	}{
		{"same origin path", "https://tracing.example/query", "https://tracing.example/canonical", true, true},
		{"explicit default port", "https://tracing.example/query", "https://tracing.example:443/canonical", true, true},
		{"HTTP to HTTPS", "http://tracing.example/query", "https://tracing.example/canonical", false, true},
		{"same-port HTTPS upgrade", "http://tracing.example:8080/query", "https://tracing.example:8080/canonical", false, true},
		{"HTTPS downgrade", "https://tracing.example/query", "http://tracing.example/canonical", false, false},
		{"different port", "https://tracing.example/query", "https://tracing.example:8443/canonical", false, false},
		{"different host", "https://tracing.example/query", "https://another.example/canonical", false, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			from, err := http.NewRequest(http.MethodGet, tc.from, nil)
			require.NoError(t, err)
			to, err := http.NewRequest(http.MethodGet, tc.to, nil)
			require.NoError(t, err)
			via := []*http.Request{from}
			assert.Equal(t, tc.authenticated, SameOriginRedirect(to, via) == nil)
			assert.Equal(t, tc.anonymous, AnonymousDiscoveryRedirect(to, via) == nil)
		})
	}
}
