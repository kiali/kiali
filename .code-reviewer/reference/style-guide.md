---
format_version: 1
---

# Style Guide — Kiali

## Existing Documentation

The project has comprehensive style documentation. Reviewers must enforce these in addition to the patterns below:

- **`STYLE_GUIDE.adoc`** — canonical style reference for Go and TypeScript
- **`AGENTS.md`** — AI assistant and developer guide with code quality standards
- **`.golangci.yml`** — enforced Go linting rules including goimports
- **`.prettierrc.json`** — TypeScript formatting: `printWidth: 120`, `singleQuote: true`, `trailingComma: none`, `arrowParens: avoid`
- **`.eslintrc`** — TypeScript linting: extends react-app, forbids default exports, disables jsx-a11y

## Go Conventions

### Import Organization

Imports must be organized in exactly 3 groups separated by blank lines:

```go
import (
    // 1. Standard library
    "context"
    "fmt"

    // 2. Third-party
    "k8s.io/client-go/tools/clientcmd/api"

    // 3. Kiali internal
    "github.com/kiali/kiali/log"
)
```

Flag: imports not in 3 groups, missing blank line separators, or kiali packages mixed with third-party.

### Struct Field Ordering

All struct fields — exported and unexported — must be sorted alphabetically. This applies to both type definitions and struct literal initialization.

```go
// Correct
type MyService struct {
    conf      *config.Config
    grafana   grafana.ClientInterface
    promClient prometheus.ClientInterface
}

// Also correct (literals)
svc := MyService{
    conf:      cfg,
    grafana:   grafanaClient,
    promClient: prom,
}
```

Flag: any struct with fields in non-alphabetical order. Reference: `AGENTS.md`.

**Accepted exception:** `models.IstioValidationKey` keeps its historical field order (`ObjectGVK, Name, Namespace, Cluster`), and its literals follow that order throughout the checkers. Do not flag or reorder these.

### Comments

Comments must explain **why**, not **what**. Describing what the code does is redundant — the code itself says that.

```go
// Correct: explains why
// We adjust the error code here because the upstream API returns 200 on partial failures.

// Wrong: describes what
// This function sets the error code in the response.
```

Flag: comments that merely restate the operation the code is performing.

### Error Handling

Errors from the business layer must be mapped to HTTP status codes via `handleErrorResponse()` in `handlers/errors.go`. Do not manually write error status codes in handlers.

```go
// Correct
result, err := in.businessLayer.GetSomething(r.Context(), namespace)
if err != nil {
    handleErrorResponse(w, err)
    return
}

// Wrong
if err != nil {
    w.WriteHeader(http.StatusInternalServerError)
    return
}
```

`handleErrorResponse()` handles the full mapping:
- `business.IsAccessibleError(err)` → 403
- `k8s errors.IsForbidden(err)` (API server rejected the user's own credentials) → 403
- `k8s errors.IsNotFound(err)` → 404
- `errors.IsServiceUnavailable(err)` → 503
- Everything else → 500 (including k8s Unauthorized — never 401: the frontend's global axios interceptor ends the session on any 401, and k8s Unauthorized can come from a remote-cluster credential rather than the user's session)

**Accepted exception — the canonical namespace gate:** the gate helpers in `handlers/utils.go` (`respondNamespaceAccessError`, `respondNamespaceNotAccessible`) deliberately write the 403/500 themselves instead of going through `handleErrorResponse()`: the gate must produce one fixed message ("Cannot access namespace data: …") so the status text cannot diverge between endpoints, and set-computation failures map to a flat 500 per the plan's error-code contract for the canonical gate (a NotFound or ServiceUnavailable during set computation is still "could not determine access" → 500). Do not flag the gate helpers for bypassing `handleErrorResponse()`; do flag other handlers that hand-roll status codes the gate helpers already cover.

Flag: handlers that manually set error HTTP status codes instead of using `handleErrorResponse()`.

## TypeScript Conventions

### No Default Exports

Default exports are forbidden (enforced by `.eslintrc`). All exports must be named.

```typescript
// Correct
export const MyComponent: React.FC = () => { ... };

// Wrong
export default function MyComponent() { ... }
```

Flag: any `export default` in TypeScript/TSX files.

### i18n via `utils/I18nUtils`

All user-facing strings must use the `t()` function imported from `utils/I18nUtils`, never directly from `i18next`.

```typescript
// Correct
import { t } from 'utils/I18nUtils';
const label = t('Traffic Graph');

// Wrong
import { t } from 'i18next';
import i18n from 'i18next';
```

Flag: any import of `t` or `i18next` directly from the `i18next` package.

### Event Handler Naming

- Handler methods on a component: `handle<EventName>` (e.g. `handleClick`, `handleChange`, `handleSubmit`)
- Callback props passed to a component: `on<EventName>` (e.g. `onSelect`, `onChange`, `onClose`)

```typescript
// Correct
type Props = {
  onChange: (val: string) => void;
};

const MyComponent: React.FC<Props> = ({ onChange }) => {
  const handleChange = (val: string) => {
    onChange(val);
  };
};
```

Flag: handler methods not prefixed with `handle`, or callback props not prefixed with `on`. Reference: `STYLE_GUIDE.adoc`.

### Redux Props Sorting

Redux prop types must be sorted alphabetically, consistent with Go struct field ordering.

```typescript
// Correct
type ReduxProps = {
  activeClusters: MeshCluster[];
  duration: DurationInSeconds;
  refreshInterval: IntervalInMilliseconds;
};

// Wrong
type ReduxProps = {
  refreshInterval: IntervalInMilliseconds;
  activeClusters: MeshCluster[];
  duration: DurationInSeconds;
};
```

Flag: `ReduxProps` type definitions with fields in non-alphabetical order.

## Changelog

| Date | Change | Trigger |
|------|--------|---------|
| 2026-10-29 | Document the canonical namespace gate's 403/500 contract as an accepted exception to the handleErrorResponse rule; add k8s Forbidden→403 and Unauthorized-stays-500 to the mapping list | PR #10448 review (cross-unit finding #1) |
| 2026-10-29 | Document `models.IstioValidationKey` field order as accepted exception to struct ordering rule | PR #10448 review (IMP-7) |
| 2026-04-24 | Refresh: verify existing conventions current, no changes needed | /code-reviewer:setup (refresh) |
| 2026-04-08 | Initial generation | /code-reviewer:setup |
