package client

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const (
	pathAuthorized     = "/authorized"
	pathLiveness       = "/liveness"
	pathStreamingQuery = "/v1/streaming_query"
	pathReadiness      = "/readiness"
)

// Client calls the OpenShift LightSpeed (OLS) API.
type Client struct {
	baseURL    string
	authToken  string
	httpClient *http.Client
}

// Option configures the client.
type Option func(*Client)

// WithHTTPClient sets the HTTP client (default: http.DefaultClient).
func WithHTTPClient(c *http.Client) Option {
	return func(client *Client) {
		client.httpClient = c
	}
}

// WithTLSConfig sets a pre-built TLS configuration on the client's transport.
func WithTLSConfig(cfg *tls.Config) Option {
	return func(c *Client) {
		if cfg == nil {
			return
		}
		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.TLSClientConfig = cfg
		c.httpClient = &http.Client{Transport: transport}
	}
}

// HttpClient returns the underlying HTTP client for inspection (e.g. in tests).
func (c *Client) HttpClient() *http.Client {
	return c.httpClient
}

// SetAuthToken sets the Bearer token on the client (e.g. per-request token from Kiali auth).
func (c *Client) SetAuthToken(token string) {
	c.authToken = strings.TrimSpace(token)
}

// New builds a LightSpeed client. baseURL must be the root of the OLS API (e.g. https://ols.example.com).
func New(baseURL string, opts ...Option) *Client {
	c := &Client{
		baseURL:    strings.TrimSuffix(baseURL, "/"),
		httpClient: http.DefaultClient,
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

func (c *Client) do(ctx context.Context, method, path string, query url.Values, body any, result any) (int, error) {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, fmt.Errorf("marshal request: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	rawURL := c.baseURL + path
	if len(query) > 0 {
		rawURL += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, rawURL, bodyReader)
	if err != nil {
		return 0, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.authToken)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return resp.StatusCode, &APIError{StatusCode: resp.StatusCode, Body: bodyBytes}
	}

	if result != nil && len(bodyBytes) > 0 {
		if err := json.Unmarshal(bodyBytes, result); err != nil {
			return resp.StatusCode, fmt.Errorf("decode response: %w", err)
		}
	}
	return resp.StatusCode, nil
}

// APIError is returned when the API responds with an error status.
type APIError struct {
	StatusCode int
	Body       []byte
}

func (e *APIError) Error() string {
	if len(e.Body) > 0 {
		return fmt.Sprintf("lightspeed API error %d: %s", e.StatusCode, string(e.Body))
	}
	return fmt.Sprintf("lightspeed API error %d", e.StatusCode)
}

// Authorized validates the current user with POST /authorized.
// Optional userID is sent as query parameter when no-op auth is enabled.
func (c *Client) Authorized(ctx context.Context, userID string) (*AuthorizationResponse, int, error) {
	q := url.Values{}
	if userID != "" {
		q.Set("user_id", userID)
	}
	var out AuthorizationResponse
	code, err := c.do(ctx, http.MethodPost, pathAuthorized, q, nil, &out)
	return &out, code, err
}

// Readiness returns service readiness from GET /readiness.
func (c *Client) Readiness(ctx context.Context) (*ReadinessResponse, error) {
	var out ReadinessResponse
	_, err := c.do(ctx, http.MethodGet, pathReadiness, nil, nil, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// Liveness returns service liveness from GET /liveness.
func (c *Client) Liveness(ctx context.Context) (*LivenessResponse, error) {
	var out LivenessResponse
	_, err := c.do(ctx, http.MethodGet, pathLiveness, nil, nil, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// StreamingQuery sends a conversation request via POST /v1/streaming_query and
// streams each SSE token to onChunk as it arrives.  The returned int is the
// HTTP status code; a non-nil error means the request itself failed.
func (c *Client) StreamingQuery(ctx context.Context, req *LLMRequest, userID string, onChunk func(token string)) (int, error) {
	if req == nil {
		return http.StatusBadRequest, fmt.Errorf("LLMRequest is required")
	}
	if req.Query == "" {
		return http.StatusBadRequest, fmt.Errorf("query is required")
	}

	b, err := json.Marshal(req)
	if err != nil {
		return 0, fmt.Errorf("marshal request: %w", err)
	}

	rawURL := c.baseURL + pathStreamingQuery
	q := url.Values{}
	if userID != "" {
		q.Set("user_id", userID)
		rawURL += "?" + q.Encode()
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, rawURL, bytes.NewReader(b))
	if err != nil {
		return 0, fmt.Errorf("create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	if c.authToken != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.authToken)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return 0, fmt.Errorf("request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, &APIError{StatusCode: resp.StatusCode, Body: body}
	}

	// OLS emits fully-formed Kiali-compatible SSE events:
	//   data: {"event": "token",  "data": {"id": 0, "token": "..."}}
	//   data: {"event": "start",  "data": {"conversation_id": "..."}}
	//   data: {"event": "end",    "data": {"referenced_documents": [...], ...}}
	//   data: {"event": "tool_call",    "data": {...}}
	//   data: {"event": "tool_result",  "data": {...}}
	//
	// Strip the "data: " prefix (the handler's onChunk adds it back) and
	// forward the raw JSON payload directly so the frontend handles it the
	// same way as events from any other provider.
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payload == "" || payload == "[DONE]" {
			continue
		}
		onChunk(payload)
	}
	return resp.StatusCode, scanner.Err()
}
