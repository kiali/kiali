package httputil

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

const (
	// oauth2TokenFetchTimeout is the maximum time allowed for a token endpoint request.
	oauth2TokenFetchTimeout = 30 * time.Second

	// oauth2MaxErrorBodyBytes caps error response bodies to prevent leaking secrets in logs.
	oauth2MaxErrorBodyBytes = 256
)

type oauth2TokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

type oauth2RoundTripper struct {
	auth       *config.Auth
	delegate   http.RoundTripper
	tokenHTTP  *http.Client

	mu          sync.RWMutex
	accessToken string
	expiry      time.Time
}

func (rt *oauth2RoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	token, err := rt.getToken(req.Context())
	if err != nil {
		return nil, fmt.Errorf("oauth2: failed to obtain token: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	return rt.delegate.RoundTrip(req)
}

func (rt *oauth2RoundTripper) getToken(ctx context.Context) (string, error) {
	rt.mu.RLock()
	if rt.accessToken != "" && time.Now().Before(rt.expiry) {
		token := rt.accessToken
		rt.mu.RUnlock()
		return token, nil
	}
	rt.mu.RUnlock()

	rt.mu.Lock()
	defer rt.mu.Unlock()

	// Double-check after acquiring write lock
	if rt.accessToken != "" && time.Now().Before(rt.expiry) {
		return rt.accessToken, nil
	}

	return rt.refreshToken(ctx)
}

func (rt *oauth2RoundTripper) refreshToken(ctx context.Context) (string, error) {
	cfg := config.Get()

	clientID, err := cfg.GetCredential(rt.auth.OAuth2.ClientID)
	if err != nil {
		return "", fmt.Errorf("oauth2: failed to read client_id: %w", err)
	}

	clientSecret, err := cfg.GetCredential(rt.auth.OAuth2.ClientSecret)
	if err != nil {
		return "", fmt.Errorf("oauth2: failed to read client_secret: %w", err)
	}

	data := url.Values{
		"grant_type":    {"client_credentials"},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
	}
	if len(rt.auth.OAuth2.Scopes) > 0 {
		data.Set("scope", strings.Join(rt.auth.OAuth2.Scopes, " "))
	}

	// Use context with timeout for cancellation and deadline propagation.
	fetchCtx, cancel := context.WithTimeout(ctx, oauth2TokenFetchTimeout)
	defer cancel()

	tokenReq, err := http.NewRequestWithContext(fetchCtx, http.MethodPost, rt.auth.OAuth2.TokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("oauth2: failed to build token request: %w", err)
	}
	tokenReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := rt.tokenHTTP.Do(tokenReq)
	if err != nil {
		return "", fmt.Errorf("oauth2: token request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read body with a size cap to avoid logging secrets from large error responses.
	body, err := io.ReadAll(io.LimitReader(resp.Body, oauth2MaxErrorBodyBytes+1))
	if err != nil {
		return "", fmt.Errorf("oauth2: failed to read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		truncated := string(body)
		if len(truncated) > oauth2MaxErrorBodyBytes {
			truncated = truncated[:oauth2MaxErrorBodyBytes] + "...(truncated)"
		}
		return "", fmt.Errorf("oauth2: token endpoint returned %d: %s", resp.StatusCode, truncated)
	}

	var tokenResp oauth2TokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("oauth2: failed to parse token response: %w", err)
	}

	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("oauth2: token endpoint returned empty access_token")
	}

	if !strings.EqualFold(tokenResp.TokenType, "bearer") && tokenResp.TokenType != "" {
		return "", fmt.Errorf("oauth2: unsupported token_type %q (expected Bearer)", tokenResp.TokenType)
	}

	// Cache with 10% safety margin on expiry
	expiresIn := time.Duration(tokenResp.ExpiresIn) * time.Second
	if expiresIn <= 0 {
		expiresIn = 5 * time.Minute
	}
	rt.accessToken = tokenResp.AccessToken
	rt.expiry = time.Now().Add(expiresIn * 9 / 10)

	log.Debugf("oauth2: obtained token (expires in %v)", expiresIn)
	return rt.accessToken, nil
}

func newOAuth2RoundTripper(_ *config.Config, auth *config.Auth, delegate http.RoundTripper) http.RoundTripper {
	// Use the delegate transport for token requests so that user-configured
	// proxy, TLS, and CA settings are respected.
	tokenClient := &http.Client{
		Transport: delegate,
		Timeout:   oauth2TokenFetchTimeout,
	}
	return &oauth2RoundTripper{
		auth:      auth,
		delegate:  delegate,
		tokenHTTP: tokenClient,
	}
}
