---
format_version: 1
---

# Security Posture — Kiali

## Route Authentication Flag

Every route registered in `routing/routes.go` must have an explicit, deliberate value for the `Authenticated` field. Since the zero value of `bool` is `false`, omitting this field silently makes the route public.

```go
// Correct — explicitly set in both cases
{Name: "GetNamespaces", Method: "GET", Pattern: "/api/namespaces",
    HandlerFunc: handlers.GetNamespaces, Authenticated: true},

{Name: "Healthz", Method: "GET", Pattern: "/healthz",
    HandlerFunc: handlers.Healthz, Authenticated: false},

// Wrong — omitted, defaults to false (publicly accessible)
{Name: "GetSecretData", Method: "GET", Pattern: "/api/secrets",
    HandlerFunc: handlers.GetSecretData},
```

Flag: any new or modified route entry where `Authenticated` is not present. The reviewer must also verify the value is correct for the route's intended access level — not just present.

## RBAC in the Business Layer

Authorization checks belong exclusively in the business layer (`business/`). Handlers must not perform their own authorization logic. The correct flow is:

1. Handler calls into business layer
2. Business layer performs the RBAC check; returns an error satisfying `business.IsAccessibleError()` if denied
3. Handler passes the error to `handleErrorResponse()`, which maps it to HTTP 403

```go
// Correct — handler delegates, business layer checks
func (in *NamespaceHandler) GetNamespace(w http.ResponseWriter, r *http.Request) {
    ns, err := in.businessLayer.GetNamespace(r.Context(), namespace)
    if err != nil {
        handleErrorResponse(w, err) // maps IsAccessibleError → 403
        return
    }
    RespondWithJSON(w, http.StatusOK, ns)
}

// Wrong — handler doing its own authz
func (in *NamespaceHandler) GetNamespace(w http.ResponseWriter, r *http.Request) {
    token := r.Header.Get("Authorization")
    if !isAllowed(token, namespace) {
        w.WriteHeader(http.StatusForbidden)
        return
    }
    // ...
}
```

Flag: any authorization logic (role checks, token inspection, permission validation) performed directly in a handler rather than delegated to the business layer.

## No Hardcoded Credentials

Secrets, tokens, passwords, API keys, and certificates must never appear as string literals in source code. All sensitive values must be sourced from:

- Kiali's `config` package (e.g. `config.Auth`, `config.ExternalServices`)
- Environment variables
- Kubernetes secrets mounted at runtime

```go
// Correct
token := conf.ExternalServices.Prometheus.Auth.Token

// Wrong
token := "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
password := "admin123"
apiKey := "sk-..."
```

Flag: string literals in source code that resemble tokens, passwords, API keys, bearer tokens, or certificate data. Also flag any new external service integration that hardcodes connection credentials rather than reading from `config.*`.

## Changelog

| Date | Change | Trigger |
|------|--------|---------|
| 2026-04-24 | Refresh: verify auth/RBAC patterns current, no changes needed | /code-reviewer:setup (refresh) |
| 2026-04-08 | Initial generation | /code-reviewer:setup |
