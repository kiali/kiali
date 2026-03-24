package mcp_tools

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetCitations_MissingKeywords(t *testing.T) {
	resp, err := CallMCPTool("get_citations", map[string]interface{}{})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	assert.Contains(t, string(resp.Body), "keywords")
}

func TestGetCitations_EmptyKeywords(t *testing.T) {
	resp, err := CallMCPTool("get_citations", map[string]interface{}{"keywords": ""})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestGetCitations_WithKeywords(t *testing.T) {
	resp, err := CallMCPTool("get_citations", map[string]interface{}{
		"keywords": "mtls,security",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestGetCitations_InvalidDomain(t *testing.T) {
	resp, err := CallMCPTool("get_citations", map[string]interface{}{
		"keywords": "mtls",
		"domain":   "invalid_domain",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	assert.Contains(t, string(resp.Body), "invalid domain")
}

func TestGetCitations_ValidDomains(t *testing.T) {
	for _, domain := range []string{"kiali", "istio", "all"} {
		t.Run(domain, func(t *testing.T) {
			resp, err := CallMCPTool("get_citations", map[string]interface{}{
				"keywords": "traffic",
				"domain":   domain,
			})
			require.NoError(t, err)
			assert.Equal(t, http.StatusOK, resp.StatusCode)
		})
	}
}

func TestGetCitations_EmptyDomainDefaultsToAll(t *testing.T) {
	resp, err := CallMCPTool("get_citations", map[string]interface{}{
		"keywords": "mtls",
	})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
