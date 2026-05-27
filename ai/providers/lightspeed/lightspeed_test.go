package lightspeed_provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/ai/providers/lightspeed/client"
	"github.com/kiali/kiali/ai/types"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
)

// makeRequestWithToken returns an *http.Request whose context carries a
// Kubernetes auth-info map for the given cluster/token pair.
func makeRequestWithToken(t *testing.T, clusterName, token string) *http.Request {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, "/", nil)
	require.NoError(t, err)
	authInfos := map[string]*api.AuthInfo{
		clusterName: {Token: token},
	}
	ctx := authentication.SetAuthInfoContext(req.Context(), authInfos)
	return req.WithContext(ctx)
}

// providerWithServer creates a LightSpeedProvider whose HTTP client points at
// the given test server URL (no TLS, no token initially).
func providerWithServer(url string) *LightSpeedProvider {
	return &LightSpeedProvider{
		client: *client.New(url),
	}
}

// kialiConf returns a minimal KialiInterface with the provided cluster name.
func kialiConf(clusterName string) *mcputil.KialiInterface {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = clusterName
	return &mcputil.KialiInterface{Conf: conf}
}

// ── getBearerToken ────────────────────────────────────────────────────────────

func TestGetBearerToken_NoAuthContext_ReturnsEmpty(t *testing.T) {
	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	conf := config.NewConfig()

	token := getBearerToken(req, conf)
	assert.Empty(t, token)
}

func TestGetBearerToken_WrongContextType_ReturnsEmpty(t *testing.T) {
	req, _ := http.NewRequest(http.MethodGet, "/", nil)
	ctx := authentication.SetAuthInfoContext(req.Context(), "not-a-map")
	req = req.WithContext(ctx)
	conf := config.NewConfig()

	token := getBearerToken(req, conf)
	assert.Empty(t, token)
}

func TestGetBearerToken_ClusterNotInMap_ReturnsEmpty(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "cluster-a"

	req := makeRequestWithToken(t, "cluster-b", "tok")
	token := getBearerToken(req, conf)
	assert.Empty(t, token)
}

func TestGetBearerToken_ValidToken_ReturnsToken(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "my-cluster"

	req := makeRequestWithToken(t, "my-cluster", "secret-token")
	token := getBearerToken(req, conf)
	assert.Equal(t, "secret-token", token)
}

// ── handleErrorCodeQuery ──────────────────────────────────────────────────────

func TestHandleErrorCodeQuery_KnownCodes(t *testing.T) {
	tests := []struct {
		code int
		want string
	}{
		{http.StatusUnauthorized, "Missing or invalid credentials provided by client"},
		{http.StatusForbidden, "Client does not have permission to access resource"},
		{413, "Prompt is too long"},
		{500, "Query cannot be validated, LLM is not accessible or other internal error"},
		{422, "Validation Error"},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("code_%d", tt.code), func(t *testing.T) {
			assert.Equal(t, tt.want, handleErrorCodeQuery(tt.code))
		})
	}
}

func TestHandleErrorCodeQuery_UnknownCode_ReturnsGeneric(t *testing.T) {
	assert.Equal(t, "Unexpected error querying OLS", handleErrorCodeQuery(999))
}

// ── handleErrorCodeAuthorized ─────────────────────────────────────────────────

func TestHandleErrorCodeAuthorized_KnownCodes(t *testing.T) {
	tests := []struct {
		code int
		want string
	}{
		{http.StatusUnauthorized, "Missing or invalid credentials provided by client"},
		{http.StatusForbidden, "User is not authorized"},
		{500, "Unexpected error during token review"},
		{422, "Validation Error"},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("code_%d", tt.code), func(t *testing.T) {
			assert.Equal(t, tt.want, handleErrorCodeAuthorized(tt.code))
		})
	}
}

func TestHandleErrorCodeAuthorized_UnknownCode_ReturnsGeneric(t *testing.T) {
	assert.Equal(t, "Unexpected error authorizing user", handleErrorCodeAuthorized(999))
}

// ── no-op interface methods ───────────────────────────────────────────────────

func TestInitializeConversation_IsNoop(t *testing.T) {
	p := &LightSpeedProvider{}
	assert.NotPanics(t, func() {
		p.InitializeConversation(&types.Conversation{}, "conv-1")
	})
}

func TestReduceConversation_IsNoop(t *testing.T) {
	p := &LightSpeedProvider{}
	assert.NotPanics(t, func() {
		p.ReduceConversation(context.Background(), &types.Conversation{}, 10)
	})
}

func TestTransformToolCallToToolsProcessor_ReturnsNils(t *testing.T) {
	p := &LightSpeedProvider{}
	calls, names, err := p.TransformToolCallToToolsProcessor(nil)
	assert.Nil(t, calls)
	assert.Nil(t, names)
	assert.NoError(t, err)
}

func TestConversationToProvider_ReturnsNil(t *testing.T) {
	p := &LightSpeedProvider{}
	assert.Nil(t, p.ConversationToProvider(nil))
}

func TestProviderToConversation_ReturnsZeroValue(t *testing.T) {
	p := &LightSpeedProvider{}
	msg := p.ProviderToConversation(nil)
	assert.Equal(t, types.ConversationMessage{}, msg)
}

// ── SendChat ──────────────────────────────────────────────────────────────────

// buildSSEServer creates a test HTTP server handling /authorized and
// /v1/streaming_query according to the supplied behaviour params.
type sseServerOpts struct {
	authorizedStatus int
	streamEvents     []string // raw JSON payloads (without "data: " prefix)
	streamStatus     int
}

func buildSSEServer(t *testing.T, opts sseServerOpts) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()

	mux.HandleFunc("/authorized", func(w http.ResponseWriter, r *http.Request) {
		if opts.authorizedStatus != http.StatusOK {
			w.WriteHeader(opts.authorizedStatus)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"user_id":  "u-1",
			"username": "alice",
		})
	})

	mux.HandleFunc("/v1/streaming_query", func(w http.ResponseWriter, r *http.Request) {
		if opts.streamStatus != 0 && opts.streamStatus >= 400 {
			w.WriteHeader(opts.streamStatus)
			return
		}
		w.WriteHeader(http.StatusOK)
		for _, ev := range opts.streamEvents {
			fmt.Fprintf(w, "data: %s\n", ev)
		}
	})

	return httptest.NewServer(mux)
}

func collectChunks(p *LightSpeedProvider, r *http.Request, ki *mcputil.KialiInterface) ([]string, types.TokenUsage) {
	var chunks []string
	usage := p.SendChat(func(chunk string) { chunks = append(chunks, chunk) }, r, types.AIRequest{Query: "hello"}, ki, nil)
	return chunks, usage
}

func TestSendChat_AuthorizationFails_StreamsError(t *testing.T) {
	srv := buildSSEServer(t, sseServerOpts{authorizedStatus: http.StatusUnauthorized})
	defer srv.Close()

	p := providerWithServer(srv.URL)
	ki := kialiConf("test-cluster")
	req := makeRequestWithToken(t, "test-cluster", "bad-token")

	chunks, usage := collectChunks(p, req, ki)

	require.Len(t, chunks, 1)
	assert.True(t, strings.Contains(chunks[0], "error"), "expected error event, got: %s", chunks[0])
	assert.False(t, usage.HasTokens())
}

func TestSendChat_AuthorizationForbidden_StreamsError(t *testing.T) {
	srv := buildSSEServer(t, sseServerOpts{authorizedStatus: http.StatusForbidden})
	defer srv.Close()

	p := providerWithServer(srv.URL)
	ki := kialiConf("test-cluster")
	req := makeRequestWithToken(t, "test-cluster", "some-token")

	chunks, usage := collectChunks(p, req, ki)

	require.Len(t, chunks, 1)
	assert.Contains(t, chunks[0], "error")
	assert.False(t, usage.HasTokens())
}

func TestSendChat_SuccessfulStream_ForwardsAllChunks(t *testing.T) {
	events := []string{
		`{"event":"start","data":{"conversation_id":"c-1"}}`,
		`{"event":"token","data":{"id":0,"token":"Hello"}}`,
		`{"event":"token","data":{"id":1,"token":" world"}}`,
		`{"event":"end","data":{"referenced_documents":[],"input_tokens":7,"output_tokens":3,"reasoning_tokens":2}}`,
	}
	srv := buildSSEServer(t, sseServerOpts{
		authorizedStatus: http.StatusOK,
		streamEvents:     events,
	})
	defer srv.Close()

	p := providerWithServer(srv.URL)
	ki := kialiConf("test-cluster")
	req := makeRequestWithToken(t, "test-cluster", "valid-token")

	chunks, usage := collectChunks(p, req, ki)

	require.Len(t, chunks, len(events))
	assert.Equal(t, events[0], chunks[0])
	assert.Equal(t, events[1], chunks[1])
	assert.Equal(t, events[2], chunks[2])
	assert.JSONEq(t, `{"event":"end","data":{"referenced_documents":[]}}`, chunks[3])
	assert.Equal(t, types.NewTokenUsage(7, 3, 10), usage)
}

func TestSendChat_StreamReturnsError_StreamsError(t *testing.T) {
	srv := buildSSEServer(t, sseServerOpts{
		authorizedStatus: http.StatusOK,
		streamStatus:     http.StatusUnprocessableEntity,
	})
	defer srv.Close()

	p := providerWithServer(srv.URL)
	ki := kialiConf("test-cluster")
	req := makeRequestWithToken(t, "test-cluster", "valid-token")

	chunks, usage := collectChunks(p, req, ki)

	require.Len(t, chunks, 1)
	assert.Contains(t, chunks[0], "error")
	assert.False(t, usage.HasTokens())
}

func TestSendChat_TokenExtractedFromContext(t *testing.T) {
	var gotAuth string
	mux := http.NewServeMux()
	mux.HandleFunc("/authorized", func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"user_id": "u-1", "username": "alice"})
	})
	mux.HandleFunc("/v1/streaming_query", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	p := providerWithServer(srv.URL)
	ki := kialiConf("my-cluster")
	req := makeRequestWithToken(t, "my-cluster", "cluster-token")

	_, usage := collectChunks(p, req, ki)

	assert.Equal(t, "Bearer cluster-token", gotAuth)
	assert.False(t, usage.HasTokens())
}
