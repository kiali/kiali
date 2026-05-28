package httputil

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

const (
	oauth2TokenFetchTimeout = 30 * time.Second
)

type oauth2RoundTripper struct {
	auth     *config.Auth
	conf     *config.Config
	delegate http.RoundTripper
	tokenRT  http.RoundTripper

	mu          sync.RWMutex
	cachedTok   *oauth2.Token
	originalTTL time.Duration // TTL at issuance, for stable expiry buffer calculation
}

func (rt *oauth2RoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	return rt.roundTrip(req, false)
}

func (rt *oauth2RoundTripper) roundTrip(req *http.Request, isRetry bool) (*http.Response, error) {
	tok, err := rt.ensureToken(req.Context())
	if err != nil {
		return nil, fmt.Errorf("oauth2: failed to obtain token: %w", err)
	}

	outReq := req.Clone(req.Context())
	outReq.Header.Set("Authorization", "Bearer "+tok.AccessToken)

	resp, err := rt.delegate.RoundTrip(outReq)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusUnauthorized && !isRetry {
		if req.Body != nil && req.GetBody == nil {
			return resp, nil
		}

		resp.Body.Close()

		if req.GetBody != nil {
			req.Body, _ = req.GetBody()
		}

		rt.mu.Lock()
		rt.cachedTok = nil
		rt.mu.Unlock()

		return rt.roundTrip(req, true)
	}

	return resp, nil
}

func (rt *oauth2RoundTripper) ensureToken(ctx context.Context) (*oauth2.Token, error) {
	rt.mu.RLock()
	tok := rt.cachedTok
	rt.mu.RUnlock()

	if tok != nil && !tokenNearExpiry(tok, rt.originalTTL) {
		return tok, nil
	}

	rt.mu.Lock()
	defer rt.mu.Unlock()

	if rt.cachedTok != nil && !tokenNearExpiry(rt.cachedTok, rt.originalTTL) {
		return rt.cachedTok, nil
	}

	return rt.refreshToken(ctx)
}

func (rt *oauth2RoundTripper) refreshToken(ctx context.Context) (*oauth2.Token, error) {
	clientSecret, err := rt.conf.GetCredential(rt.auth.OAuth2.ClientSecret)
	if err != nil {
		return nil, fmt.Errorf("oauth2: failed to read client_secret: %w", err)
	}

	var endpointParams url.Values
	if rt.auth.OAuth2.Audience != "" {
		endpointParams = url.Values{"audience": {rt.auth.OAuth2.Audience}}
	}

	ccConfig := clientcredentials.Config{
		AuthStyle:      mapAuthStyle(rt.auth.OAuth2.AuthStyle),
		ClientID:       rt.auth.OAuth2.ClientID,
		ClientSecret:   clientSecret,
		EndpointParams: endpointParams,
		Scopes:         rt.auth.OAuth2.Scopes,
		TokenURL:       rt.auth.OAuth2.TokenURL,
	}

	fetchCtx, cancel := context.WithTimeout(ctx, oauth2TokenFetchTimeout)
	defer cancel()

	tokenClient := &http.Client{Transport: rt.tokenRT}
	fetchCtx = context.WithValue(fetchCtx, oauth2.HTTPClient, tokenClient)

	tok, err := ccConfig.TokenSource(fetchCtx).Token()
	if err != nil {
		var rErr *oauth2.RetrieveError
		if errors.As(err, &rErr) && rErr.Response != nil && rErr.Response.StatusCode == http.StatusUnauthorized {
			rt.cachedTok = nil
			freshSecret, sErr := rt.conf.GetCredential(rt.auth.OAuth2.ClientSecret)
			if sErr != nil {
				return nil, fmt.Errorf("oauth2: failed to re-read client_secret after 401: %w", sErr)
			}
			retryCfg := clientcredentials.Config{
				AuthStyle:      mapAuthStyle(rt.auth.OAuth2.AuthStyle),
				ClientID:       rt.auth.OAuth2.ClientID,
				ClientSecret:   freshSecret,
				EndpointParams: endpointParams,
				Scopes:         rt.auth.OAuth2.Scopes,
				TokenURL:       rt.auth.OAuth2.TokenURL,
			}
			retryCtx, retryCancel := context.WithTimeout(ctx, oauth2TokenFetchTimeout)
			defer retryCancel()
			retryCtx = context.WithValue(retryCtx, oauth2.HTTPClient, tokenClient)

			tok, err = retryCfg.TokenSource(retryCtx).Token()
			if err != nil {
				return nil, fmt.Errorf("oauth2: token acquisition failed after secret re-read: %w", err)
			}
			rt.cachedTok = tok
			rt.originalTTL = time.Until(tok.Expiry)
			log.Debugf("oauth2: obtained token after secret rotation (expires at %v)", tok.Expiry)
			return tok, nil
		}
		return nil, fmt.Errorf("oauth2: token acquisition failed: %w", err)
	}

	rt.cachedTok = tok
	rt.originalTTL = time.Until(tok.Expiry)
	log.Debugf("oauth2: obtained token (expires at %v)", tok.Expiry)
	return tok, nil
}

// tokenNearExpiry checks if the token is within its expiry buffer (10% of original TTL clamped to [10s, 5min]).
func tokenNearExpiry(tok *oauth2.Token, originalTTL time.Duration) bool {
	if tok.Expiry.IsZero() {
		return false
	}
	buffer := originalTTL / 10
	if buffer < 10*time.Second {
		buffer = 10 * time.Second
	}
	if buffer > 5*time.Minute {
		buffer = 5 * time.Minute
	}
	return time.Now().Add(buffer).After(tok.Expiry)
}

func mapAuthStyle(style string) oauth2.AuthStyle {
	switch style {
	case "params":
		return oauth2.AuthStyleInParams
	case "header":
		return oauth2.AuthStyleInHeader
	default:
		return oauth2.AuthStyleAutoDetect
	}
}

func newOAuth2RoundTripper(conf *config.Config, auth *config.Auth, delegate http.RoundTripper) http.RoundTripper {
	tokenTransport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout: 30 * time.Second,
		}).DialContext,
		IdleConnTimeout:     90 * time.Second,
		MaxIdleConns:        10,
		Proxy:               http.ProxyFromEnvironment,
		TLSClientConfig:     buildTokenTLSConfig(conf),
		TLSHandshakeTimeout: 10 * time.Second,
	}

	return &oauth2RoundTripper{
		auth:     auth,
		conf:     conf,
		delegate: delegate,
		tokenRT:  tokenTransport,
	}
}

// buildTokenTLSConfig creates a TLS config for the token endpoint that always verifies
// server certificates regardless of the service auth's InsecureSkipVerify setting.
func buildTokenTLSConfig(conf *config.Config) *tls.Config {
	cfg := &tls.Config{
		InsecureSkipVerify: true,
		VerifyConnection: func(cs tls.ConnectionState) error {
			roots := conf.CertPool()
			return verifyServerCertificate(cs, roots)
		},
	}
	conf.ResolvedTLSPolicy.ApplyTo(cfg)
	return cfg
}
