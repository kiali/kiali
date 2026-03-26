package get_referenced_docs

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExecute_MissingKeywords(t *testing.T) {
	res, status := Execute(nil, map[string]interface{}{})
	assert.Equal(t, http.StatusBadRequest, status)
	resp, ok := res.(GetReferencedDocResponse)
	require.True(t, ok)
	assert.Contains(t, resp.Errors, "keywords parameter is required")
}

func TestExecute_EmptyKeywords(t *testing.T) {
	res, status := Execute(nil, map[string]interface{}{"keywords": ""})
	assert.Equal(t, http.StatusBadRequest, status)
	resp, ok := res.(GetReferencedDocResponse)
	require.True(t, ok)
	assert.Contains(t, resp.Errors, "keywords parameter is required")
}

func TestExecute_OnlyWhitespaceKeywords(t *testing.T) {
	res, status := Execute(nil, map[string]interface{}{"keywords": "  ,  ,  "})
	assert.Equal(t, http.StatusBadRequest, status)
	resp, ok := res.(GetReferencedDocResponse)
	require.True(t, ok)
	assert.Contains(t, resp.Errors, "no valid keywords provided")
}

func TestExecute_ValidKeywords(t *testing.T) {
	res, status := Execute(nil, map[string]interface{}{"keywords": "mtls,security"})
	assert.Equal(t, http.StatusOK, status)
	resp, ok := res.(GetReferencedDocResponse)
	require.True(t, ok)
	assert.Empty(t, resp.Errors)
}

func TestExecute_InvalidDomain(t *testing.T) {
	res, status := Execute(nil, map[string]interface{}{
		"keywords": "mtls",
		"domain":   "invalid_domain",
	})
	assert.Equal(t, http.StatusBadRequest, status)
	resp, ok := res.(GetReferencedDocResponse)
	require.True(t, ok)
	assert.Contains(t, resp.Errors, "invalid domain")
	assert.Contains(t, resp.Errors, "invalid_domain")
}

func TestExecute_ValidDomains(t *testing.T) {
	validDomains := []string{"kiali", "istio", "all"}
	for _, domain := range validDomains {
		t.Run("Domain_"+domain, func(t *testing.T) {
			res, status := Execute(nil, map[string]interface{}{
				"keywords": "mtls",
				"domain":   domain,
			})
			assert.Equal(t, http.StatusOK, status)
			resp, ok := res.(GetReferencedDocResponse)
			require.True(t, ok)
			assert.Empty(t, resp.Errors)
		})
	}
}

func TestExecute_EmptyDomainDefaultsToAll(t *testing.T) {
	res, status := Execute(nil, map[string]interface{}{
		"keywords": "mtls",
	})
	assert.Equal(t, http.StatusOK, status)
	resp, ok := res.(GetReferencedDocResponse)
	require.True(t, ok)
	assert.Empty(t, resp.Errors)
}

func TestExecute_DomainCaseInsensitive(t *testing.T) {
	res, status := Execute(nil, map[string]interface{}{
		"keywords": "mtls",
		"domain":   "KIALI",
	})
	assert.Equal(t, http.StatusOK, status)
	resp, ok := res.(GetReferencedDocResponse)
	require.True(t, ok)
	assert.Empty(t, resp.Errors)
}

func TestExecute_ReturnsCitations(t *testing.T) {
	res, status := Execute(nil, map[string]interface{}{
		"keywords": "traffic,routing",
		"domain":   "istio",
	})
	assert.Equal(t, http.StatusOK, status)
	resp, ok := res.(GetReferencedDocResponse)
	require.True(t, ok)
	assert.Empty(t, resp.Errors)
	// Should return referenced_docs (may be empty if no match, but no error)
	assert.NotNil(t, resp.ReferencedDocs)
}
