package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestServer starts a test HTTP server and returns the server and a cleanup function.
func newTestServer(mux *http.ServeMux) (*httptest.Server, func()) {
	srv := httptest.NewServer(mux)
	return srv, srv.Close
}

// jsonResponse writes a JSON body with the given status code.
func jsonResponse(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// ── New / options ──────────────────────────────────────────────────────────────

func TestNew_TrimsTrailingSlash(t *testing.T) {
	c := New("https://ols.example.com/")
	assert.Equal(t, "https://ols.example.com", c.baseURL)
}

func TestNew_NoTrailingSlash(t *testing.T) {
	c := New("https://ols.example.com")
	assert.Equal(t, "https://ols.example.com", c.baseURL)
}

func TestNew_UsesDefaultHTTPClient(t *testing.T) {
	c := New("https://ols.example.com")
	assert.Equal(t, http.DefaultClient, c.httpClient)
}

func TestWithHTTPClient_SetsCustomClient(t *testing.T) {
	custom := &http.Client{}
	c := New("https://ols.example.com", WithHTTPClient(custom))
	assert.Equal(t, custom, c.httpClient)
}

func TestWithInsecureSkipTLS_True_ReplacesTransport(t *testing.T) {
	c := New("https://ols.example.com", WithInsecureSkipTLS(true))
	assert.NotEqual(t, http.DefaultClient, c.httpClient)
}

func TestWithInsecureSkipTLS_False_KeepsDefault(t *testing.T) {
	c := New("https://ols.example.com", WithInsecureSkipTLS(false))
	assert.Equal(t, http.DefaultClient, c.httpClient)
}

// ── SetAuthToken ───────────────────────────────────────────────────────────────

func TestSetAuthToken_TrimsWhitespace(t *testing.T) {
	c := New("https://ols.example.com")
	c.SetAuthToken("  my-token  ")
	assert.Equal(t, "my-token", c.authToken)
}

func TestSetAuthToken_Empty(t *testing.T) {
	c := New("https://ols.example.com")
	c.SetAuthToken("  ")
	assert.Equal(t, "", c.authToken)
}

// ── APIError ──────────────────────────────────────────────────────────────────

func TestAPIError_WithBody(t *testing.T) {
	err := &APIError{StatusCode: 401, Body: []byte("unauthorized")}
	assert.Equal(t, "lightspeed API error 401: unauthorized", err.Error())
}

func TestAPIError_WithoutBody(t *testing.T) {
	err := &APIError{StatusCode: 500, Body: nil}
	assert.Equal(t, "lightspeed API error 500", err.Error())
}

// ── Authorized ────────────────────────────────────────────────────────────────

func TestAuthorized_Success(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathAuthorized, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		jsonResponse(w, http.StatusOK, AuthorizationResponse{
			UserID:   "user-123",
			Username: "alice",
		})
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	resp, code, err := c.Authorized(context.Background(), "")

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, code)
	assert.Equal(t, "user-123", resp.UserID)
	assert.Equal(t, "alice", resp.Username)
}

func TestAuthorized_SendsUserIDQueryParam(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathAuthorized, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "dev-user", r.URL.Query().Get("user_id"))
		jsonResponse(w, http.StatusOK, AuthorizationResponse{UserID: "dev-user"})
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	_, _, err := c.Authorized(context.Background(), "dev-user")
	require.NoError(t, err)
}

func TestAuthorized_SendsBearerToken(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathAuthorized, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer tok", r.Header.Get("Authorization"))
		jsonResponse(w, http.StatusOK, AuthorizationResponse{})
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	c.SetAuthToken("tok")
	_, _, err := c.Authorized(context.Background(), "")
	require.NoError(t, err)
}

func TestAuthorized_Unauthorized(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathAuthorized, func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusUnauthorized, map[string]string{"detail": "invalid token"})
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	_, code, err := c.Authorized(context.Background(), "")

	require.Error(t, err)
	assert.Equal(t, http.StatusUnauthorized, code)
	var apiErr *APIError
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, http.StatusUnauthorized, apiErr.StatusCode)
}

func TestAuthorized_ServerError(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathAuthorized, func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"detail": "boom"})
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	_, code, err := c.Authorized(context.Background(), "")

	require.Error(t, err)
	assert.Equal(t, http.StatusInternalServerError, code)
}

// ── Readiness ─────────────────────────────────────────────────────────────────

func TestReadiness_Ready(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathReadiness, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodGet, r.Method)
		jsonResponse(w, http.StatusOK, ReadinessResponse{Ready: true})
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	resp, err := c.Readiness(context.Background())

	require.NoError(t, err)
	assert.True(t, resp.Ready)
}

func TestReadiness_NotReady(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathReadiness, func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusServiceUnavailable, ReadinessResponse{Ready: false, Reason: "LLM not loaded"})
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	_, err := c.Readiness(context.Background())
	require.Error(t, err)
}

// ── Liveness ──────────────────────────────────────────────────────────────────

func TestLiveness_Alive(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathLiveness, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodGet, r.Method)
		jsonResponse(w, http.StatusOK, LivenessResponse{Alive: true})
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	resp, err := c.Liveness(context.Background())

	require.NoError(t, err)
	assert.True(t, resp.Alive)
}

func TestLiveness_ServerError(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathLiveness, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	_, err := c.Liveness(context.Background())
	require.Error(t, err)
}

// ── StreamingQuery ─────────────────────────────────────────────────────────────

func sseEvent(payload string) string {
	return fmt.Sprintf("data: %s\n", payload)
}

func TestStreamingQuery_EmptyQuery_ReturnsError(t *testing.T) {
	c := New("http://unused")
	code, err := c.StreamingQuery(context.Background(), &LLMRequest{Query: ""}, "", func(string) {})
	require.Error(t, err)
	assert.Equal(t, http.StatusBadRequest, code)
	assert.Contains(t, err.Error(), "query is required")
}

func TestStreamingQuery_NilRequest_ReturnsError(t *testing.T) {
	c := New("http://unused")
	code, err := c.StreamingQuery(context.Background(), nil, "", func(string) {})
	require.Error(t, err)
	assert.Equal(t, http.StatusBadRequest, code)
}

func TestStreamingQuery_StreamsTokens(t *testing.T) {
	token1 := `{"event":"token","data":{"id":0,"token":"Hello"}}`
	token2 := `{"event":"token","data":{"id":1,"token":" world"}}`
	endEvt := `{"event":"end","data":{"conversation_id":"conv-1"}}`

	mux := http.NewServeMux()
	mux.HandleFunc(pathStreamingQuery, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "text/event-stream", r.Header.Get("Accept"))
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, sseEvent(token1))
		fmt.Fprint(w, sseEvent(token2))
		fmt.Fprint(w, sseEvent(endEvt))
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	var chunks []string
	code, err := c.StreamingQuery(context.Background(), &LLMRequest{Query: "hello"}, "", func(chunk string) {
		chunks = append(chunks, chunk)
	})

	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, code)
	require.Len(t, chunks, 3)
	assert.Equal(t, token1, chunks[0])
	assert.Equal(t, token2, chunks[1])
	assert.Equal(t, endEvt, chunks[2])
}

func TestStreamingQuery_SkipsNonDataLines(t *testing.T) {
	payload := `{"event":"token","data":{"token":"hi"}}`
	mux := http.NewServeMux()
	mux.HandleFunc(pathStreamingQuery, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, ": keep-alive\n")
		fmt.Fprint(w, "\n")
		fmt.Fprint(w, sseEvent(payload))
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	var chunks []string
	_, err := c.StreamingQuery(context.Background(), &LLMRequest{Query: "hi"}, "", func(chunk string) {
		chunks = append(chunks, chunk)
	})

	require.NoError(t, err)
	require.Len(t, chunks, 1)
	assert.Equal(t, payload, chunks[0])
}

func TestStreamingQuery_SkipsDONESentinel(t *testing.T) {
	payload := `{"event":"token","data":{"token":"bye"}}`
	mux := http.NewServeMux()
	mux.HandleFunc(pathStreamingQuery, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, sseEvent(payload))
		fmt.Fprint(w, "data: [DONE]\n")
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	var chunks []string
	_, err := c.StreamingQuery(context.Background(), &LLMRequest{Query: "bye"}, "", func(chunk string) {
		chunks = append(chunks, chunk)
	})

	require.NoError(t, err)
	require.Len(t, chunks, 1)
}

func TestStreamingQuery_SendsUserIDQueryParam(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathStreamingQuery, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "u-42", r.URL.Query().Get("user_id"))
		w.WriteHeader(http.StatusOK)
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	_, err := c.StreamingQuery(context.Background(), &LLMRequest{Query: "q"}, "u-42", func(string) {})
	require.NoError(t, err)
}

func TestStreamingQuery_SendsBearerToken(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathStreamingQuery, func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer secret", r.Header.Get("Authorization"))
		w.WriteHeader(http.StatusOK)
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	c.SetAuthToken("secret")
	_, err := c.StreamingQuery(context.Background(), &LLMRequest{Query: "q"}, "", func(string) {})
	require.NoError(t, err)
}

func TestStreamingQuery_HTTPError_ReturnsAPIError(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc(pathStreamingQuery, func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, http.StatusUnprocessableEntity, map[string]string{"detail": "validation failed"})
	})
	srv, cleanup := newTestServer(mux)
	defer cleanup()

	c := New(srv.URL)
	code, err := c.StreamingQuery(context.Background(), &LLMRequest{Query: "q"}, "", func(string) {})

	require.Error(t, err)
	assert.Equal(t, http.StatusUnprocessableEntity, code)
	var apiErr *APIError
	require.ErrorAs(t, err, &apiErr)
	assert.Equal(t, http.StatusUnprocessableEntity, apiErr.StatusCode)
}
