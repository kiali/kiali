---
name: regression-fix
description: Investigate and fix a failing Cypress test from a GitHub issue. Reads the issue for scenario details, traces the failure through step definitions, analyzes root cause, and implements a fix.
disable-model-invocation: false
allowed-tools: Bash(grep *), Bash(find *), Bash(cat *), Bash(git *), Bash(yarn *), Bash(gh *)
---

# Regression Fix Skill

Read a GitHub issue filed by `/regression-report` → investigate root cause → fix the test code.

## What you need from the user

**GitHub issue URL or number** — e.g. `https://github.com/kiali/kiali/issues/1234` or `#1234`.

The issue was created by `/regression-report` and contains structured fields in its body:
- Scenario name, feature file, tags, classification, error message, environment, versions.

## Step 1 — Fetch issue and parse fields

```bash
gh issue view <number-or-url> --repo kiali/kiali
```

Extract from issue body:
- **Scenario** from `**Scenario:** \`<name>\``
- **Feature file** from `**Feature file:** \`<path>\``
- **Tag(s)** from `**Tag(s):** \`<tags>\``
- **Classification** from `**Classification:** <flake | ui-bug | test-bug>`
- **Error** from prose after classification line
- **Environment** from the Environment section (Kiali version, Istio version, OCP version, build URL)

If any field is missing, ask the user.

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

## Step 5 — Verify

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

```bash
cd frontend && npx tsc --noEmit --project cypress/tsconfig.json 2>&1 | head -30
```

### 5d — Summary

Output: what changed, why, which scenarios are affected.

## Codebase facts

These are non-obvious and frequently relevant to fixes:

- **`testIsolation: false`** — scenarios within a `.feature` file share state. Scenario on line 74 can depend on actions from scenario on line 60.
- **`retries: { runMode: 2 }`** in `cypress.config.ts` — every spec retried up to 2x in CI.
- **`defaultCommandTimeout: 40000`** — 40s assertion timeout.
- **`cy.session()` + `cacheAcrossSpecs: true`** — login cached across feature files, restore takes 2.5–12s.
- **Step definitions** in `frontend/cypress/integration/common/` — shared across all features. File naming: `<feature_name>.ts`.
- **Hooks** in `frontend/cypress/integration/common/hooks.ts` — tag-gated Before/After.
- **`ensureKialiFinishedLoading()`** in `transition.ts` — checks three loading states are gone.
- **`waitForKialiApiReady()`** in `transition.ts` — polls `/api/status` until 200 (120s timeout).

## Guardrails

1. **No `cy.wait(N)` hard waits.** Use `.should()` assertions or `cy.intercept().as().wait()`.
2. **No nested `it()` inside step definitions.** This is the most common anti-pattern in this codebase. Cypress-Cucumber-Preprocessor already wraps each scenario in an `it()`.
3. **No modifying `cypress.config.ts`** retry settings or `testIsolation` unless explicitly instructed.
4. **No removing or weakening assertions.** Make tests more resilient, not less thorough.
5. **No new npm/yarn dependencies.** Work within existing Cypress and Cucumber preprocessor API.
6. **No code fixes for infrastructure failures.** Backend 500s, cluster instability, missing CRDs — state "no fix needed" and explain.
7. **Always check all consumers** of modified shared step definitions before committing.
