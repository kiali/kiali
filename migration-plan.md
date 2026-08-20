## Proposed updated Acceptance Criteria

Suggested replacement for the epic acceptance criteria. Addresses gaps raised in the thread (OSSMC, React fiber, Jenkins/private pipelines, LTS strategy, migration skill, full suite coverage).

### Decisions & tracking

- [x] Decision documented: **Native Playwright Test** (not `playwright-bdd`) — self-contained `.spec.ts` + Page Object Models; no third-party Gherkin dependency. (PR #10174)
- [x] React fiber policy documented: prefer `data-test` / DOM assertions; no new `page.evaluate()` fiber walking without a TODO. `data-ready` DOM attribute demonstrated on MiniGraphCard. (PR #10217, PR #10220)
- [ ] CI strategy documented: **coexistence on `master` first**; LTS/supported branches after master cutover
- [ ] Private pipelines (Jenkins) included in cutover acceptance — not GitHub Actions only
- [ ] Epic broken into sub-issues (Phase 0 spike, migration skill, smoke, core-1, core-2, specialized, OSSMC, Jenkins, Cypress removal)
- [x] Suite tags: use Playwright's native `tag` option via centralized exports in `e2e/utils/suite-tags.ts`, not title-only strings. Non-project conditions (e.g. `@prometheus-disabled`) use the `annotation` API. (PR #10174 review, PR #10195, PR #10217)
- [x] Test-migration PR scope: only `data-test` attributes and `aria-label` additions in source code. No ESLint fixes, refactors, or production behavioral changes — those go to dedicated PRs targeting `master`. (PR #10217 — StatefulFilters revert)
- [x] Auth setup failure handling: write empty `storageState` then fail via `expect().toContain()`, not `throw`. Hard throws produce zero JUnit output; `expect` produces 1 FAILED + 18 SKIPPED. (PR #10217)
- [x] `playwright:run:last-failed` removed — `--last-failed` overwrites `blob-report/` and produces misleading Jenkins failure counts. CI reports reflect the full first pass only. (PR #10195)

### Migration conventions

Rules that apply to every spec and page object across the entire migration. Violations found in Phase 0–1 (see `review-pr-10174-playwright.md`) — enforce from Phase 1 onward.

Full conventions with do/don't examples: see [`frontend/e2e/README.md`](./frontend/e2e/README.md).

**Waiting — no explicit sleeps**
- Never use `page.waitForTimeout()`. Playwright auto-waits for actionability on every action (`actionTimeout: 40_000` in config). Explicit sleeps mask root causes and slow suites.
- No manual retry loops wrapping `locator.click()` (e.g. `robustClick`, `retryOnError`). If an element is covered by a PF overlay, wait for the overlay to dismiss: `await expect(overlay).not.toBeVisible()`. If a click has no effect despite being actionable, wait on a state/network condition, not a timer.

**Selectors — no structural copies from Cypress**
- No positional CSS child selectors: `#foo > :nth-child(2)`, `> :nth-child(${i})`. These break on layout changes. Select by text, role, or `data-test`.
- No PF internal class selectors: `pf-v6-c-*`, `pf-m-*`. PF class names change between minor versions. Use `data-test` attributes (add them to source if missing) or semantic ARIA role locators.
- No `li[role="none"]` structural selectors. Use `page.getByRole('menuitem', { name })` or `page.getByRole('option', { name })`.
- When porting a Cypress selector, ask: can Playwright do this with a semantic locator? If yes, upgrade — don't copy verbatim.

**Assertions — positive over negative lists**
- Never assert a value by listing what it should not be (`not.toEqual('undefined')`, `not.toEqual('unknown')`, etc.). Write a positive assertion: `toMatch(/^\d+\.\d+/)`, `toBeGreaterThan(3)`, etc.
- Negative lists don't catch new broken formats and document no intent.

**Dropdowns — open once, assert all, close once**
- Never open and close a dropdown in a loop per option. Open, assert all options visible, close. `expectAllValidationFilterOptions`-style loop (8 clicks for 4 options) is an anti-pattern.

**Auth strategy detection — API only, not `process.env`**
- Playwright worker processes do not share `process.env` written in the setup worker. Auth strategy must be detected via `getAuthStrategy(page)` (calls `/api/auth/info`) or baked into project-level config. Never set `process.env.KIALI_AUTH_STRATEGY` and read it in workers.
- `test.skip(strategy !== 'openshift', '...')` is correct for OCP-only scenarios. Auth-gated tests that cannot run should skip, not throw — hard throws abort the whole suite.

**Component readiness — DOM over fiber**
- Expose component loading state as `data-ready` DOM attributes. Test with `toBeVisible()` on an attribute selector. Do not walk React fiber internals via `page.evaluate()`. `expect.poll()` does not retry when the callback throws.

---

### Phase 0 — Infrastructure

- [x] `@playwright/test` ≥1.48 installed in `frontend/` (pin documented, e.g. v1.61.x)
- [x] `playwright.config.ts` with projects matching current CI frontend suites via `grep` tags:

```typescript
projects: [
  { name: 'smoke',                    grep: /@smoke/ },
  { name: 'core-1',                   grep: /@core-1/ },
  { name: 'core-2',                   grep: /@core-2/ },
  { name: 'core-caching',             grep: /@core-caching/ },
  { name: 'crd-validation',           grep: /@crd-validation/ },
  { name: 'perses',                   grep: /@perses/ },
  { name: 'ambient',                  grep: /@ambient/ },
  { name: 'waypoint',                 grep: /@waypoint/ },
  { name: 'waypoint-tracing',         grep: /@waypoint-tracing/ },
  { name: 'ambient-multi-primary',    grep: /@ambient-multi-primary/ },
  { name: 'waypoint-multicluster',    grep: /@waypoint-multicluster/ },
  { name: 'multi-cluster',            grep: /@multi-cluster/ },
  { name: 'multi-primary',            grep: /@multi-primary/ },
  { name: 'multi-mesh',               grep: /@multi-mesh/ },
  { name: 'external-kiali',           grep: /@external-kiali/ },
  { name: 'tracing',                  grep: /@tracing/ },
  { name: 'offline',                  grep: /@offline/ },
  { name: 'ai-chatbot',               grep: /@ai-chatbot/ },
]
```

Mapping to `hack/run-integration-tests.sh --test-suite` values that exercise frontend e2e:

| `--test-suite` | Playwright project(s) / tags |
|---|---|
| `local` | `smoke` (`@smoke`) |
| `frontend-core-1` | `core-1` (`@core-1`) |
| `frontend-core-2` | `core-2` (`@core-2`) |
| `frontend-core-caching` | `core-caching` (`@core-caching`) |
| `frontend-core-optional` | `crd-validation` + `perses` (`@crd-validation`, `@perses`) |
| `frontend` | `crd-validation` + `core-1` + `core-2` + `perses` + `core-caching` |
| `frontend-ambient` | `ambient` + `waypoint` + `waypoint-tracing` |
| `frontend-primary-remote` | `multi-cluster` (`@multi-cluster and not @multi-primary`) |
| `frontend-multi-primary` | `multi-primary` (and when ambient: `ambient-multi-primary` + `waypoint-multicluster`) |
| `frontend-multi-mesh` | `multi-mesh` (`@multi-mesh`) |
| `frontend-external-kiali` | `external-kiali` (`@external-kiali`) |
| `frontend-tempo` | `tracing` (`@tracing`) |
| `offline` | `offline` (`@offline`) |
| `ai-chatbot` | `ai-chatbot` (`@ai-chatbot`) |

- [x] `BasePage` with `getBySel()`, `waitForLoadingComplete()` / equivalent — **no** `robustClick` / `retryOnError` (PR #10174)
- [x] `auth.setup.ts` / `storageState` handles: `anonymous`, `openshift`. Unimplemented strategies (`token`, `openid`) fail gracefully via `expect().toContain()`. (PR #10174, #10217)
- [ ] `cleanup` fixture established (replaces `@clean-istio-namespace-resources-after`-style hooks)
- [x] Shared utils ported: navigation, table, `linkSelector`, transition, namespace, suite-tags (PR #10174, #10195, #10217)
- [x] JUnit reporter configured (built-in Playwright reporter — no Cypress multi-reporter stack) (PR #10174)
- [x] `yarn playwright:run:smoke` passes headless (PR #10174)
- [ ] Playwright MCP (`@playwright/mcp`) produces a valid `browser_snapshot` of the Kiali UI
- [ ] Kiali-specific migration skill added (adapted from [openshift/console#16315](https://github.com/openshift/console/pull/16315)): auth strategies, graph WebSocket mocking, OSSMC proxy patterns, vendored-code boundary
- [ ] At least one smoke path verified OSSMC-safe: `linkSelector()` + `**/api/**` route patterns

### Migration completeness

- [ ] All existing Cypress Gherkin scenarios migrated to Playwright `.spec.ts` + Page Object Models under `frontend/e2e/`
- [ ] `page.routeWebSocket()` used alongside `page.route()` wherever graph/watch APIs are mocked
- [ ] React fiber usages (`getReact` / `waitForReact` / `getCurrentState` / `getProps`) replaced with `data-test` or DOM assertions (no residual Cypress React helpers). Graph topology fiber reads remain with TODO (PR #10220).
- [x] `@smoke` suite passes (~32 scenarios, PR #10174)
- [x] `@core-1` suite passes (145 tests, PR #10195 + #10220)
- [ ] `@core-2` suite passes
- [ ] `@core-caching` suite passes
- [ ] `@crd-validation` suite passes
- [ ] `@perses` suite passes
- [ ] `@ambient` suite passes
- [ ] `@waypoint` suite passes
- [ ] `@waypoint-tracing` suite passes
- [ ] `@ambient-multi-primary` suite passes
- [ ] `@waypoint-multicluster` suite passes
- [ ] `@multi-cluster` suite passes
- [ ] `@multi-primary` suite passes
- [ ] `@multi-mesh` suite passes
- [ ] `@external-kiali` suite passes
- [ ] `@tracing` suite passes
- [ ] `@offline` suite passes
- [ ] `@ai-chatbot` suite passes

### CI / pipelines

- [x] During migration: Playwright runs **alongside** Cypress in GitHub Actions for migrated suites (coexistence) (PR #10195 — `integration-tests-frontend-playwright-core-1.yml`)
- [x] `hack/run-integration-tests.sh` updated for `playwright-smoke` and `playwright-core-1` suites (PR #10174, #10195, #10220)
- [ ] `hack/run-integration-tests.sh` updated for all remaining Playwright projects
- [x] GitHub Actions workflows updated for Playwright (JUnit artifacts, screenshots/traces on failure) (PR #10174, #10220)
- [ ] Jenkins / private nightly pipelines updated and green for Playwright suites before Cypress removal
- [ ] Cutover gate: **2+ consecutive all-green** Playwright runs covering all suites before Cypress is removed

### OSSMC

- [ ] `hack/copy-frontend-src-to-ossmc.sh` updated to sync Playwright e2e (and stop syncing Cypress once cut over)
- [ ] OSSMC-specific tests migrated (`sidebar_navigation`, any non-vendored support: visit/request rewriting, Console login, guided tour)
- [ ] OSSMC plugin mode verified: Console proxy API paths + `linkSelector` (kiosk `<button data-href>`) work under Playwright
- [ ] OSSMC Cypress test image / Dockerfile updated or replaced for Playwright

### Cutover & docs

- [ ] Cypress and all Cypress-specific `devDependencies` removed from `frontend/package.json` (and OSSMC `plugin/package.json`)
- [ ] Cypress configs, support, feature files, and Cucumber preprocessor config removed
- [ ] `.mcp.json` / `AGENTS.md`: Playwright MCP debugging guidance replaces `CYPRESS_REMOTE_DEBUGGING_PORT=9222` Cypress CDP section
- [ ] Zero Cypress e2e references remaining in Kiali and OSSMC codebases (perf suite migrated or explicitly deferred with follow-up issue)
- [ ] LTS/supported-branch backport strategy executed or explicitly deferred with a tracked follow-up

### Open questions

- **Graph topology DOM hooks:** PR #10220 uses `page.evaluate()` to walk React's fiber tree for graph topology assertions. A TODO marks this for migration to DOM/`data-test`. What `data-test` attributes or DOM hooks should graph components expose? (raised by hhovsepy, acknowledged by jshaughn)

### Action items

Follow-up work identified during Phase 0–1 PRs. See [`frontend/e2e/README.md`](./frontend/e2e/README.md) for full conventions and gotchas.

- [ ] Replace remaining React fiber reads in `graphTopology.ts` with `data-test` / DOM attributes (PR #10220 TODO)
- [ ] Implement `token` and `openid` auth strategies in `auth.setup.ts` (PR #10174 / #10217)
- [ ] Create `cleanup` fixture (`cleanup.trackNamespace()`) for demo mutation teardown (PR #10195 pattern)
- [ ] Create dedicated PR to `master` for StatefulFilters ESLint cleanup — 19 pre-existing violations deferred from PR #10217
- [ ] Port `@core-2`, ambient/multi-cluster, OSSMC suites (PR #10220 — deferred)
- [ ] Add `page.routeWebSocket()` where graph live updates are mocked (from `frontend/e2e/README.md` follow-ups)
- [ ] Verify TextInputGroupMain `data-test` scoping — PF renders `data-test` on outer `<div>`, not inner `<input>`; assess if PF should be patched or if `getByTestId().locator('input')` is sufficient (PR #10217)
- [ ] Add `data-test` on `StatefulFilters` overflow button area — verify `collapsedTextProps` in PF6 LabelGroup (PR #10174 review)
