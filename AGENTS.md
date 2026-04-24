# AI Agent Development Guide for Kiali

This guide provides coding standards, development workflows, and common commands for AI agents and developers contributing to the Kiali project. It complements the existing [CONTRIBUTING.md](./CONTRIBUTING.md), [STYLE_GUIDE.adoc](./STYLE_GUIDE.adoc), and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Table of Contents

- [Quick Reference](#quick-reference)
- [Code Quality Standards](#code-quality-standards)
- [Building and Testing](#building-and-testing)
- [Development Workflows](#development-workflows)
  - [Local Development with Hot Reload](#local-development-with-hot-reload)
- [Cluster-Specific Development Workflows](#cluster-specific-development-workflows)
  - [Working with Minikube](#working-with-minikube)
  - [Working with KinD](#working-with-kind-kubernetes-in-docker)
  - [Working with OpenShift (CRC)](#working-with-openshift-crc)
- [Operator Development](#operator-development)
- [File Protection Rules](#file-protection-rules)
- [Common Patterns and Best Practices](#common-patterns-and-best-practices)
- [Troubleshooting](#troubleshooting)
- [Quick Command Reference](#quick-command-reference)

---

## Quick Reference

### Essential Commands

```bash
# Build everything
make build-ui build test

# Run Kiali locally with hot-reload
make build-ui
make run-backend    # In one terminal
make run-frontend   # In another terminal

# Build and push dev images to cluster (example for minikube with profile "ci")
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=ci build-ui build test cluster-push

# Deploy to cluster (ensure CLUSTER_TYPE is set - see cluster-specific sections below)
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube cluster-push         # Example for minikube
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube operator-create      # Example for minikube
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube kiali-create        # Example for minikube

# Format and lint
make format lint

# Run tests
make test                       # Unit tests
make cypress-gui               # Frontend integration tests (GUI)
make cypress-run               # Frontend integration tests (headless)
```

### Repository Structure

The Kiali project consists of multiple repositories that should be cloned together:

```
kiali_sources/
├── kiali/              # Main server and UI repo
├── kiali-operator/     # Operator repo (link as kiali/operator)
└── helm-charts/        # Helm charts repo
```

Setup commands:
```bash
mkdir kiali_sources && cd kiali_sources
git clone https://github.com/kiali/kiali.git
git clone https://github.com/kiali/kiali-operator.git
git clone https://github.com/kiali/helm-charts.git
ln -s $PWD/kiali-operator kiali/operator
```

---

## Code Quality Standards

### Go Backend Standards

#### General Rules

1. **Use `any` instead of `interface{}`** - Always prefer `any` for empty interfaces
2. **No end-of-line spaces** - Remove all trailing whitespace from any line you add or modify
3. **Sort struct fields alphabetically** - When adding or modifying Go structs, sort field names alphabetically
4. **Sort YAML keys alphabetically** - When adding or modifying YAML schemas or files, sort keys alphabetically
5. **Meaningful comments** - Write comments that explain "why", not "what". Focus on the purpose and usage of abstractions.

#### Import Formatting

Organize imports in three groups separated by blank lines:

```go
import (
    // Standard library imports
    "errors"
    "fmt"
    "time"

    // Third-party imports
    "k8s.io/client-go/tools/clientcmd/api"

    // Kiali imports
    "github.com/kiali/kiali/log"
)
```

#### Code Formatting

- Use `gofmt` for formatting (automatically applied by `make format`)
- Use `golangci-lint` for linting (run via `make lint`)
- Install linting tools: `make lint-install`
- The project requires a specific Go version defined in `go.mod` - check with `make go-check`

### TypeScript Frontend Standards

#### Naming Conventions

**Files:**
- Most files: `PascalCase` (e.g., `ServiceList.ts`)
- General purpose files: `camelCase` (e.g., `routes.ts`)

**Variables and Functions:**
- Generally: `camelCase`
- Redux actions: `PascalCase` (e.g., `GraphActions`)
- Global constants: `UPPER_SNAKE_CASE` (e.g., `TIMER_REQUEST_PER_SECOND_MIN`)
- Local constants: `camelCase`

**Enums:**
```typescript
enum DisplayMode {
  LARGE,    // Values in UPPER_SNAKE_CASE
  SMALL
}
```

#### Event Handlers

Use consistent naming:
- Handler methods: `handle` + event name (e.g., `handleClick`, `handleChange`)
- Props: `on` + event name (e.g., `onSelect`, `onChange`)
- Use present tense
- Avoid clashing with native events

Example:
```typescript
<Item
  onClick={() => handleClick(item.name)}
  onSelect={() => handleSelect(item.id)}
/>
```

#### Arrow Functions

Prefer arrow functions:
```typescript
createItem = () => {
  return (
    <ul>
      {props.items.map((item, index) => (
        <Item key={item.key} onClick={() => doSomethingWith(item.name, index)} />
      ))}
    </ul>
  );
}
```

#### Redux Patterns

**Type-safe Redux:**
- Use `typesafe-actions` library
- Separate `ReduxProps` from component props

```typescript
type ReduxProps = {
  // Redux props only, alphabetically sorted
};

type MyComponentProps = ReduxProps & {
  // Component-specific props, alphabetically sorted
};

class MyComponent extends React.Component<MyComponentProps> {
  // ...
}
```

**URL Consistency:**
- Store page state in Redux
- Make pages bookmarkable via URL parameters
- On construction: URL params override Redux state
- After construction: Update URL to reflect Redux state changes

#### Internationalization (i18n)

Always use the `t` function for translatable strings:

```typescript
import { t } from 'utils/I18nUtils';  // NOT from 'i18next'!

title = t('Traffic Graph');
```

For components that don't re-render on language change, add language to Redux props.

#### Components

- **Functional components**: New components must use functional components with hooks. Do not introduce class components (`React.Component`); they are legacy. Existing class components can be refactored to functional components when making significant changes to them.
- **`data-test` attributes**: Add `data-test` attributes to interactive or identifiable elements for Cypress testability (e.g., `<Button data-test="confirm-delete">`). Tests use `cy.getBySel('name')` to select these.

#### Styling

- **`kialiStyle`** (`styles/StyleUtils.ts`) is the standard way to define component styles. Use it to generate class names applied via `className`. SCSS Modules are only for global CSS variable definitions or large third-party CSS.
- **`className` over `style`**: Always prefer `className` (via `kialiStyle`) over the React inline `style` prop.
- **PatternFly design token enums**: Use `PFSpacer` (`styles/PfSpacer.ts`) for spacing, `PFFontSize`/`PFFontWeight` (`styles/PfTypography.ts`) for typography, and `PFColors` (`components/Pf/PfColors.tsx`) for colors. Prefer these over raw `var(--pf-...)` strings or hardcoded values.
- **`rem` over `px`**: When no PF token fits, use `rem` for margin, padding, gap, and font sizes. Use `px` only for large fixed layout dimensions (e.g., `height: 300px`).

---

## Building and Testing

### Building

```bash
# Build UI (must be done before building backend)
make build-ui

# Build backend
make build

# Build for specific architecture
make build-linux-multi-arch

# Clean builds
make clean        # Clean backend build artifacts
make clean-ui     # Clean UI build artifacts
make clean-all    # Clean everything including _output dir
```

### Testing

#### Backend Tests

```bash
# Run all backend tests
make test

# Run specific tests with flags
make -e GO_TEST_FLAGS="-race -v -run=\"TestName\"" test

# Run integration tests
make test-integration

# Run controller integration tests
make test-integration-controller
```

#### Frontend Tests

```bash
# Build UI and run tests
make build-ui-test

# Run Cypress tests in GUI mode
make cypress-gui

# Run Cypress tests headlessly
make cypress-run

# Run performance tests
make perf-tests-gui
make perf-tests-run
```

**Cypress Environment Variables:**

These variables can be set when running tests outside of the local cluster or to customize test behavior:

```bash
export CYPRESS_BASE_URL=<value>                      # defaults to http://localhost:3000
export CYPRESS_USERNAME=<value>                      # defaults to jenkins, opt. kubeadmin
export CYPRESS_PASSWD=<value>                        # no defaults
export CYPRESS_AUTH_PROVIDER=<value>                 # defaults to my_htpasswd_provider
export CYPRESS_ALLOW_INSECURE_KIALI_API=<true|false> # Useful when running tests locally against an insecure endpoint like crc
export CYPRESS_STERN=<true|false>                    # defaults to false
```

**Test Requirements:**
- Istio installed
- Kiali deployed
- Bookinfo demo app deployed
- Error rates demo app deployed

Install demo apps:
```bash
./hack/istio/install-testing-demos.sh -c kubectl
```

### Running Tests Against Local Environment

```bash
# Start Kiali backend (in terminal 1)
make run-backend

# Start frontend dev server (in terminal 2)
make -e KIALI_PROXY_URL=http://localhost:20001/kiali yarn-start

# Run Cypress tests (in terminal 3)
make cypress-gui
```

### Integration Tests via `hack/run-integration-tests.sh`

The `hack/run-integration-tests.sh` script is the main entrypoint for setting up clusters and running end-to-end integration tests. It can create a KinD cluster, install Istio, deploy demo apps, deploy Kiali, and run the test suite — all in one command.

#### Prerequisites

- `kind` and `docker` installed
- `make build` (kiali binary required for `local` and `offline` suites)
- `make build-ui` (Cypress must be installed for all frontend suites)

#### Basic Usage

```bash
# Full run: setup cluster + run tests
hack/run-integration-tests.sh --test-suite <suite>

# Setup only (create cluster, install Istio, deploy apps, skip tests)
hack/run-integration-tests.sh --test-suite <suite> --setup-only true

# Tests only (skip setup, run against existing cluster)
hack/run-integration-tests.sh --test-suite <suite> --tests-only true
```

#### Available Test Suites (`--test-suite`)

| Suite | Description |
|-------|-------------|
| `backend` | Go backend integration tests (default) |
| `backend-external-controlplane` | Backend tests with external control plane |
| `frontend` | All frontend Cypress tests |
| `frontend-core-1` | Frontend core test group 1 |
| `frontend-core-2` | Frontend core test group 2 |
| `frontend-core-optional` | CRD validation and Perses tests |
| `frontend-ambient` | Frontend tests with Istio ambient mode |
| `frontend-primary-remote` | Frontend multicluster primary-remote tests |
| `frontend-multi-primary` | Frontend multicluster multi-primary tests |
| `frontend-multi-mesh` | Frontend multi-mesh tests |
| `frontend-external-kiali` | Frontend tests with external Kiali |
| `frontend-tempo` | Frontend tracing tests with Tempo |
| `local` | Runs Kiali locally (not in-cluster) with smoke Cypress tests |
| `offline` | Runs Kiali in offline mode with must-gather data |

#### The `local` Suite (Recommended for Local Development)

The `local` suite is useful for testing local code changes without building container images. It:

1. Creates a KinD cluster with Istio (via Sail) but **does not deploy Kiali in-cluster**
2. Installs demo applications (bookinfo, error rates, etc.)
3. Runs the Kiali binary directly from `$GOPATH/bin/kiali`
4. Executes the `cypress:run:smoke` test suite against the locally-running Kiali

```bash
# Step 1: Build the kiali binary and frontend
make build-ui build

# Step 2: Setup cluster only (takes ~5 minutes)
hack/run-integration-tests.sh --test-suite local --setup-only true

# Step 3: Run tests against existing cluster (repeatable after code changes)
make build  # Rebuild after code changes
hack/run-integration-tests.sh --test-suite local --tests-only true
```

#### Running Individual Cypress Tests

After setting up a cluster with `--setup-only true`, you can start Kiali locally and run specific tests interactively. This is the recommended workflow for writing and debugging individual e2e tests.

**Step 1: Start Kiali locally**

```bash
# Start Kiali binary locally (uses anonymous auth, port-forwards to in-cluster services)
$(go env GOPATH)/bin/kiali \
  -c hack/ci-yaml/ci-test-config-no-cache.yaml run \
  --cluster-name-overrides kind-ci=cluster-default \
  --port-forward-tracing --enable-tracing \
  --port-forward-prom --port-forward-grafana --no-browser
```

Kiali will be available at `http://localhost:20001`.

**Step 2: Run specific tests**

Tests use Gherkin `.feature` files with `@tags` for grouping. Tests are in `frontend/cypress/integration/featureFiles/` with step definitions in `frontend/cypress/integration/common/`.

```bash
cd frontend

# Run a specific test tag
yarn cypress run -e TAGS="@smoke"
yarn cypress run -e TAGS="@core-1"
yarn cypress run -e TAGS="@core-2"

# Run a specific feature file
npx cypress run --spec "cypress/integration/featureFiles/services.feature"

# Run a specific feature file with a specific tag
npx cypress run --spec "cypress/integration/featureFiles/services.feature" -e TAGS="@smoke"

# Open Cypress GUI to pick tests interactively
yarn cypress open -e TAGS="@core-1"

# Use make targets
make cypress-gui        # Opens GUI with core tests
make cypress-run        # Headless core tests
make cypress-selected   # Runs @selected tagged tests (tag a scenario with @selected for debugging)
```

**Available test tags:**

| Tag | Description | Suite |
|-----|-------------|-------|
| `@smoke` | Quick smoke tests (~30 scenarios) | `local` |
| `@core-1` | Core UI tests group 1 (~130 scenarios) | `frontend-core-1` |
| `@core-2` | Core UI tests group 2 (~155 scenarios) | `frontend-core-2` |
| `@crd-validation` | CRD validation tests | `frontend-core-optional` |
| `@perses` | Perses dashboard tests | `frontend-core-optional` |
| `@multi-cluster` | Primary-remote multicluster tests | `frontend-primary-remote` |
| `@multi-primary` | Multi-primary multicluster tests | `frontend-multi-primary` |
| `@multi-mesh` | Multi-mesh tests | `frontend-multi-mesh` |
| `@ambient` | Ambient mesh tests | `frontend-ambient` |
| `@tracing` | Distributed tracing (Tempo) tests | `frontend-tempo` |
| `@offline` | Offline mode tests | `offline` |
| `@selected` | Manual selection for debugging | N/A |

**Tip:** To debug a single scenario, add the `@selected` tag to it in the `.feature` file, then run `make cypress-selected`.

#### Debugging Cypress Tests with Playwright MCP

AI agents can connect to the actual Cypress-controlled Chrome browser via the Chrome DevTools Protocol (CDP) to inspect the test runner and the application under test.

**Setup: `.mcp.json`**

The project includes a `.mcp.json` at the repo root with a `cypress-debugger` MCP server that connects to the Cypress Chrome browser on port 9222:

```json
{
  "mcpServers": {
    "cypress-debugger": {
      "type": "stdio",
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--cdp-endpoint", "http://127.0.0.1:9222"]
    }
  }
}
```

This is already checked into the repository — no manual setup is needed. The `cypress-debugger` MCP tools (e.g., `mcp__cypress-debugger__browser_snapshot`, `mcp__cypress-debugger__browser_click`) become available automatically when Claude Code loads the project.

**Prerequisites:**

Before using the debug browser, ensure:
1. **Chrome is installed** — `--browser chrome` requires a Chrome/Chromium binary on the system
2. **A cluster with Istio and demo apps is running** — check with `kind get clusters` (look for `ci`)
3. **Kiali is running locally** — check with `curl -s http://localhost:20001/kiali/api`

If the cluster doesn't exist yet, set it up:
```bash
make build-ui build
hack/run-integration-tests.sh --test-suite local --setup-only true
```

If Kiali isn't running, start it:
```bash
$(go env GOPATH)/bin/kiali \
  -c hack/ci-yaml/ci-test-config-no-cache.yaml run \
  --cluster-name-overrides kind-ci=cluster-default \
  --port-forward-tracing --enable-tracing \
  --port-forward-prom --port-forward-grafana --no-browser
```

**Step 1: Run Cypress with Chrome on a fixed CDP port**

```bash
cd frontend

# Run a specific test with Chrome, keep the browser open after completion
CYPRESS_BASE_URL=http://localhost:20001 \
CYPRESS_REMOTE_DEBUGGING_PORT=9222 \
npx cypress run \
  --browser chrome \
  --headed \
  --no-exit \
  -e TAGS="@smoke" \
  --spec "cypress/integration/featureFiles/kiali_about.feature"
```

Key flags:
- `CYPRESS_REMOTE_DEBUGGING_PORT=9222` — exposes the Chrome browser on a fixed CDP port so the `cypress-debugger` MCP can connect
- `--browser chrome` — uses Chrome instead of Electron (required for CDP)
- `--headed` — shows the browser window
- `--no-exit` — keeps the browser open after tests finish so you can inspect the state

**Step 2: Use the `cypress-debugger` MCP to inspect the browser**

Once Cypress is running with the Chrome browser on port 9222, the `cypress-debugger` MCP tools (`mcp__cypress-debugger__browser_snapshot`, `mcp__cypress-debugger__browser_click`, etc.) connect directly to the Cypress Chrome instance. This lets AI agents:

- **Inspect the Cypress test runner** — see test results, passed/failed steps, and error messages
- **Inspect the app under test** — the Kiali UI is rendered inside the Cypress runner; snapshots show the actual DOM state
- **Debug failing assertions** — read the Cypress step definition (in `frontend/cypress/integration/common/*.ts`), understand what DOM selector it uses (e.g., `td[data-label="Details"]`, `data-test="namespace-dropdown"`), and use `browser_evaluate` to run the same query against the live page
- **Re-run tests** — press `Ctrl+R` via `browser_press_key` to re-run the current spec (see below)
- **Verify the CDP endpoint** is reachable: `curl -s http://127.0.0.1:9222/json/list`

**Re-running tests from MCP:**

To re-run a Cypress spec via the MCP tools, press `Ctrl+R`:

```
browser_press_key({ key: "Control+r" })
```

This reloads the Cypress runner page which triggers a full re-run of the current spec. To verify a re-run occurred, take a `browser_snapshot` and check that iframe element ref prefixes changed (e.g., `f1e*` → `f3e*`) and timestamps in the Kiali UI updated to the current time.

> **Note:** Pressing just `r` via `browser_press_key` does not work because focus isn't on the Cypress runner. Clicking the spec file link and using `browser_navigate` to the same URL also do not trigger re-runs. Use `Ctrl+R` or `browser_evaluate` with `window.location.reload()`.

> **Important: `Ctrl+R` does NOT pick up code changes.** Cypress caches compiled step definitions and feature files. If you modify a `.ts` step definition or `.feature` file, you **must kill the Cypress process and restart it** for the changes to take effect. `Ctrl+R` only re-runs the previously compiled spec. To restart cleanly:
> 1. Kill all Cypress and associated Chrome processes: `pkill -9 -f cypress; pkill -9 -f "chrome.*9222"`
> 2. Wait 2-3 seconds for ports to be released
> 3. Verify port 9222 is free: `curl -s http://127.0.0.1:9222/json/list` should fail
> 4. Re-launch Cypress with the same command
> 5. After the new browser opens, use `browser_close` then `browser_navigate` to reconnect the MCP to the new browser instance (the MCP caches its connection to the old browser)

**Snapshot depth tips:**

The `browser_snapshot` tool accepts an optional `depth` parameter to control output size:
- `depth: 3-4` — quick overview of page structure and test runner controls
- `depth: 5-6` — detailed view including the Kiali app inside the iframe
- No depth limit (default) — full DOM tree; can be very large (50KB+), useful for detailed inspection

**Understanding the snapshot structure:**

The Cypress runner page has two main areas:
- **Test runner panel** (left side) — element refs like `e13`, `e17`, etc. Contains the spec name, pass/fail stats, test steps, and timing
- **App under test iframe** (right side) — element refs like `f1e3`, `f1e7`, etc. (prefixed with `f<N>e`). Contains the actual Kiali UI being tested. Use these refs to interact with the Kiali app directly

**Reading test runner state via `browser_evaluate`:**

Snapshots can be noisy. Use `browser_evaluate` for quick, targeted checks:

```javascript
// Check pass/fail/pending counts
() => { const stats = document.querySelectorAll('[aria-label="Stats"] li'); return Array.from(stats).map(s => s.textContent?.trim()); }
// → ["Passed:1", "Failed:--", "Pending:--"]

// Check last N Cypress command log entries (most useful for debugging)
() => { const items = document.querySelectorAll('.command-wrapper'); return Array.from(items).slice(-10).map(el => el.textContent?.trim()).join('\n'); }

// Check for error messages
() => { const el = document.querySelector('.runnable-err-message'); return el ? el.textContent : 'no error'; }

// Inspect the Kiali app DOM inside the iframe
() => { const iframe = document.querySelector('iframe'); if (!iframe?.contentDocument) return 'no iframe'; return iframe.contentDocument.querySelector('#target-panel-control-plane')?.textContent?.substring(0, 200); }
```

**Understanding Cypress test structure:**

- Feature files: `frontend/cypress/integration/featureFiles/*.feature` (Gherkin BDD with `@tags`)
- Step definitions: `frontend/cypress/integration/common/*.ts` (TypeScript implementing each Given/When/Then)
- Key selectors used in tests:
  - `cy.getBySel('namespace-dropdown')` → `[data-test="namespace-dropdown"]`
  - `cy.get('th[data-label="Name"]')` → table column headers
  - `cy.get('td[data-label="Details"]')` → table column cells
  - `getColWithRowText(rowText, colName)` → finds a cell by row content and column name
  - `a[href$="..."]` → link assertions using endsWith

#### Debugging CI Test Failures Locally

Use the `gh` CLI to identify failures from CI, then reproduce locally.

**Step 1: Find the failed CI job**

```bash
# List recent failed Kiali CI runs
gh run list --repo kiali/kiali --status failure --limit 10 \
  --json databaseId,name,headBranch,createdAt \
  --jq '.[] | select(.name == "Kiali CI") | {id: .databaseId, branch: .headBranch, date: .createdAt}'

# Or given a specific run URL (https://github.com/kiali/kiali/actions/runs/<RUN_ID>):
gh run view <RUN_ID> --repo kiali/kiali --json jobs \
  --jq '.jobs[] | select(.conclusion == "failure") | {name: .name, id: .databaseId}'
```

**Step 2: Extract failure details from logs**

```bash
# Get the failing test names and error messages
gh run view <RUN_ID> --repo kiali/kiali --log --job <JOB_ID> 2>&1 \
  | grep -E "(failing|AssertionError|CypressError|Error:)" | head -20

# Get context around failures (test name + error)
gh run view <RUN_ID> --repo kiali/kiali --log --job <JOB_ID> 2>&1 \
  | grep -B5 "AssertionError" | head -40
```

**Step 3: Download failure screenshots**

Cypress takes screenshots on failure and uploads them as artifacts.

```bash
# Download all cypress screenshots from the run
gh run download <RUN_ID> --repo kiali/kiali --dir /tmp/ci-artifacts --pattern "*cypress*"

# View the screenshots to understand the failure visually
# Screenshots are at: /tmp/ci-artifacts/cypress-screenshots-*/
```

The screenshots show the Cypress test runner (left) with the failing step highlighted, and the Kiali UI (right) showing the actual state at the time of failure.

**Step 4: Identify the test suite and feature file**

Map the failed job name to a test suite:

| CI Job Name Pattern | Test Suite | Feature Files |
|---------------------|------------|---------------|
| `Run frontend core 1 integration tests` | `frontend-core-1` | `@core-1` tagged scenarios |
| `Run frontend core 2 integration tests` | `frontend-core-2` | `@core-2` tagged scenarios |
| `Run Ambient frontend integration tests` | `frontend-ambient` | `@ambient`, `@waypoint` scenarios |
| `Run frontend multicluster multi-primary` | `frontend-multi-primary` | `@multi-primary` scenarios |
| `Run frontend multicluster primary-remote` | `frontend-primary-remote` | `@multi-cluster` scenarios |
| `Run frontend local and offline mode` | `local` / `offline` | `@smoke` / `@offline` scenarios |
| `Run backend integration tests` | `backend` | Go tests in `tests/integration/` |

**Step 5: Reproduce locally**

```bash
# Checkout the failing branch
git checkout <branch-name>

# Build
make build-ui build

# Setup cluster for the correct suite (if not already running)
hack/run-integration-tests.sh --test-suite <suite> --setup-only true

# Start Kiali (if not already running)
$(go env GOPATH)/bin/kiali \
  -c hack/ci-yaml/ci-test-config-no-cache.yaml run \
  --cluster-name-overrides kind-ci=cluster-default \
  --port-forward-tracing --enable-tracing \
  --port-forward-prom --port-forward-grafana --no-browser &

# Run just the failing test with debug browser
cd frontend
CYPRESS_BASE_URL=http://localhost:20001 \
CYPRESS_REMOTE_DEBUGGING_PORT=9222 \
npx cypress run --browser chrome --headed --no-exit \
  --spec "cypress/integration/featureFiles/<failing-feature>.feature"
```

**Step 6: Debug with Playwright MCP**

With the Cypress browser on port 9222 and `--no-exit` keeping it open, use `cypress-debugger` MCP tools to inspect the Cypress Chrome browser, examine the DOM state, and understand why the assertion failed. Use `Ctrl+R` to re-run the test after making fixes. See [Debugging Cypress Tests with Playwright MCP](#debugging-cypress-tests-with-playwright-mcp) for full details.

#### Writing New E2E Tests

AI agents can write new Cypress e2e tests, run them against a local cluster, and iterate until they pass.

**Test file structure:**

Tests use Gherkin BDD (`.feature` files) paired with TypeScript step definitions:

```
frontend/cypress/integration/
├── featureFiles/           # Gherkin .feature files (scenarios with @tags)
│   ├── services.feature
│   ├── app_details.feature
│   └── ...
└── common/                 # TypeScript step definitions (shared across features)
    ├── table.ts            # Reusable table assertions (getColWithRowText, colExists, etc.)
    ├── navigation.ts       # Page navigation steps ("user is at the X page")
    ├── transition.ts       # Loading state helpers (ensureKialiFinishedLoading)
    ├── services.ts         # Service-specific steps
    ├── hooks.ts            # Before/After hooks for demo app setup
    └── ...
```

Step definitions are **global** — any `.ts` file in `cypress/integration/` is loaded for all feature files (configured via `"stepDefinitions": "cypress/integration/**/*.{js,ts}"` in `package.json`). This means steps defined in `table.ts` or `navigation.ts` are available to every feature file.

**Writing a new test — step by step:**

1. **Choose the right feature file** — add scenarios to an existing `.feature` file if the feature area matches. Only create a new file for an entirely new feature area.

2. **Tag the scenario** — use the appropriate tag(s) for the test suite it belongs to:
   ```gherkin
   @bookinfo-app
   @core-2
   Scenario: My new test scenario
     Given user is at administrator perspective
     And user is at the "services" page
     When user selects the "bookinfo" namespace
     Then user sees "productpage" in the table
   ```
   - `@bookinfo-app`, `@error-rates-app`, `@sleep-app` — hooks use these to ensure demo apps are installed
   - `@core-1`, `@core-2`, `@smoke` — which CI suite runs this test
   - Use `@selected` temporarily during development to run only your test

3. **Reuse existing step definitions** — check what's already available before writing new steps:
   - `navigation.ts`: `user is at the {string} page`, `user is at administrator perspective`
   - `table.ts`: `user selects the {string} namespace`, `user sees {string} in the table`, `table length should be {int}`, `the {string} column on the {string} row has a link ending in {string}`
   - `transition.ts`: `ensureKialiFinishedLoading()` — wait for loading spinners to disappear
   - `services.ts`, `apps.ts`, `workloads.ts` — domain-specific steps

4. **Write new step definitions** if needed — add them to the appropriate file in `cypress/integration/common/`:
   ```typescript
   import { Then, When } from '@badeball/cypress-cucumber-preprocessor';
   import { ensureKialiFinishedLoading } from './transition';

   Then('the service details page shows {string}', (expectedText: string) => {
     cy.get('[data-test="service-details"]').should('contain.text', expectedText);
   });
   ```

5. **Key patterns for step definitions:**
   - `cy.getBySel('name')` → selects `[data-test="name"]` (custom Kiali command)
   - `cy.get('td[data-label="Name"]')` → table cells by column header
   - `getColWithRowText(rowText, colName)` → find a cell by row content and column name (from `table.ts`)
   - `ensureKialiFinishedLoading()` → wait for Kiali to finish loading (from `transition.ts`)
   - `openTab(tabName)` → click a tab in the details page (from `transition.ts`)
   - Use `data-test` attributes on React components for reliable selectors

**Running your new test:**

Ensure the cluster and Kiali are running (see [Prerequisites](#debugging-cypress-tests-with-playwright-mcp) in the MCP debugging section above).

```bash
# 1. Setup cluster (if not already running — check with `kind get clusters`)
hack/run-integration-tests.sh --test-suite local --setup-only true

# 2. Start Kiali (if not already running — check with `curl -s http://localhost:20001/kiali/api`)
$(go env GOPATH)/bin/kiali \
  -c hack/ci-yaml/ci-test-config-no-cache.yaml run \
  --cluster-name-overrides kind-ci=cluster-default \
  --port-forward-tracing --enable-tracing \
  --port-forward-prom --port-forward-grafana --no-browser &

# 3. Run just your test with debug browser (use @selected tag for fast iteration)
cd frontend
CYPRESS_BASE_URL=http://localhost:20001 \
CYPRESS_REMOTE_DEBUGGING_PORT=9222 \
npx cypress run --browser chrome --headed --no-exit \
  -e TAGS="@selected" \
  --spec "cypress/integration/featureFiles/<your-feature>.feature"

# Or run headless for quick pass/fail (no debug browser)
CYPRESS_BASE_URL=http://localhost:20001 \
npx cypress run -e TAGS="@selected"
```

With `CYPRESS_REMOTE_DEBUGGING_PORT=9222` and `--no-exit`, the `cypress-debugger` MCP tools can connect to inspect the browser, debug failures, and re-run the test with `Ctrl+R`. See the [Debugging Cypress Tests with Playwright MCP](#debugging-cypress-tests-with-playwright-mcp) section for details.

**Iteration loop:**

1. Write or modify the test
2. Run it with the debug browser flags above — if it fails, examine the error message
3. Use `cypress-debugger` MCP tools to inspect the browser state if the error isn't clear
4. Determine if the failure is a **test issue** (wrong selector, wrong assertion) or a **code issue** (feature not working)
5. Fix the test or the code accordingly
6. Re-run with `Ctrl+R` via `browser_press_key` if the debug browser is still open, or re-launch the cypress command
7. Remove the `@selected` tag and verify the test passes with its real suite tag

**Before committing:**

- Remove the `@selected` tag
- Ensure the test has the correct suite tag (`@core-1`, `@core-2`, etc.)
- Ensure the test has the correct demo app tag (`@bookinfo-app`, `@error-rates-app`, etc.) if it depends on demo apps
- Run `make format lint` on any changed Go code
- Verify the test passes headless: `npx cypress run -e TAGS="@your-suite-tag" --spec "your-feature.feature"`

#### Common Options

```bash
# Specify Istio version
hack/run-integration-tests.sh --test-suite frontend --istio-version 1.29.1

# Use minikube instead of kind
hack/run-integration-tests.sh --test-suite backend --cluster-type minikube

# Record video for Cypress tests
hack/run-integration-tests.sh --test-suite frontend --with-video true

# Enable ambient mode for multi-primary
hack/run-integration-tests.sh --test-suite frontend-multi-primary --ambient true

# Full help
hack/run-integration-tests.sh --help
```

---

## Development Workflows

### Local Development with Hot Reload

This is the fastest way to develop and doesn't require a cluster:

**Terminal 1 - Backend:**
```bash
make build-ui  # Only needed once or when UI changes
make run-backend

# Pass additional arguments:
# make KIALI_RUN_ARGS="--log-level debug" run-backend

# Multi-cluster:
# make KIALI_RUN_ARGS="--remote-cluster-contexts kind-mesh --cluster-name-overrides kind-mesh=mesh" run-backend
```

**Terminal 2 - Frontend:**
```bash
make run-frontend
# Opens browser automatically at http://localhost:3000
```

Both backend and frontend will hot-reload on code changes.

---

## Cluster-Specific Development Workflows

The following sections provide complete workflows for developing Kiali on different cluster types. Each cluster type has specific requirements and commands.

### Working with Minikube

Minikube is the most commonly used development environment for Kiali.

#### Required Environment Variables

```bash
export CLUSTER_TYPE=minikube
export MINIKUBE_PROFILE=minikube  # use any profile name you want; "ci" is used in examples
export DORP=docker                # or "podman"
export CLIENT_EXE=kubectl         # or 'oc' for OpenShift clusters
```

#### Optional Environment Variables

```bash
# Set to false if your local helm-charts repo has a branch with no remote
export HELM_CHARTS_REPO_PULL=false
```

#### Starting Minikube Cluster

```bash
# Start basic minikube cluster
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} start

# Start with Hydra enabled (for auth testing - this is required for some molecule tests)
./hack/k8s-minikube.sh --hydra-enabled true -mp ${MINIKUBE_PROFILE} start

# For all available options, run:
./hack/k8s-minikube.sh --help

# Install Istio after cluster is ready
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}
```

#### Check Cluster Status

```bash
# Check cluster status
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} cluster-status

# Open Kubernetes dashboard
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} dashboard
```

#### Building and Deploying to Minikube

```bash
# Build UI and backend, then push images to cluster
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} build-ui build test cluster-push

# Deploy operator
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} operator-create

# Deploy Kiali
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} kiali-create
```

#### Quick Iteration After Code Changes

```bash
# Rebuild and reload just Kiali (faster)
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} \
  build cluster-push-kiali kiali-reload-image

# Rebuild and reload operator
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} \
  cluster-push-operator operator-reload-image
```

#### Installing Demo Applications

```bash
# Install Bookinfo demo
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} bookinfo

# Or use dedicated script:
./hack/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE}

# Install error rates demo (for testing)
./hack/istio/install-testing-demos.sh -c ${CLIENT_EXE}
```

#### Accessing Kiali

```bash
# Port forward to Kiali
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} port-forward

# Or get ingress URL
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} ingress

# Direct port forward:
kubectl port-forward -n istio-system svc/kiali 20001:20001
```

#### Cleanup

```bash
# Delete Kiali
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} kiali-delete

# Delete operator
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} operator-delete

# Purge everything
./hack/purge-kiali-from-cluster.sh -c ${CLIENT_EXE}

# Stop minikube (preserves cluster)
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} stop

# Delete minikube cluster completely
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} delete
```

---

### Working with KinD (Kubernetes in Docker)

KinD is useful for testing in a lightweight, disposable Kubernetes environment.

#### Required Environment Variables

```bash
export CLUSTER_TYPE=kind
export KIND_NAME=kiali-testing  # cluster name
export DORP=docker              # podman not fully supported for kind yet
export CLIENT_EXE=kubectl
```

#### Optional Environment Variables

```bash
# Set to false if your local helm-charts repo has a branch with no remote
export HELM_CHARTS_REPO_PULL=false
```

#### Starting KinD Cluster

```bash
# Start basic KinD cluster with MetalLB
./hack/start-kind.sh -n ${KIND_NAME}

# Start with custom load balancer IP range
./hack/start-kind.sh -n ${KIND_NAME} --load-balancer-range "255.70-255.84"

# Start with image registry enabled
./hack/start-kind.sh -n ${KIND_NAME} --enable-image-registry true

# Start with Hydra for auth testing
./hack/start-kind.sh -n ${KIND_NAME} --enable-hydra true

# For all available options, run:
./hack/start-kind.sh --help

# Install Istio after cluster is ready
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}
```

#### Check Cluster Status

```bash
# List KinD clusters
kind get clusters

# Check cluster is accessible
kubectl cluster-info --context kind-${KIND_NAME}

# Check if cluster is ready for Kiali
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} cluster-status
```

#### Building and Deploying to KinD

```bash
# Build UI and backend, then push images to cluster
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} build-ui build test cluster-push

# Deploy operator
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} operator-create

# Deploy Kiali
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} kiali-create
```

#### Quick Iteration After Code Changes

```bash
# Rebuild and reload just Kiali (faster)
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} \
  build cluster-push-kiali kiali-reload-image

# Rebuild and reload operator
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} \
  cluster-push-operator operator-reload-image
```

#### Installing Demo Applications

```bash
# Install Bookinfo
./hack/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE}

# Install testing demos
./hack/istio/install-testing-demos.sh -c ${CLIENT_EXE}
```

#### Accessing Kiali

```bash
# Port forward to Kiali
kubectl port-forward -n istio-system svc/kiali 20001:20001

# Access at: http://localhost:20001/kiali
```

#### Cleanup

```bash
# Delete Kiali
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} kiali-delete

# Delete operator
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} operator-delete

# Purge everything
./hack/purge-kiali-from-cluster.sh -c ${CLIENT_EXE}

# Delete entire KinD cluster
kind delete cluster --name ${KIND_NAME}
```

---

### Working with OpenShift (CRC)

OpenShift can be run locally using CodeReady Containers (CRC) or on a remote cluster.

#### Required Environment Variables

```bash
export CLUSTER_TYPE=openshift
export DORP=podman    # or docker, depending on your setup
export CLIENT_EXE=oc
```

#### Optional Environment Variables

```bash
# Set to false if your local helm-charts repo has a branch with no remote
export HELM_CHARTS_REPO_PULL=false
```

#### Starting CRC (Local OpenShift)

```bash
# Start CRC cluster (downloads CRC if not present)
./hack/crc-openshift.sh start

# Check CRC status
./hack/crc-openshift.sh status

# Install Istio after cluster is ready
./hack/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE}

# Optional: Install OpenShift Service Mesh (OSSM) instead of upstream Istio
# ./hack/istio/sail/install-ossm-release.sh install-operators
# ./hack/istio/sail/install-ossm-release.sh install-istio

# Get all routes
./hack/crc-openshift.sh routes

# Get all service endpoints
./hack/crc-openshift.sh services
```

#### Check Cluster Status

```bash
# Check CRC status
./hack/crc-openshift.sh status

# ... or use make target
make CLUSTER_TYPE=openshift cluster-status
```

#### Building and Deploying to OpenShift

```bash
# Get CRC status and credentials
./hack/crc-openshift.sh status

# Login to OpenShift using kubeadmin credentials shown in status output
# oc login -u kubeadmin -p <password-from-status> https://api.crc.testing:6443

# Build UI and backend, then push images to cluster
make CLUSTER_TYPE=openshift build-ui build test cluster-push

# Deploy operator (uses OLM on OpenShift by default)
make CLUSTER_TYPE=openshift olm-operator-create

# Or deploy without OLM:
make CLUSTER_TYPE=openshift operator-create

# Deploy Kiali
make CLUSTER_TYPE=openshift kiali-create

# Or deploy with specific version from OperatorHub
make CLUSTER_TYPE=openshift operator-install
```

#### Quick Iteration After Code Changes

```bash
# For OpenShift, typically build and push to registry
make CLUSTER_TYPE=openshift build cluster-push-kiali

# Reload Kiali
make CLUSTER_TYPE=openshift kiali-reload-image

# For operator changes:
make CLUSTER_TYPE=openshift cluster-push-operator
make CLUSTER_TYPE=openshift operator-reload-image
```

#### Installing Demo Applications

```bash
# Install Bookinfo
./hack/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE}

# Install testing demos
./hack/istio/install-testing-demos.sh -c ${CLIENT_EXE}
```

#### Accessing Kiali

```bash
# Get Kiali route URL
oc get route kiali -n istio-system -o jsonpath='{.spec.host}'

# Or use the CRC routes command
./hack/crc-openshift.sh routes | grep kiali

# Open in browser
xdg-open https://$(oc get route kiali -n istio-system -o jsonpath='{.spec.host}')
```

#### CRC-Specific Operations

```bash
# Expose cluster to remote clients (adds firewall rules)
./hack/crc-openshift.sh expose

# Remove remote access
./hack/crc-openshift.sh unexpose

# SSH into CRC VM
./hack/crc-openshift.sh ssh

# Debug in CRC VM
./hack/crc-openshift.sh sshoc

# Change domain from crc.testing to nip.io
./hack/crc-openshift.sh changedomain
```

#### Cleanup

```bash
# Delete Kiali
make CLUSTER_TYPE=openshift kiali-delete

# Delete operator
make CLUSTER_TYPE=openshift operator-delete
# Or if using OLM:
make CLUSTER_TYPE=openshift olm-operator-delete

# Purge everything
./hack/purge-kiali-from-cluster.sh -c ${CLIENT_EXE}

# Stop CRC (preserves cluster)
./hack/crc-openshift.sh stop

# Delete CRC cluster completely
./hack/crc-openshift.sh delete

# Complete cleanup including CRC cache
./hack/crc-openshift.sh cleanup
```

---

### General Cleanup Commands (All Clusters)

These commands work across all cluster types. Ensure CLUSTER_TYPE and CLIENT_EXE are set appropriately.

```bash
# Delete Kiali CR (operator removes Kiali)
make CLUSTER_TYPE=<your-cluster-type> kiali-delete

# Force remove if operator fails
make CLUSTER_TYPE=<your-cluster-type> kiali-purge

# Remove operator
make CLUSTER_TYPE=<your-cluster-type> operator-delete

# Purge everything (works with all cluster types)
./hack/purge-kiali-from-cluster.sh -c ${CLIENT_EXE}
```

---

## Operator Development

### Setting Up Operator Repository

The operator repository should be linked into the main Kiali repository:

```bash
# Clone operator separately
cd ~/source
git clone git@github.com:kiali/kiali-operator.git

# Link into kiali repo
cd ~/source/kiali/kiali
ln -s ~/source/kiali-operator operator
```

**Why use a symlink?** If you clone directly into `kiali/operator`, checking out old Kiali branches can delete your operator changes. A symlink preserves your work.

### Building and Deploying Operator

These commands require CLUSTER_TYPE to be set. Examples shown for minikube:

```bash
# Build and push operator image
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube cluster-push-operator

# Deploy operator via Helm
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube operator-create

# Deploy operator via OLM (if OLM is installed, typically on OpenShift)
make CLUSTER_TYPE=openshift olm-operator-create

# Delete operator
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube operator-delete
make CLUSTER_TYPE=openshift olm-operator-delete  # If using OLM on OpenShift
```

### Running Operator Locally

#### Run Playbook Only (Fast Testing)

For quick testing of Ansible playbook changes:

```bash
# Test Kiali playbooks
make run-operator-playbook-kiali

# Test OSSMConsole playbooks
make run-operator-playbook-ossmconsole
```

Configuration files are in `kiali-operator/dev-playbook-config/`.

**Requirements:**
- Python3 in PATH
- Ansible collections installed: `ansible-galaxy collection install -r operator/requirements.yml --force-with-deps`
- Python libraries: `python -m pip install --user --upgrade -r operator/molecule/requirements.txt`

#### Run Full Operator (With Ansible Operator)

To run the operator locally with full infrastructure:

```bash
make run-operator
```

This runs the `ansible-operator` process locally, watching for Kiali and OSSMConsole CRs in the cluster.

### Operator Configuration

Configure operator behavior:

```bash
# Allow ad-hoc namespaces
make operator-set-config-allow-ad-hoc-kiali-namespace

# Allow ad-hoc images
make operator-set-config-allow-ad-hoc-kiali-image

# Enable debug logging
make operator-set-config-ansible-debug-logs

# Set verbosity (0-7)
make operator-set-config-ansible-verbosity

# Enable profiler
make operator-set-config-ansible-profiler-on
```

### Operator Profiling

To enable profiling, set `ANSIBLE_CONFIG=/opt/ansible/ansible-profiler.cfg` in the operator deployment.

The profiler report shows task execution times. For cumulative results on looped tasks, save the report and pipe through this script:

```bash
awk -F~ '
{
  val=$2;
  $2="@";
  a[$0]+=val
}
!b[$0]++{
  c[++count]=$0}
END{
  for(i=1;i<=count;i++){
     sub("@",a[c[i]],c[i]);
     print c[i]}
}' OFS=\~ <(cat - | sed 's/\(.*\) -\+ \(.*\)s/\1~\2/') | sort -n -t '~' -k 2 -r | column -s~ -t
```

### Molecule Tests

Molecule tests validate operator functionality end-to-end.

#### Running Molecule Tests

Molecule tests work on minikube, KinD, and OpenShift. The workflow is similar for all three.

**Step 1: Ensure cluster is ready**

For **Minikube**:
```bash
export CLUSTER_TYPE=minikube
export MINIKUBE_PROFILE=ci
export DORP=podman
export CLIENT_EXE=kubectl

# Start cluster with Hydra (required for some molecule tests)
./hack/k8s-minikube.sh --hydra-enabled true -mp ci start

# Install Istio
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}
```

For **KinD**:
```bash
export CLUSTER_TYPE=kind
export KIND_NAME=ci
export DORP=docker  # podman will likely not work, using only docker
export CLIENT_EXE=kubectl

# Start cluster with Hydra (required for some molecule tests)
./hack/start-kind.sh --name ${KIND_NAME} --enable-hydra true

# Install Istio
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}
```

For **OpenShift**:
```bash
export CLUSTER_TYPE=openshift
export DORP=podman
export CLIENT_EXE=oc

# Start cluster
./hack/crc-openshift.sh start

# Install Istio
./hack/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE}
```

**Step 2: Verify Kiali is not already deployed**
```bash
${CLIENT_EXE} get deployments -A -l app.kubernetes.io/name=kiali
${CLIENT_EXE} get deployments -A -l app.kubernetes.io/name=kiali-operator

# If Kiali is deployed, purge it
./hack/purge-kiali-from-cluster.sh -c ${CLIENT_EXE}

# Wait for CRDs to be removed
timeout 60 bash -c "until ! ${CLIENT_EXE} get crd | grep kiali; do sleep 2; done"
```

**Step 3: Build and push dev images**
```bash
# For Minikube:
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=ci build-ui build test cluster-push

# For KinD:
make CLUSTER_TYPE=kind KIND_NAME=ci  build-ui build test cluster-push

# For OpenShift:
make CLUSTER_TYPE=openshift build-ui build test cluster-push
```

**Step 4: Run molecule tests**

The `-udi` (`--use-dev-images`) flag controls whether to use dev images:
- Set to `true` to test your local code changes (requires Step 3: build and push dev images first)
- Set to `false` to test with latest images published on quay.io

The `-hcrp` (`--helm-charts-repo-pull`) flag controls whether to pull the helm-charts repository:
- Set to `true` to pull the latest helm-charts from the remote repository
- Set to `false` if your local helm-charts repo has a branch with no remote (avoids git pull errors)

```bash
# For Minikube:
./hack/run-molecule-tests.sh \
  --client-exe "$(which kubectl)" \
  --cluster-type minikube \
  --minikube-profile ci \
  -udi true \
  -hcrp false \
  -at "token-test"

# For KinD:
./hack/run-molecule-tests.sh \
  --client-exe "$(which kubectl)" \
  --cluster-type kind \
  -udi true \
  -hcrp false \
  -at "token-test"

# For OpenShift:
./hack/run-molecule-tests.sh \
  --client-exe "$(which oc)" \
  --cluster-type openshift \
  -udi true \
  -hcrp false \
  -at "token-test"
```

#### Molecule Test Locations

Tests are in `kiali-operator/molecule/`. Each subdirectory is a test scenario (e.g., `config-values-test`, `token-test`).

---

## File Protection Rules

### Never Modify These Files

**Versioned Operator Roles:**
- `kiali-operator/roles/v1.73/`, `roles/v2.4/`, etc. - Only modify the `default` role

**Old CSV Versions:**
- `kiali-operator/manifests/*/[version]/` - Only modify the LATEST version

**CRD Copies:**
- Any CRD file that is not in `kiali-operator/crd-docs/crd/`
- Golden copies are in `crd-docs/crd/` - these are the source of truth
- Sync changes using: `make sync-crds` in kiali-operator repo (this can make changes to your helm-charts repo as well as the kiali-operator repo)

**Generated Documentation:**
- `kiali.io/content/en/docs/Configuration/kialis.kiali.io.md`
- `kiali.io/content/en/docs/Configuration/ossmconsoles.kiali.io.md`

**Output Directories:**
- Never modify `_output/` directories or subdirectories
- These contain build artifacts and generated files

### Backward Compatibility

**CRITICAL:** When modifying operator resources (roles, permissions, CSVs), check if changes break older supported versions in `kiali-operator/roles/` (e.g., `v1.24`).

If changes break old versions that are still supported, only make breaking changes after old versions are no longer supported.

---

## Common Patterns and Best Practices

### Making Changes to Resources or Configuration

When modifying Kubernetes resources or Kiali configuration, you must update multiple locations to support all installation methods.

#### Checklist: Altering Kiali Operator Resources

- [ ] Update golden copy: `kiali-operator/manifests/kiali-upstream/`
- [ ] Update golden copy: `kiali-operator/manifests/kiali-ossm/manifests/kiali.clusterserviceversion.yaml`
- [ ] Update Helm chart: `helm-charts/kiali-operator/templates/`
- [ ] If modifying CRD schema: Run `make sync-crds` in kiali-operator repo (requires helm-charts PR)

#### Checklist: Altering Kiali Server Resources

- [ ] Update Kubernetes templates: `kiali-operator/roles/default/kiali-deploy/templates/kubernetes/`
- [ ] Update OpenShift templates: `kiali-operator/roles/default/kiali-deploy/templates/openshift/`
- [ ] Check if removal needed: `kiali-operator/roles/default/kiali-remove/`
- [ ] Update Helm chart: `helm-charts/kiali-server/templates/`

#### Checklist: Altering Kiali Server Permissions (All Namespaces)

- [ ] Update: `kiali-operator/manifests/kiali-upstream/` CSVs
- [ ] Update: `kiali-operator/manifests/kiali-ossm/manifests/kiali.clusterserviceversion.yaml`
- [ ] Update: `kiali-operator/roles/default/kiali-deploy/templates/kubernetes/role.yaml`
- [ ] Update: `kiali-operator/roles/default/kiali-deploy/templates/kubernetes/role-viewer.yaml`
- [ ] Update: `kiali-operator/roles/default/kiali-deploy/templates/openshift/role.yaml`
- [ ] Update: `kiali-operator/roles/default/kiali-deploy/templates/openshift/role-viewer.yaml`
- [ ] Update: `helm-charts/kiali-operator/templates/clusterrole.yaml`
- [ ] Update: `helm-charts/kiali-server/templates/role.yaml`
- [ ] Update: `helm-charts/kiali-server/templates/role-viewer.yaml`

#### Checklist: Altering Kiali Server Permissions (Control Plane Only)

- [ ] Update: `kiali-operator/manifests/kiali-upstream/` CSVs
- [ ] Update: `kiali-operator/manifests/kiali-ossm/manifests/kiali.clusterserviceversion.yaml`
- [ ] Update: `helm-charts/kiali-operator/templates/clusterrole.yaml`

#### Checklist: Altering Configuration Settings

- [ ] Set default: `kiali-operator/roles/default/kiali-deploy/defaults/main.yml`
- [ ] If new top-level setting: Add to `kiali-operator/roles/default/kiali-deploy/vars/main.yml`
- [ ] Document in CRD: `kiali-operator/crd-docs/crd/kiali.io_kialis.yaml`
- [ ] Add example to: `kiali-operator/crd-docs/cr/kiali.io_v1alpha1_kiali.yaml`
- [ ] Validate CR: `make validate-cr` in kiali-operator repo
- [ ] If modified CRD: Run `make sync-crds` in kiali-operator repo
- [ ] Only if appropriate (usually not): Set value in `cr.spec` section of `helm-charts/kiali-operator/values.yaml`
- [ ] Set default: `helm-charts/kiali-server/values.yaml`
- [ ] Sort alphabetically in all files where added
- [ ] If appropriate: Add test to `kiali-operator/molecule/config-values-test/converge.yml`
- [ ] If CRD property added/removed/modified: Update `kiali-operator/molecule/config-values-test/kiali-cr-all-yaml`

#### Checklist: Altering Monitoring Dashboard Templates

- [ ] Modify built-in templates: `kiali/config/dashboards/dashboards.go`

#### Checklist: Backporting to Older Versions

- [ ] Duplicate changes from `roles/default/` to versioned roles (e.g., `roles/v1.24/`)
- [ ] Cherry-pick changes to appropriate git branches

#### Checklist: Adding Support For a New Ansible Role Version

- [ ] Add new role directory by copying `kiali-operator/roles/default/` and naming it `vX.Y` (where X.Y is the new version)
- [ ] Add new RELATED_IMAGE reference and relatedImages entry to `kiali-operator/manifests/kiali-ossm/manifests/kiali.clusterserviceversion.yaml`
- [ ] Add new version to `kiali-operator/playbooks/kiali-default-supported-images.yml`
- [ ] Add new version to `kiali-operator/playbooks/ossmconsole-default-supported-images.yml`

#### Checklist: Removing Support For an Old Ansible Role Version

- [ ] Delete the role directory from `kiali-operator/roles/`
- [ ] Remove RELATED_IMAGE reference from `kiali-operator/manifests/kiali-ossm/manifests/kiali.clusterserviceversion.yaml`
- [ ] Remove version from `kiali-operator/playbooks/kiali-default-supported-images.yml`
- [ ] Remove version from `kiali-operator/playbooks/ossmconsole-default-supported-images.yml`

### Working with CRDs

#### Modifying CRD Schemas

1. Edit golden copy: `kiali-operator/crd-docs/crd/kiali.io_kialis.yaml` or `ossmconsoles.yaml`
2. Validate: `make validate-cr` in kiali-operator repo
3. Sync to all locations: `make sync-crds` in kiali-operator repo
4. Verify sync: `make validate-crd-sync` in kiali-operator repo
5. Create PR for kiali-operator repo
6. Create separate PR for helm-charts repo with synced files

#### CRD File Locations

**Golden Copies (source of truth):**
- `kiali-operator/crd-docs/crd/kiali.io_kialis.yaml`
- `kiali-operator/crd-docs/crd/kiali.io_ossmconsoles.yaml`

**Synchronized Copies (do not edit directly):**
- `kiali-operator/manifests/kiali-ossm/manifests/kiali.crd.yaml`
- `kiali-operator/manifests/kiali-ossm/manifests/ossmconsole.crd.yaml`
- `kiali-operator/manifests/kiali-upstream/[version]/manifests/kiali.crd.yaml`
- `helm-charts/kiali-operator/crds/crds.yaml`
- `helm-charts/kiali-operator/templates/ossmconsole-crd.yaml`

### Upgrading Dependencies

#### Upgrading Go

```bash
# Update go.mod
go mod edit -go=x.y

# Update dependencies
go mod tidy -v

# Verify everything builds
make clean build build-ui test

# Commit and create PR
```

#### Upgrading PatternFly

```bash
# Check for updates
npx npm-check-updates -t latest -f '/^@patternfly/'

# Update yarn.lock (from the frontend/ directory)
yarn install

# Commit package.json and yarn.lock
```

> **Note:** Yarn is managed via [corepack](https://nodejs.org/api/corepack.html). Run `corepack enable` once before using `yarn`. The exact Yarn version is pinned in `frontend/package.json` via the `packageManager` field.

### Hack Scripts

The `hack/` directory contains many useful scripts:

**Cluster Setup:**
- `hack/k8s-minikube.sh` - Start minikube cluster
- `hack/crc-openshift.sh` - Start local OpenShift cluster
- `hack/start-kind.sh` - Start KinD cluster
- `hack/istio/install-istio-via-istioctl.sh` - Install Istio
- `hack/istio/install-bookinfo-demo.sh` - Install Bookinfo demo

**Development:**
- `hack/run-kiali.sh` - Run Kiali standalone
- `hack/run-integration-tests.sh` - Run full integration test suite
- `hack/run-molecule-tests.sh` - Run Molecule tests
- `hack/purge-kiali-from-cluster.sh` - Remove all Kiali resources

**Configuration:**
- `hack/configure-operator.sh` - Configure operator settings

All scripts support `--help` for detailed usage information.

---

## Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Ensure correct Go version
make go-check

# Clean everything and rebuild
make clean-all
make build-ui build test
```

**Cluster Push Failures:**
```bash
# Verify cluster is accessible (specify your cluster type)
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} cluster-status

# For minikube, ensure profile is set
export MINIKUBE_PROFILE=ci
minikube status -p ci

# For kind
export KIND_NAME=kiali-testing
kind get clusters
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} cluster-status
```

**Operator Not Working:**
```bash
# Check operator logs
kubectl logs -n kiali-operator deployment/kiali-operator -f

# Check Kiali CR status
kubectl get kiali -A -o yaml

# Verify operator has correct image
kubectl get deployment kiali-operator -n kiali-operator -o yaml | grep image:
```

**Molecule Test Failures:**
```bash
# Ensure cluster is clean
./hack/purge-kiali-from-cluster.sh -c kubectl
kubectl get crd | grep kiali  # Should return nothing

# Rebuild images
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=ci build-ui build test cluster-push

# Run with debug
export MOLECULE_DEBUG=true
./hack/run-molecule-tests.sh ...
```

**Frontend Not Loading:**
```bash
# Check backend is running
curl http://localhost:20001/kiali/api

# Verify proxy setting in package.json
grep proxy frontend/package.json

# Restart frontend dev server
make run-frontend
```

### Getting Debug Information

```bash
# Run debug info collection script
./hack/ci-get-debug-info.sh

# Get operator logs
kubectl logs -n kiali-operator deployment/kiali-operator --tail=100

# Get Kiali server logs
kubectl logs -n istio-system deployment/kiali --tail=100

# Check all Kiali-related resources
kubectl get all,kiali,ossmconsole -A | grep kiali
```

### SELinux Issues

If you encounter permission errors with molecule tests:

```bash
# Temporarily disable SELinux
sudo setenforce 0

# Re-enable after testing
sudo setenforce 1
```

---

## Additional Resources

- **Main Documentation:** https://kiali.io/docs
- **Contributing Guide:** [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Style Guide:** [STYLE_GUIDE.adoc](./STYLE_GUIDE.adoc)
- **README:** [README.adoc](./README.adoc)
- **Frontend README:** [frontend/README.adoc](./frontend/README.adoc)
- **Operator Development:** [operator/DEVELOPING.adoc](./operator/DEVELOPING.adoc)
- **Release Process:** [RELEASING.adoc](./RELEASING.adoc)

**Makefile Help:**
```bash
make help # Show all available targets
```

**Community:**
- GitHub Discussions: https://github.com/kiali/kiali/discussions
- GitHub Issues: https://github.com/kiali/kiali/issues
- Community Page: https://kiali.io/community/

---

## Quick Command Reference

### Local Development (No Cluster)

```bash
# Development cycle with hot reload
make build-ui && make run-backend  # Terminal 1
make run-frontend                  # Terminal 2
```

### Minikube Quick Reference

```bash
# Setup
export CLUSTER_TYPE=minikube
export MINIKUBE_PROFILE=minikube  # use any profile name; examples below use "ci"
export DORP=docker
export CLIENT_EXE=kubectl

# Start cluster and install Istio
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} start
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}

# Build and deploy
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} build-ui build test cluster-push
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} operator-create
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} kiali-create

# Quick iteration
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} \
  build cluster-push-kiali kiali-reload-image

# Access
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} port-forward

# Cleanup
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} kiali-delete operator-delete
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} stop
```

### KinD Quick Reference

```bash
# Setup
export CLUSTER_TYPE=kind
export KIND_NAME=kiali-testing
export DORP=docker
export CLIENT_EXE=kubectl

# Start cluster and install Istio
./hack/start-kind.sh -n ${KIND_NAME}
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}

# Build and deploy
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} build-ui build test cluster-push
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} operator-create
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} kiali-create

# Quick iteration
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} \
  build cluster-push-kiali kiali-reload-image

# Access
kubectl port-forward -n istio-system svc/kiali 20001:20001

# Cleanup
kind delete cluster --name ${KIND_NAME}
```

### OpenShift Quick Reference

```bash
# Setup
export CLUSTER_TYPE=openshift
export DORP=podman
export CLIENT_EXE=oc

# Start cluster and install Istio
./hack/crc-openshift.sh start
./hack/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE}

# Get credentials and login
./hack/crc-openshift.sh status
# oc login -u kubeadmin -p <password-from-status> https://api.crc.testing:6443

# Build and deploy
make CLUSTER_TYPE=openshift build-ui build test cluster-push
make CLUSTER_TYPE=openshift operator-create  # or make CLUSTER_TYPE=openshift olm-operator-create
make CLUSTER_TYPE=openshift kiali-create

# Quick iteration
make CLUSTER_TYPE=openshift build cluster-push-kiali kiali-reload-image

# Access
./hack/crc-openshift.sh routes | grep kiali

# Cleanup
make CLUSTER_TYPE=openshift kiali-delete operator-delete # or olm-operator-delete
./hack/crc-openshift.sh stop
```

### Testing

```bash
# Backend tests
make test

# Frontend tests
make cypress-gui            # Interactive
make cypress-run            # Headless

# Molecule tests (example uses minikube with profile "ci")
./hack/run-molecule-tests.sh --client-exe "$(which kubectl)" \
  --cluster-type minikube --minikube-profile ci -udi true -hcrp false
```

### Code Quality

```bash
# Format and lint
make format lint

# Check Go version
make go-check

# Clean builds
make clean-all
```

### Operator Development

```bash
# Test playbook locally (fastest)
make run-operator-playbook-kiali

# Run full operator locally
make run-operator

# Build and push operator
make cluster-push-operator
```

### Get Help

```bash
make help
./hack/k8s-minikube.sh --help
./hack/start-kind.sh --help
./hack/crc-openshift.sh --help
```

---

## Important Reminders

**Build Order:**
- Always build UI before backend: `make build-ui` then `make build`

**Frontend Tooling:**
- Yarn is managed via [corepack](https://nodejs.org/api/corepack.html). Run `corepack enable` once before using `yarn`. The pinned version is in `frontend/package.json` (`packageManager` field).

**Environment Variables:**
- Set `CLUSTER_TYPE` (minikube, kind, or openshift)
- Set `MINIKUBE_PROFILE` for minikube
- Set `KIND_NAME` for KinD
- Set `DORP` (docker or podman)
- Set `CLIENT_EXE` (kubectl for minikube/KinD, oc for OpenShift)

**Before Committing:**
- Format and lint: `make format lint`
- Run tests: `make test`
- Remove trailing whitespace
- Sort struct fields and YAML keys alphabetically

**Operator Changes:**
- Ask to run molecule tests after operator changes
- Update all installation methods (Helm, OLM, Operator templates)
- Check backward compatibility with versioned roles

**Protected Files:**
- Never modify versioned operator roles (`roles/v1.*/`, `roles/v2.*/`)
- Never modify old CSV versions (only modify LATEST version)
- Never modify CRD copies (only golden copies in `crd-docs/crd/`)
- Never modify generated documentation files
- Never modify `_output/` directories

