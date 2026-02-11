package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const (
	pathAuthorized           = "/authorized"
	pathFeedbackStatus       = "/v1/feedback/status"
	pathLiveness             = "/liveness"
	pathMCPClientAuthHeaders = "/v1/mcp/client-auth-headers"
	pathQuery                = "/v1/query"
	pathReadiness            = "/readiness"
	pathStreamingQuery       = "/v1/streaming_query"
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

// WithAuthToken sets the Bearer token used for authenticated endpoints.
func WithAuthToken(token string) Option {
	return func(client *Client) {
		client.authToken = strings.TrimSpace(token)
	}
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
func (c *Client) Authorized(ctx context.Context, userID string) (*AuthorizationResponse, error) {
	q := url.Values{}
	if userID != "" {
		q.Set("user_id", userID)
	}
	var out AuthorizationResponse
	_, err := c.do(ctx, http.MethodPost, pathAuthorized, q, nil, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
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

// Query sends a conversation request via POST /v1/query and returns the full response.
// Optional userID is sent as query parameter when no-op auth is enabled.
func (c *Client) Query(ctx context.Context, req *LLMRequest, userID string) (*LLMResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("LLMRequest is required")
	}
	if req.Query == "" {
		return nil, fmt.Errorf("query is required")
	}
	q := url.Values{}
	if userID != "" {
		q.Set("user_id", userID)
	}
	var out LLMResponse
	_, err := c.do(ctx, http.MethodPost, pathQuery, q, req, &out)
	if err != nil {
		return nil, err
	}
	return &out, nil
}
