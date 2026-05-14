---
scribe:
  title: "Authentication and Security"
  description: "How Kiali authenticates users — five strategies, cookie-based session persistence, TLS policy resolution, and the JWT utility package."
  watch_paths: [handlers/authentication/, jwt/, tlspolicy/]
  scan: "f9d619df93bb21a45a15076ec025938f8e79f856"
  freshness: 88
  human_input: 0
  completeness: 86
  inferred_sections:
    - {id: "overview", heading: "Overview"}
    - {id: "auth-controller-interface", heading: "The AuthController Interface"}
    - {id: "strategies", heading: "Authentication Strategies"}
    - {id: "openid-flow", heading: "OpenID Connect Flow"}
    - {id: "openshift-flow", heading: "OpenShift OAuth Flow"}
    - {id: "token-strategy", heading: "Token Strategy"}
    - {id: "header-strategy", heading: "Header (Proxy) Strategy"}
    - {id: "session-persistence", heading: "Session Persistence"}
    - {id: "context-propagation", heading: "Auth Context Propagation"}
    - {id: "jwt-package", heading: "JWT Package"}
    - {id: "tls-policy", heading: "TLS Policy Resolution"}
  stale_flags: []
  review_notes:
    - finding: "openid-flow:5: validateOpenIdNonceCode does NOT separately reject non-string nonces — it uses a single combined condition (!nonceIsString || nonceHashHex != nonceStr) producing one undifferentiated 'nonce code mismatch' error for both cases."
      severity: minor
      tag: inaccurate
      confidence: 0.97
      date: "2026-05-14"
    - finding: "Line number references in openid-flow sections are systematically off by ~60-190 lines (PKCE additions shifted the controller). openid-flow:1 actual: 35-45; :2 actual: 135-138; :3 actual: 213; :4 actual: 235-242; :6 actual: line 285."
      severity: minor
      tag: wrong-lines
      confidence: 0.95
      date: "2026-05-14"
    - finding: "ErrSubjectMismatch checks in OpenID ValidateSession are bypassed when ApiToken == 'access_token' — a security scope boundary not mentioned in the docs."
      severity: minor
      tag: gap
      confidence: 0.9
      date: "2026-05-14"
    - finding: "Header auth ValidateSession silently skips setting Kiali-User when GetTokenSubject errors but still returns a valid session — the audit trail guarantee is conditional."
      severity: minor
      tag: gap
      confidence: 0.9
      date: "2026-05-14"
---

# Authentication and Security

> TL;DR: Kiali supports five authentication strategies selected at startup. Each is backed by an `AuthController` implementation. Sessions are stored entirely client-side in AES-GCM encrypted cookies. The `tlspolicy` package resolves TLS settings from either explicit config or the OpenShift cluster profile.

## Overview

Kiali's authentication system lives in `handlers/authentication/`. At startup a single `AuthController` is instantiated based on the `auth.strategy` configuration field. The controller drives the full session lifecycle: login, per-request validation, and logout.

The five strategies are:

| Strategy | Config value | Primary use |
|---|---|---|
| Anonymous | `anonymous` | `kiali run` local mode (forced); development / no-auth setups |
| Token | `token` | Service-account or user tokens passed directly |
| OpenID Connect | `openid` | External OIDC providers (Keycloak, Dex, Google, …) |
| OpenShift OAuth | `openshift` | OpenShift-native OAuth server |
| Header | `header` | Reverse proxy / impersonation (pre-authenticated) |

## The AuthController Interface

Every strategy implements the `AuthController` interface defined in `handlers/authentication/auth_controller.go`:

```go
type AuthController interface {
    Authenticate(r *http.Request, w http.ResponseWriter) (*UserSessionData, error)
    ValidateSession(r *http.Request, w http.ResponseWriter) (UserSessions, error)
    TerminateSession(r *http.Request, w http.ResponseWriter) error
}
```

- **`Authenticate`** — processes an incoming login request and returns a `*UserSessionData` on success, or an `*AuthenticationFailureError` on failure (HTTP 401/403). Any other error type signals an unexpected internal fault.
- **`ValidateSession`** — called on every authenticated request to restore and re-validate an existing session. Returns `UserSessions` (a `map[string]*UserSessionData`, keyed by cluster name) when valid.
- **`TerminateSession`** — clears all session state unconditionally (called by logout handlers).

`UserSessionData` carries the Kubernetes `api.AuthInfo` (typically just a bearer token), expiry time, display username, and an internal `SessionID` used for graph caching. The `AuthInfo` field is excluded from JSON serialisation (`json:"-"`) — it is never sent to the frontend.

`UserSessions` is `map[string]*UserSessionData`, allowing a single Kiali instance to maintain per-cluster sessions (important in multi-cluster deployments).

`TerminateSessionError` is a distinct error type that carries an HTTP status code for proper response handling in logout paths.

`ErrSubjectMismatch` is a package-level sentinel error (`var ErrSubjectMismatch = fmt.Errorf("subject mismatch")`) used when the subject claim in a refreshed token does not match the stored subject, indicating a potential session integrity violation. Callers can test for it with `errors.Is`.

## Authentication Strategies

### Anonymous

Not backed by an `auth_controller` file — when strategy is `anonymous`, the middleware simply injects the Kiali service-account token for every request with no credential verification.

### Token Strategy (`token_auth_controller.go`)

The token strategy accepts a raw bearer token submitted as `token` form data in a POST request. Validation is performed by attempting to list namespaces against the cluster API using the submitted token. If the API accepts the token and returns at least one namespace, the session is created.

Session payload (`tokenSessionPayload`) stores only the raw token string, encrypted in a cookie.

On `ValidateSession`, the stored token is extracted and re-verified against the namespace API on every request. `extractSubjectFromK8sToken` parses the `sub` claim from the token JWT to derive a display username, stripping the `system:serviceaccount:` prefix that Kubernetes adds for service accounts.

The session lifetime is set from `conf.LoginToken.ExpirationSeconds`.

`ValidateSession` uses `r.Header.Set` for the `Kiali-User` audit header to prevent duplicate header accumulation.

### Header (Proxy/Impersonation) Strategy (`header_auth_controller.go`)

Designed for environments where an authenticating reverse proxy sits in front of Kiali. The strategy reads credentials from:
- `Authorization: Bearer <token>` — the primary bearer token for Kubernetes API calls.
- `Impersonate-User` — optional Kubernetes impersonation target user.
- `Impersonate-Group` — optional impersonation group(s).
- `Impersonate-Extra-*` — arbitrary impersonation extra attributes.

All of these are assembled into a `*api.AuthInfo` struct and passed through to Kubernetes clients verbatim. Validation of the token's authenticity is delegated to Kubernetes (via `GetTokenSubject`, which calls the TokenReview API). Kiali itself does not evaluate RBAC for this strategy.

**Display name logic** (`Authenticate`): The verified token subject (stripped of the `system:serviceaccount:` prefix) is stored as `tokenOwner`. If `authInfo.Impersonate` is non-empty, the `displayName` is set to the impersonation target and an audit log message records `"Header auth: token owner [%s] is impersonating [%s]"`. Otherwise `displayName` equals `tokenOwner`. Only `displayName` is stored in the session cookie; the actual token owner is re-derived at validation time.

**Audit header in `ValidateSession`**: The `Kiali-User` header is set to the token's *verified* subject (via a fresh `GetTokenSubject` call), not the session-stored display name. This prevents the audit trail from being poisoned via a controlled `Impersonate-User` header. If subject verification fails, a warning is logged but the session remains valid.

`ValidateSession` for header auth is stateless: as long as the `Authorization` header is present, the session is considered valid, even if the encrypted session cookie has expired. The cookie is used only to recover the display username and session ID between requests.

### OpenShift OAuth Flow (`openshift_auth_controller.go`)

Implements OAuth 2.0 authorization code flow against OpenShift's built-in OAuth server, using the `golang.org/x/oauth2` package. The controller uses `business.OpenshiftOAuthService` for OAuth metadata and token exchange.

The flow:
1. `/api/auth/redirect` (optionally `/api/auth/redirect/{cluster}`) — generates a PKCE verifier (`oauth2.GenerateVerifier()`), stores it in a nonce cookie (SameSite=Lax), and redirects to the OpenShift OAuth authorization URL.
2. The OpenShift OAuth server calls back to `/api/auth/callback` (optionally `/api/auth/callback/{cluster}`). The controller reads the nonce cookie (which contains the verifier) and exchanges the `code` for a token via `OpenshiftOAuthService.Exchange`.
3. On success, the `oauth2.Token` (wrapped in `openshiftSessionPayload`) is encrypted and persisted in a cookie.

`ValidateSession` checks three sources in priority order:
1. `Authorization: Bearer <token>` HTTP header — for third-party managed sessions.
2. `oauth_token` URL query parameter — alternative for third-party sessions.
3. Encrypted session cookie — for Kiali-initiated sessions.

For third-party sessions (cases 1 and 2), Kiali does not create its own cookie. Token validity is re-confirmed each request via `OpenshiftOAuthService.GetUserInfo`.

For multi-cluster deployments, `ReadAllSessions` retrieves sessions for each cluster independently. Each cluster has its own cookie keyed by cluster name.

`ValidateSession` uses `r.Header.Set` for the `Kiali-User` audit header.

**`oauth_token` URL parameter security note**: The `oauth_token` URL query parameter path carries a code comment warning that this parameter is logged by proxies and browsers. Operators should configure proxies/ingress to strip or mask it from access logs.

## OpenID Connect Flow

`openid_auth_controller.go` implements the OIDC authorization code flow. Only the authorization code flow is supported — `Authenticate` returns an error for any other flow type.

**Global caches**: `cachedOpenIdMetadata` and `cachedOpenIdKeySet` are `atomic.Pointer[T]` values, making load/store operations race-free without an explicit mutex. `singleflight` prevents concurrent fetches of the same remote resource.

**`web_fqdn` warning**: `NewOpenIdAuthController` logs a startup warning when `conf.Server.WebFQDN` is empty, because the OIDC `redirect_uri` would be derived from request `Host` headers, which can be manipulated if Kiali is not behind a trusted proxy.

### Authorization Code Flow

**Step 1 — Redirect (`redirectToAuthServerHandler`):**
- Fetches provider metadata from `<issuer_uri>/.well-known/openid-configuration` (cached after first fetch, protected by `singleflight` to prevent concurrent fetches).
- Generates a 15-character cryptographic nonce.
- Generates a PKCE code verifier (RFC 7636, 43 characters from `[A-Za-z0-9\-._~]`) and derives the code challenge via `SHA-256 + Base64URL`.
- Sets two `SameSite=Lax` cookies: `kiali-token-nonce-<cluster>` storing the **raw** 15-character nonce, and `kiali-token-pkce-verifier-<cluster>` storing the raw PKCE code verifier. (The SHA-224 hash of the nonce is computed separately and sent to the IdP in the authorization URL's `nonce` parameter — it is not stored in the cookie.)
- Computes the CSRF state parameter: `SHA-224(nonce + timestamp + signingKey)` concatenated with the timestamp.
- Redirects to the authorization endpoint with `response_type=code`, scopes, nonce hash, state, `code_challenge`, and `code_challenge_method=S256`.

**Step 2 — Callback (`authenticateWithAuthorizationCodeFlow`):**

The flow is implemented as a fluent chain of method calls on `openidFlowHelper`:

```
extractOpenIdCallbackParams
  → checkOpenIdAuthorizationCodeFlowParams   (verifies code, state, nonce, verifier present)
  → callbackCleanup                          (deletes nonce + verifier cookies)
  → validateOpenIdState                      (CSRF check: recomputes state hash)
  → requestOpenIdToken                       (POSTs code + code_verifier to token endpoint)
  → parseOpenIdToken                         (parses id_token JWT claims, extracts exp + sub)
  → validateOpenIdNonceCode                  (replay-attack check: nonce hash in id_token)
  → checkAllowedDomains                      (optional: hd/email domain filtering)
  → checkUserPrivileges                      (RBAC check or in-house JWT validation)
  → createSession                            (encrypts payload into cookie)
```

### Discovery Override

Metadata endpoint selection follows a precedence chain (issue #8777):
1. `auth.openid.discovery_override.authorization_endpoint` + `token_endpoint` fully set — use explicit endpoints (for restricted environments where discovery is blocked).
2. Deprecated `auth.openid.authorization_endpoint` alone — used for the redirect only; other endpoints still come from discovery.
3. Default: OIDC discovery via `<issuer_uri>/.well-known/openid-configuration`.

### RBAC Modes

- **RBAC enabled** (default): The OIDC token (id_token or access_token, per `auth.openid.api_token`) is used directly for Kubernetes API calls. Privilege check: attempt to list namespaces. If no namespaces are visible, login is rejected.
- **RBAC disabled**: Kiali validates the id_token in-house (signature check against JWKS endpoint, iss/aud/iat/exp claims) and then uses the Kiali service-account token for all API calls. All authenticated users share the same cluster permissions.

In-house validation (`validateOpenIdTokenInHouse`) currently requires RS256 algorithm and a `kid` header. The JWKS key set is cached (via `atomic.Pointer`) but refreshed when an unknown `kid` is encountered.

**`ValidateSession` error semantics**:
- When the OIDC token is absent from the stored session, the method returns `fmt.Errorf("session [%w]: OIDC token is absent", ErrSessionNotFound)`. Callers can detect this sentinel with `errors.Is(err, ErrSessionNotFound)`.
- Subject claim mismatch returns `fmt.Errorf("session [%w]: …", ErrSubjectMismatch)`.
- If the configured `username_claim` is present in the id_token but is not a string, validation fails with `ErrSubjectMismatch`.
- `r.Header.Set` is used for the `Kiali-User` audit header to prevent duplicate header accumulation.

**Nonce validation** (`validateOpenIdNonceCode`): An absent `nonce` claim in the id_token produces error `"nonce claim is absent"`. A non-string or mismatched nonce produces `"nonce code mismatch"` via a combined `(!nonceIsString || hashMismatch)` condition.

### Configurable Options

- `auth.openid.username_claim` — JWT claim used as display username (defaults to `sub`).
- `auth.openid.allowed_domains` — whitelist by `hd` or email domain.
- `auth.openid.scopes` — additional scopes (openid is always added).
- `auth.openid.additional_request_params` — arbitrary extra params appended to the redirect URL.
- `auth.openid.http_proxy` / `https_proxy` — proxy for IdP connections.
- Custom CA: via `kiali-cabundle` ConfigMap (`openid-server-ca.crt` or `additional-ca-bundle.pem`).

## Session Persistence

### CookieSessionPersistor

All strategies use `cookieSessionPersistor[T]` (`session_persistor.go`), a generic type where `T` is the strategy-specific payload struct. No server-side storage is used — the entire session lives in the browser's cookies.

**Encryption**: AES-GCM with a key sourced from `conf.LoginToken.SigningKey`. The signing key must be exactly 16, 24, or 32 bytes (AES-128, AES-192, or AES-256). The cipher is re-created on each cookie read/write to support key rotation without pod restarts.

**Session creation** (`CreateSession`):
1. Serialize `SessionData[T]` to JSON. `SessionData` includes: cluster name, expiry, strategy name, unique UUID session ID, and the type parameter payload.
2. Encrypt with AES-GCM: nonce prepended to ciphertext.
3. Base64-encode.
4. Split into 3584-byte chunks (major browsers limit cookies to ~4 KB; 3.5 KB leaves headroom for cookie metadata).
5. Write chunk cookies with names `kiali-token`, `kiali-token-<cluster>-1`, `kiali-token-<cluster>-2`, etc. A `kiali-token-chunks-<cluster>` cookie records the total chunk count.
6. All session cookies are `HttpOnly`, `SameSite=Strict`, `Path=<webRoot>`, and `Secure` when Kiali is served over HTTPS.

**Session reading** (`ReadSession`):
1. Locate the base cookie by key (cluster name).
2. Check for a chunks cookie; if present, reassemble from numbered chunk cookies.
3. Decrypt and deserialize.
4. Validate: strategy name must match current config (prevents stale sessions after strategy changes), and expiry must be in the future.

**Multi-session reading** (`ReadAllSessions`):
Iterates all cookies in the request, identifies candidates by the `kiali-token` prefix (excluding nonce and chunks-count cookies), and attempts to decrypt each. Cookies that fail decryption (e.g., mid-chunk continuation cookies) are silently skipped without being dropped, because session keys can end in numbers making them indistinguishable from chunk number suffixes by name alone.

After successfully decrypting a session, `ReadAllSessions` performs two checks before including the session in the result:

1. **Strategy mismatch check**: If `sData.Strategy != conf.Auth.Strategy`, the session is terminated (`TerminateSession` is called, zeroing the cookie with `MaxAge=-1`) and skipped. This prevents sessions from a previous auth strategy being replayed after a strategy change.
2. **Expiry check**: If the current time is not before `sData.ExpiresOn`, the session is terminated and skipped.

**Session termination** (`TerminateSession`):
Overwrites all session-related cookies (`kiali-token*` prefix) with `MaxAge=-1` and an epoch expiry. Does not touch nonce or PKCE verifier cookies, which are managed by the auth controllers.

### Cookie Names

| Cookie | Purpose |
|---|---|
| `kiali-token` / `kiali-token-<cluster>` | Session data (chunk 0) |
| `kiali-token-<cluster>-<N>` | Additional session chunks |
| `kiali-token-chunks-<cluster>` | Total chunk count |
| `kiali-token-nonce-<cluster>` | OIDC/OAuth nonce (CSRF/replay mitigation) |
| `kiali-token-pkce-verifier-<cluster>` | PKCE code verifier |

## Auth Context Propagation

`context.go` defines two context keys for propagating auth state through the request pipeline:

- `ContextKeyAuthInfo` — carries `map[string]*api.AuthInfo` (one entry per cluster) for the current request (used by `getAuthInfo` in `handlers/utils.go` to construct the per-user `business.Layer`).
- `ContextKeySessionID` — carries the session UUID string (used by the graph cache layer to partition cached graphs per session).

`SetAuthInfoContext` / `GetAuthInfoContext` and `SetSessionIDContext` / `GetSessionIDContext` are the typed accessors.

Additionally, most `ValidateSession` implementations add the `Kiali-User` internal request header for audit logging — specifically token and OpenShift strategies. The header strategy does not set this header, as the proxy is expected to have already authenticated the user.

## JWT Package

`jwt/jwt.go` is a thin wrapper around `github.com/go-jose/go-jose/v4/jwt`. Its sole purpose is to enforce a safe algorithm allowlist when parsing JWTs.

```go
var AllowedSignatureAlgorithms = []jose.SignatureAlgorithm{
    jose.ES256, jose.ES384, jose.ES512,
    jose.EdDSA,
    jose.HS256, jose.HS384, jose.HS512,
    jose.PS256, jose.PS384, jose.PS512,
    jose.RS256, jose.RS384, jose.RS512,
}
```

Two functions are exposed:

- `ParseSigned(token string) (*jwt.JSONWebToken, error)` — parses a JWT and returns an object from which claims can be extracted (with or without signature verification). Used for reading `sub`, `exp`, `iat`, `nonce`, `aud`, `iss` claims from OIDC id_tokens and Kubernetes bearer tokens.
- `ParseSignedCompact(token string) (*jose.JSONWebSignature, error)` — parses the raw JWS structure, used when signature verification against a JWKS key is required (the `validateOpenIdTokenInHouse` path).

The package intentionally does not expose signature verification itself — callers either rely on the Kubernetes API to validate tokens (RBAC-on path) or call `jws.Verify(key)` directly in the OpenID controller (RBAC-off in-house validation path).

## TLS Policy Resolution

`tlspolicy/resolver.go` computes the effective TLS configuration for Kiali's own HTTPS server. The entry point is:

```go
func Resolve(ctx context.Context, conf *config.Config, client kubernetes.ClientInterface) (config.TLSPolicy, error)
```

It reads `conf.Deployment.TLSConfig.Source` and dispatches to one of two paths:

### Config source (`deployment.tls_config.source: config`)

Reads explicit values from `deployment.tls_config`:
- `min_version` / `max_version` — accepted as `TLSv1.2`, `TLS1.2`, `VersionTLS12`, `TLSv1.3`, etc. TLS 1.0 and 1.1 are rejected with an error.
- `cipher_suites` — list of cipher names in either IANA format (`TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`) or OpenSSL format (`ECDHE-RSA-AES128-GCM-SHA256`). Unsupported names are logged and skipped.
- If no ciphers are specified, Go's secure default TLS 1.2 cipher suites are used (derived dynamically from `tls.CipherSuites()`).
- If min version is TLS 1.3, cipher suite configuration is skipped entirely (Go manages TLS 1.3 ciphers internally).

### Auto source (`deployment.tls_config.source: auto`) — OpenShift only

Queries the OpenShift `APIServer` cluster object for its `TLSSecurityProfile`. Supports four profile types:
- `Old` — TLS 1.0+ with a broad cipher list (Kiali rejects TLS 1.0/1.1, so effectively TLS 1.2 in practice).
- `Intermediate` — TLS 1.2+, modern cipher set. **This is the OpenShift default** when no profile is configured.
- `Modern` — TLS 1.3 only.
- `Custom` — operator-defined profile.

The profile's cipher names are in OpenSSL format; the resolver translates them to Go's IANA names using a built-in `opensslToIANA` map.

The `TLSPolicy` struct (`config.TLSPolicy`) is then applied to the server's `tls.Config` via an `ApplyTo` method. Both cipher resolution and default cipher list construction are done lazily with `sync.Once` guards.

> Note: `tlspolicy` deals only with Kiali's own HTTPS listener TLS settings. Istio mTLS enforcement (mesh-wide, namespace, or workload-level) is handled by a separate business layer (`business/tls.go` and related types) that reads `PeerAuthentication` and `DestinationRule` resources from the cluster.
