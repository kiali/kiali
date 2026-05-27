---
name: regression-fix
description: Investigate and fix a failing Cypress test from a GitHub issue. Reads the issue for scenario details, traces the failure through step definitions, analyzes root cause, implements a fix, and verifies it locally before committing.
disable-model-invocation: false
allowed-tools: Bash(grep *), Bash(find *), Bash(cat *), Bash(git *), Bash(yarn *), Bash(gh *), Bash(npx *), Bash(curl *), Bash(kind *), Bash(pkill *), mcp__cypress-debugger__*
---

# Regression Fix Skill

Read a GitHub issue filed by `/regression-report` → investigate root cause → fix the test code → **run the test locally and confirm it passes** → commit.

> **Never commit without running the test first.** Static analysis alone (lint, tsc) is not sufficient — the fix must be verified with Cypress executing against a live cluster.

## Prerequisites — cluster and Kiali must be running

**Check the issue Environment section first.** If `Environment: Jenkins nightly` or `Kubernetes impl: OpenShift`, local kind verification is **not equivalent** — the failure may be OCP-specific (cluster auth, ResizeObserver, ingress). In that case:
- Implement the fix locally.
- State in the summary: "Local kind cluster used for static verification; OCP-specific repro requires VPN + `oc login <cluster-url>` + cluster access."
- Do not claim the fix is verified unless run against an equivalent environment.

For kind-based failures, verify the environment is ready:

```bash
# 1. Cluster running?
kind get clusters   # expect "ci" or similar

# 2. Kiali API responding?
curl -s http://localhost:20001/kiali/api | head -c 80

# 3. Demo apps installed?
kubectl get ns bookinfo 2>/dev/null && echo "bookinfo ok" || echo "MISSING"
```

If the cluster does not exist, set it up (takes ~5 min):

```bash
make build-ui build
hack/run-integration-tests.sh --test-suite local --setup-only true
```

If Kiali is not running, start it:

```bash
$(go env GOPATH)/bin/kiali \
  -c hack/ci-yaml/ci-test-config-no-cache.yaml run \
  --cluster-name-overrides kind-ci=cluster-default \
  --port-forward-tracing --enable-tracing \
  --port-forward-prom --port-forward-grafana --no-browser &
```

**Cypress environment variables** (set as needed):

```bash
export CYPRESS_BASE_URL=http://localhost:20001   # default
export CYPRESS_USERNAME=jenkins                  # default
export CYPRESS_PASSWD=<value>                    # no default
export CYPRESS_AUTH_PROVIDER=my_htpasswd_provider
export CYPRESS_ALLOW_INSECURE_KIALI_API=true     # useful for CRC/insecure endpoints
```

---

## Step 1 — Fetch issue and parse fields

```bash
gh issue view <number-or-url> --repo kiali/kiali
```

Extract from issue body:
- **Scenario** from `**Scenario:** \`<name>\``
- **Feature file** from `**Feature file:** \`<path>\``
- **Tag(s)** from `**Tag(s):** \`<tags>\``
- **Classification** from `**Classification:** <flake | ui-bug | test-bug>`
- **Failing step** from `**Failing step:** \`<step>\`` — use this to jump directly to the right step definition in Step 2b
- **Confidence** from `**Confidence:** <high | medium | low>` — low confidence = spend more time in Step 3 before implementing
- **Error** from prose after classification line
- **Environment** from the Environment section (Kiali version, Istio version, OCP version, build URL)

If any field is missing, ask the user.

---

## Step 2 — Locate scenario and trace steps

### 2a — Verify and read the scenario

Confirm feature file exists at the stated path. Read the full scenario including its Background section:

```bash
grep -n "<scenario name>" frontend/cypress/integration/featureFiles/<file>.feature
```

Read the feature file. Note all tags on the scenario — they determine which hooks fire via `Before({ tags: '@tag' })` in `hooks.ts`.

### 2b — Trace each step to its definition

Each `Given/When/Then/And` line maps to a step definition in `frontend/cypress/integration/common/*.ts`:

```bash
grep -rn "<step text fragment>" frontend/cypress/integration/common/
```

Read the full step definition function. Follow any helper calls into `frontend/cypress/support/commands.ts` or `frontend/cypress/integration/common/transition.ts`.

**Important:** `testIsolation: false` means scenarios within a single `.feature` file share state. A failing scenario may depend on state left by a preceding scenario.

---

## Step 3 — Analyze root cause

### 3a — Map error to known patterns

| Pattern | Signature | Typical files |
|---------|-----------|---------------|
| ACE editor timing | `.ace_content` text empty, `win.ace` undefined | `wizard_request_routing.ts`, `mesh.ts` |
| Nested `it()` in steps | `it('...', { retries: 3 }, () => {` inside step def | `mesh.ts`, `wizard_request_routing.ts` |
| React component polling | `cy.getReact()` returns empty array | `mesh.ts`, `graph.ts` |
| Session restore latency | `cy.session()` setup slow (12s+ vs ~2.5s normal) | `commands.ts` |
| Backend 500 errors | `/api/status`, `/api/mesh/graph` return 500 | transient — no code fix |
| Recursive polling | `doRequest()`/`attempt()` without timeout guard | `hooks.ts`, `commands.ts` |

### 3b — Check history

```bash
git log --oneline --all --grep="<scenario fragment>" -- frontend/cypress/ | head -10
gh issue list --repo kiali/kiali --search "<scenario fragment>" --state all
```

### 3c — Root-cause statement

Write a one-paragraph root-cause analysis before making any code changes. This prevents blindly applying retries.

---

## Step 4 — Implement fix

Strategy depends on classification:

### flake

Fix based on the specific sub-pattern identified in step 3a:

**Nested `it()` blocks** — unwrap to direct Cypress assertions:
```typescript
// BAD: nested it() inside step definition
it('spinner should disappear', { retries: 3 }, () => {
  cy.get('#loading_kiali_spinner').should('not.exist');
});

// GOOD: direct assertion (retries built into .should())
cy.get('#loading_kiali_spinner').should('not.exist');
```

**ACE editor timing** — add assertion guard before reading content:
```typescript
// BAD: reads immediately, may be empty
cy.get('.ace_content').invoke('text').should('match', re);

// GOOD: wait for content to appear first
cy.get('.ace_content').should('not.be.empty').invoke('text').should('match', re);
```

**ACE window access** — guard `window.ace` existence:
```typescript
// BAD: ace may not be loaded
cy.window().then((win: any) => { win.ace.edit('editor') });

// GOOD: assert property exists first
cy.window().should('have.property', 'ace').then((win: any) => {
  const editor = (win as any).ace.edit('editor');
});
```

**Session restore** — ensure page loaded after session restore:
```typescript
ensureKialiFinishedLoading();
```

**Backend 500 errors (transient infrastructure)** — no code fix needed. State: "Infrastructure-caused failure. The existing `retries: { runMode: 2 }` in `cypress.config.ts` handles this. No test code change required."

### test-bug

1. Compare selector/assertion text in step definition against current React source:
   ```bash
   grep -rn "<selector-or-text>" frontend/src/
   ```
2. Update step definition to match current UI.
3. If Background steps are wrong, fix the feature file.

### ui-bug

1. Confirm test expectation is correct by reading Gherkin scenario intent.
2. Search app source: `grep -rn "<component>" frontend/src/`
3. If fix is in frontend `src/` code — implement it.
4. If fix requires backend changes — state this clearly and note in the issue.

---

## Step 5 — Static checks

Run these before launching Cypress. They catch compile errors and Gherkin issues early.

### 5a — Lint (if `.feature` files changed)

```bash
cd frontend && yarn lint:gherkin
```

### 5b — Impact analysis

Check all consumers of modified step definitions:

```bash
grep -rn "<modified step text>" frontend/cypress/integration/featureFiles/
```

List affected scenarios. Verify the fix does not break their semantics.

### 5c — Type check (if `.ts` files changed)

On a fresh clone, run `yarn install` in `frontend/` first. Cypress types ship with the `cypress` package; `cypress/tsconfig.json` sets `typeRoots` so they resolve correctly.

```bash
cd frontend && npx tsc --noEmit --project cypress/tsconfig.json 2>&1 | head -30
```

Focus on errors in files you changed; pre-existing errors elsewhere can be ignored.

---

## Step 6 — Run the test locally and verify it passes

**This step is mandatory before committing.**

### 6a — Tag the scenario for fast iteration

Add `@selected` to the failing scenario in the `.feature` file:

```gherkin
@selected
@core-2
Scenario: My failing scenario
  ...
```

### 6b — Kill any existing Cypress/Chrome processes

```bash
pkill -9 -f cypress; pkill -9 -f "chrome.*9222"
# Wait 2-3 s, then verify port 9222 is free:
curl -s http://127.0.0.1:9222/json/list || echo "port free"
```

### 6c — Launch Cypress with Chrome on a fixed CDP port

```bash
cd frontend
CYPRESS_BASE_URL=http://localhost:20001 \
CYPRESS_REMOTE_DEBUGGING_PORT=9222 \
npx cypress run \
  --browser chrome \
  --headed \
  --no-exit \
  -e TAGS="@selected" \
  --spec "cypress/integration/featureFiles/<failing-feature>.feature"
```

Key flags:
- `CYPRESS_REMOTE_DEBUGGING_PORT=9222` — exposes Chrome on a fixed CDP port so the `cypress-debugger` MCP can connect
- `--browser chrome` — required for CDP (Electron doesn't support it)
- `--headed` — shows the browser window
- `--no-exit` — keeps the browser open after tests finish for inspection

### 6d — Inspect with `cypress-debugger` MCP

With Chrome on port 9222, use MCP tools to inspect the live browser:

```javascript
// Quick pass/fail check
() => { const s = document.querySelectorAll('[aria-label="Stats"] li'); return Array.from(s).map(e => e.textContent?.trim()); }

// Last 10 Cypress command log entries
() => { const items = document.querySelectorAll('.command-wrapper'); return Array.from(items).slice(-10).map(el => el.textContent?.trim()).join('\n'); }

// Error message (if any)
() => { const el = document.querySelector('.runnable-err-message'); return el ? el.textContent : 'no error'; }

// Inspect Kiali app DOM inside the iframe
() => { const f = document.querySelector('iframe'); if (!f?.contentDocument) return 'no iframe'; return f.contentDocument.body?.textContent?.substring(0, 300); }
```

**Understanding snapshot structure:**
- Left panel (refs `e*`) — Cypress test runner: spec name, pass/fail stats, step log
- Right panel / iframe (refs `f<N>e*`) — actual Kiali UI under test

**Re-run after code change:**

> `Ctrl+R` does NOT pick up code changes — Cypress caches compiled specs. After modifying any `.ts` or `.feature` file you **must kill and restart** the Cypress process (step 6b → 6c again), then reconnect MCP via `browser_close` + `browser_navigate`.

To re-run without code change (e.g., flake check):
```
browser_press_key({ key: "Control+r" })
```

Verify re-run happened: element ref prefixes change (`f1e*` → `f3e*`) and timestamps in Kiali UI update.

### 6e — Confirm the test passes

The test **must show a green pass** in the Cypress runner before proceeding. If it still fails, return to step 3 and re-analyze.

### 6f — Remove `@selected` tag

```bash
# Remove @selected from the feature file before committing
grep -n "@selected" frontend/cypress/integration/featureFiles/<file>.feature
# Edit and remove the line
```

---

## Step 7 — Issue lifecycle (optional)

After confirming the test passes, offer to update the GitHub issue:

```bash
# Add a comment with fix summary
gh issue comment <number> --repo kiali/kiali --body "Fixed in <branch>. Root cause: <one-line>. Verified locally with Cypress."

# Close only if user requests and fix is merged or ready to merge
gh issue close <number> --repo kiali/kiali --comment "Closing — fix merged."
```

Do not close the issue without user confirmation.

## Step 8 — Summary and optional commit

Output: what changed, why, which scenarios are affected, confirmation that the test passed locally (or note environment limitations if OCP-specific).

Prepare a commit message but **do not commit** — wait for the user to explicitly request it.

---

## Codebase facts

Non-obvious and frequently relevant to fixes:

- **`testIsolation: false`** — scenarios within a `.feature` file share state. Scenario on line 74 can depend on actions from scenario on line 60.
- **`retries: { runMode: 2 }`** in `cypress.config.ts` — every spec retried up to 2x in CI.
- **`defaultCommandTimeout: 40000`** — 40s assertion timeout.
- **`cy.session()` + `cacheAcrossSpecs: true`** — login cached across feature files, restore takes 2.5–12s.
- **Step definitions** in `frontend/cypress/integration/common/` — shared across all features. File naming: `<feature_name>.ts`.
- **Hooks** in `frontend/cypress/integration/common/hooks.ts` — tag-gated Before/After.
- **`ensureKialiFinishedLoading()`** in `transition.ts` — checks three loading states are gone.
- **`waitForKialiApiReady()`** in `transition.ts` — polls `/api/status` until 200 (120s timeout).
- **`cy.getBySel('name')`** → selects `[data-test="name"]` (custom Kiali command).
- **`getColWithRowText(rowText, colName)`** in `table.ts` — finds a table cell by row content and column name.
- **OSSMC compatibility** — `cy.request` must use object form `{ url: '...' }`; `cy.intercept` patterns must start with `**`; navigation links must use `linkSelector()` from `utils.ts`.
- **`.mcp.json`** at repo root configures `cypress-debugger` MCP server pointing to `http://127.0.0.1:9222` — no manual setup needed; tools (`mcp__cypress-debugger__browser_snapshot`, etc.) are available automatically.

---

## Guardrails

1. **No `cy.wait(N)` hard waits.** Use `.should()` assertions or `cy.intercept().as().wait()`.
2. **No nested `it()` inside step definitions.** This is the most common anti-pattern in this codebase. Cypress-Cucumber-Preprocessor already wraps each scenario in an `it()`.
3. **No modifying `cypress.config.ts`** retry settings or `testIsolation` unless explicitly instructed.
4. **No removing or weakening assertions.** Make tests more resilient, not less thorough.
5. **No new npm/yarn dependencies.** Work within existing Cypress and Cucumber preprocessor API.
6. **No code fixes for infrastructure failures.** Backend 500s, cluster instability, missing CRDs — state "no fix needed" and explain.
7. **Always check all consumers** of modified shared step definitions before committing.
8. **Never commit without a passing local run.** Step 6 is not optional.
9. **ui-bug: do not weaken test assertions without a product fix.** If classification is `ui-bug`, changing test expectations to match broken UI without implementing the product fix is forbidden — it masks the bug.
10. **`@offline` tag means the scenario uses must-gather/snapshot data instead of a live cluster.** Hooks in `hooks.ts` gate on this tag — the test does not issue real API calls. OCP-specific failures tagged `@offline` may still pass locally against kind (different data source). Note this mismatch in the fix summary.
