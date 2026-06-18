---
format_version: 1
---

# Testing Practices — Kiali

## Go Testing

### Framework: testify

All Go tests use the `testify` library. Use `require` for assertions where failure should stop the test immediately (setup steps, preconditions), and `assert` for non-fatal checks where the test can continue.

```go
// Correct: require for setup, assert for checks
client, err := newClient(cfg)
require.NoError(t, err)           // Fatal — no point continuing without a client
assert.Equal(t, expected, result) // Non-fatal — report and continue

// Wrong: assert for setup (test continues with broken state)
client, err := newClient(cfg)
assert.NoError(t, err)
```

Flag: `assert.NoError()` or `assert.NotNil()` used on values that subsequent test code depends on — these should be `require`.

### Table-Driven Tests

When a test has 3 or more similar cases, use the table-driven pattern with `map[string]struct{}`:

```go
tests := map[string]struct {
    input    string
    expected string
    wantErr  bool
}{
    "valid input":   {input: "foo", expected: "bar"},
    "empty input":   {input: "", wantErr: true},
    "special chars": {input: "foo/bar", expected: "foo-bar"},
}

for name, tc := range tests {
    t.Run(name, func(t *testing.T) {
        result, err := myFunc(tc.input)
        if tc.wantErr {
            require.Error(t, err)
            return
        }
        require.NoError(t, err)
        assert.Equal(t, tc.expected, result)
    })
}
```

Flag: 3 or more nearly identical test functions that could be collapsed into a table. Do not flag when cases have meaningfully different setup or assertions that don't fit a table.

### Fake Kubernetes Clients

Unit tests must not make real Kubernetes API calls. Use the fake client helpers from `kubernetes/kubetest`:

```go
// Correct
k8s := kubetest.FakeK8sClient(objects...)
ns := kubetest.FakeNamespace("my-namespace")

// Wrong — hits real cluster
k8s, err := kubernetes.NewClientFromConfig(cfg)
```

Flag: unit tests that create real Kubernetes clients, or that require a running cluster to pass.

### Setup Helpers

When multiple test functions in a file share the same initialization logic, extract it into a named setup helper rather than duplicating the code.

```go
// Correct — shared helper
func setupDashboardService(t *testing.T) *DashboardsService {
    t.Helper()
    conf := config.NewConfig()
    return NewDashboardsService(conf, fakeProm, fakeGrafana)
}

func TestGetDashboard(t *testing.T) {
    svc := setupDashboardService(t)
    // ...
}

// Wrong — duplicated setup
func TestGetDashboard(t *testing.T) {
    conf := config.NewConfig()
    svc := NewDashboardsService(conf, fakeProm, fakeGrafana)
    // ...
}
func TestListDashboards(t *testing.T) {
    conf := config.NewConfig()
    svc := NewDashboardsService(conf, fakeProm, fakeGrafana)
    // ...
}
```

Flag: the same multi-step initialization block copy-pasted across 3 or more test functions in the same file.

## TypeScript Testing

### Framework and Structure

TypeScript unit tests use Jest with `describe`/`it` blocks. Test files live in `__tests__/` subdirectories alongside the source they test.

```
frontend/src/actions/
├── ClusterAction.ts
└── __tests__/
    └── ClusterAction.test.ts
```

```typescript
describe('ClusterActions', () => {
  it('should set active clusters', () => {
    const clusters: MeshCluster[] = [{ name: 'test', ... }];
    const action = ClusterActions.setActiveClusters(clusters);
    expect(action.payload).toEqual(clusters);
  });
});
```

Flag: test files not in an `__tests__/` subdirectory, or tests using patterns other than `describe`/`it`.

## Cypress E2E Tests

Cypress tests live in `frontend/cypress/`. Full guidance: `AGENTS.md` § Writing New E2E Tests.

### Scope

Cypress is for E2E/integration tests only. Unit tests belong in Jest.

Flag: Cypress tests covering pure functions, Redux actions, or utilities with no UI interaction.

### Structure

```
frontend/cypress/
├── integration/
│   ├── featureFiles/     # Gherkin .feature files
│   └── common/           # Step definitions (global across all features)
├── support/commands.ts   # Custom cy.commands()
└── fixtures/             # Test data
```

### Tagging

Scenarios require:
- **Suite tag**: `@smoke`, `@core-1`, `@core-2`, `@ambient`, `@multi-cluster`, `@multi-primary`, `@tracing`, `@offline`
- **App tag** (if needed): `@bookinfo-app`, `@error-rates-app`, `@sleep-app`

Flag:
- Missing suite tag
- `@selected` tag committed (debugging only — must remove before merge)
- Wrong app/suite combo (e.g., `@core-1` with `@error-rates-app`)

### Step Definitions

Step definitions in `integration/common/*.ts` are global. Reuse existing steps before writing new ones.

Key files: `navigation.ts`, `table.ts`, `transition.ts`, `services.ts`, `apps.ts`, `workloads.ts`

Flag:
- Duplicate step definitions
- Missing `data-test` attributes on selectors
- Brittle CSS paths or element indices

### Gherkin Linting

Feature files must pass `yarn lint:gherkin` (runs `gherkin-lint` with `.gherkin-lintrc` config).

Enforced rules:
- `no-files-without-scenarios`
- `no-unnamed-features`, `no-unnamed-scenarios`
- `no-scenario-outlines-without-examples`
- `no-empty-background`, `no-empty-file`

Run before committing: `cd frontend && yarn lint:gherkin`

## Changelog

| Date | Change | Trigger |
|------|--------|---------|
| 2026-04-24 | Restructure Cypress E2E section; add gherkin-lint reference; align with AGENTS.md | Manual |
| 2026-04-24 | Add Gherkin BDD feature file and step definition patterns | /code-reviewer:setup (refresh) |
| 2026-04-08 | Initial generation | /code-reviewer:setup |
