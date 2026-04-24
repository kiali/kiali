---
format_version: 1
---

# API Conventions — Kiali

## Route Registration

All HTTP routes must be registered in `routing/routes.go` as entries in the `[]Route` slice. Ad-hoc route registration elsewhere is not permitted.

Each route entry must use the `Route` struct:

```go
{
    Name:          "GetServiceList",
    LogGroupName:  "services",
    Method:        "GET",
    Pattern:       "/api/namespaces/{namespace}/services",
    HandlerFunc:   handlers.GetServiceList,
    Authenticated: true,
},
```

Flag: routes registered anywhere other than `routing/routes.go`, or route entries missing required fields (`Name`, `Method`, `Pattern`, `HandlerFunc`, `Authenticated`).

## Swagger Documentation

Every handler function for a public route must have a swagger comment block. The comment must include: HTTP method, path, tag, operation ID, description, produces, and response codes.

```go
// swagger:route GET /api/namespaces/{namespace}/services kiali serviceList
// ---
// Endpoint to get the list of services for a namespace.
//
//     Produces:
//     - application/json
//
// responses:
//      200: serviceListResponse
//      500: internalError
func GetServiceList(w http.ResponseWriter, r *http.Request) {
```

Flag: new handler functions for routes in `routing/routes.go` that lack a swagger comment, or swagger comments missing response codes.

## URL Conventions

All API routes must use the `/api/` prefix. No version segment in the path.

```
// Correct
GET /api/namespaces
GET /api/namespaces/{namespace}/services
POST /api/namespaces/{namespace}/istio_validations

// Wrong — version in path
GET /api/v1/namespaces
GET /api/v2/namespaces/{namespace}/services

// Wrong — missing /api/ prefix (except for special system routes like /healthz)
GET /namespaces
```

Special routes that are exempt from the `/api/` prefix: `/healthz`, `/api/authenticate`, `/api/logout`, and other auth/health system endpoints already established in `routing/routes.go`.

Flag: new routes that introduce a version segment (`/v1/`, `/v2/`, etc.) in the path, or new routes missing the `/api/` prefix without clear justification as a system-level endpoint.

## Response Helpers

All HTTP responses must go through the centralized helpers in `handlers/base.go`:

```go
// Success responses
RespondWithJSON(w http.ResponseWriter, code int, payload interface{})

// Error responses
RespondWithError(w http.ResponseWriter, code int, message string)
RespondWithDetailedError(w http.ResponseWriter, code int, message, detail string)

// Business layer error mapping (use for all errors from business layer)
handleErrorResponse(w http.ResponseWriter, err error, extraMesg ...string)
```

```go
// Correct
result, err := in.businessLayer.GetSomething(r.Context(), namespace)
if err != nil {
    handleErrorResponse(w, err)
    return
}
RespondWithJSON(w, http.StatusOK, result)

// Wrong — bypasses centralized response formatting
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(http.StatusOK)
json.NewEncoder(w).Encode(result)
```

Flag: handlers that call `w.Write()`, `w.WriteHeader()`, `json.NewEncoder(w).Encode()`, or `json.Marshal()` for response writing instead of using the helpers above.

## Handler → Business Layer Separation

Handlers are responsible only for: parsing request parameters, calling the business layer, and formatting the response. All domain logic belongs in `business/`.

```go
// Correct — handler is thin
func (in *MyHandler) GetSomething(w http.ResponseWriter, r *http.Request) {
    namespace := r.PathValue("namespace")
    name := r.PathValue("name")

    result, err := in.businessLayer.GetSomething(r.Context(), namespace, name)
    if err != nil {
        handleErrorResponse(w, err)
        return
    }
    RespondWithJSON(w, http.StatusOK, result)
}
```

Flag:
- Handlers that contain data transformation, conditional orchestration, or filtering logic
- Handlers that directly use Kubernetes clients (`kubernetes.ClientInterface`), Prometheus clients, or other infrastructure clients — these must go through the business layer
- Handlers longer than ~20 lines of meaningful logic (a signal that business logic has leaked in)

## Changelog

| Date | Change | Trigger |
|------|--------|---------|
| 2026-04-24 | Refresh: verify patterns current, no changes needed | /code-reviewer:setup (refresh) |
| 2026-04-08 | Initial generation | /code-reviewer:setup |
