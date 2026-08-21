# Playwright e2e — Migration Guide & Tracking

Single source of truth for the Cypress → Playwright migration ([#9712](https://github.com/kiali/kiali/issues/9712)).
Covers conventions, architecture, gotchas, tracking checklists, and lessons from Phase 0–2 (PRs [#10174](https://github.com/kiali/kiali/pull/10174), [#10195](https://github.com/kiali/kiali/pull/10195), [#10217](https://github.com/kiali/kiali/pull/10217), [#10220](https://github.com/kiali/kiali/pull/10220)).

---

## Quick reference

- Native Playwright Test (not `playwright-bdd`)
- Suite tags: `e2e/utils/suite-tags.ts` (`smokeAndCoreCaching`, `core1`, …) — use Playwright's native `tag` option, not tags in titles
- `testIdAttribute: 'data-test'` in `playwright.config.ts`
- Timeouts: `actionTimeout: 40_000`, `expect.timeout: 40_000`, `test timeout: 60_000`, `navigationTimeout: 90_000`
- CI: `retries: 1`, `workers: 2` (avoids OOM on Jenkins shared runners)
- Auth: `storageState` from `e2e/global-setup/auth.setup.ts`; strategy via `getAuthStrategy(page)` (`/api/auth/info`)
- Page objects extend `BasePage` (`getBySel`, `waitForLoad`) — no custom click/retry helpers
- List pages extend `ListPage` (shared filters, columns) — `AppsPage`, `ServicesPage`, `WorkloadsPage`
- OSSMC: `page.route('**/api/...')`, `linkSelector()` for kiosk `<button data-href>`
- List pages with toggles: `gotoListPage()` rewrites `/api/config` `showIncludeToggles`
- Demo app setup: `ensureDemoApp('bookinfo')` etc. in `demoApps.ts` — mirrors Cypress `@bookinfo-app` hooks

---

## Decisions & tracking

- [x] Decision documented: **Native Playwright Test** (not `playwright-bdd`) — self-contained `.spec.ts` + Page Object Models; no third-party Gherkin dependency. (PR #10174)
- [x] React fiber policy documented: prefer `data-test` / DOM assertions; no new `page.evaluate()` fiber walking without a TODO. `data-ready` DOM attribute demonstrated on MiniGraphCard. (PR #10217, PR #10220)
- [ ] CI strategy documented: **coexistence on `master` first**; LTS/supported branches after master cutover
- [ ] Private pipelines (Jenkins) included in cutover acceptance — not GitHub Actions only
- [ ] Epic broken into sub-issues (Phase 0 spike, migration skill, smoke, core-1, core-2, specialized, OSSMC, Jenkins, Cypress removal)
- [x] Suite tags: use Playwright's native `tag` option via centralized exports in `e2e/utils/suite-tags.ts`, not title-only strings. Non-project conditions (e.g. `@prometheus-disabled`) use the `annotation` API. (PR #10174 review, PR #10195, PR #10217)
- [x] Test-migration PR scope: only `data-test` attributes and `aria-label` additions in source code. No ESLint fixes, refactors, or production behavioral changes — those go to dedicated PRs targeting `master`. (PR #10217 — StatefulFilters revert)
- [x] Auth setup failure handling: write empty `storageState` then fail via `expect().toContain()`, not `throw`. Hard throws produce zero JUnit output; `expect` produces 1 FAILED + 18 SKIPPED. (PR #10217)
- [x] `playwright:run:last-failed` removed — `--last-failed` overwrites `blob-report/` and produces misleading Jenkins failure counts. CI reports reflect the full first pass only. (PR #10195)

---

## Migration conventions (required)

These rules come from the [#9712](https://github.com/kiali/kiali/issues/9712) plan and review feedback on PRs #10174 and #10217. Do not re-introduce Cypress patterns when porting.

### Playwright mechanics — trust auto-wait

- **No `page.waitForTimeout()`** — Playwright auto-waits on every action (`actionTimeout: 40_000` in config).
- **No `robustClick` / `retryOnError` / manual click loops** — `locator.click()` already retries for actionability (visible, stable, not covered). If a PF overlay blocks the target, wait for it to disappear: `await expect(overlay).not.toBeVisible()` then click.
- **No stale-element retries** — Playwright locators re-query the DOM; Cypress-style retry loops add latency and hide real errors.
- Prefer **web-first assertions** (`await expect(locator).…`) over `innerText()` + raw `expect()`.

**Do this:**
```typescript
await this.getBySel('about-help-button').click();
```

**Not this:**
```typescript
async robustClick(locator: Locator, maxAttempts = 3): Promise<void> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      await locator.click({ timeout: 5_000 });
      return;
    } catch {
      attempts++;
      await this.page.waitForTimeout(250);
    }
  }
  throw new Error('robustClick failed');
}
```

**Why:** `waitForTimeout(250)` is a hard pause even when the element is ready. The outer `catch` swallows the real error and replaces it with `robustClick failed`. This was copied from openshift/console's PF5 migration and does not transfer — Playwright locators re-query the DOM on every action, so stale references don't exist.

### Selectors — upgrade when porting, do not copy Cypress verbatim

| Avoid | Use instead |
|-------|-------------|
| `li[role="none"]`, structural PF nodes | `getByRole('menuitem', { name })`, `getByRole('option', { name, exact: true })` |
| `#foo > :nth-child(n)`, positional indices | `getByRole`, `getByTestId`, or add `data-test` in source |
| PF classes (`pf-v6-c-*`, `pf-m-*`) for interaction | `data-test` or ARIA roles (classes change across PF versions) |
| `input[placeholder="…"]` | `getByTestId` on the input (placeholders break under i18n) |
| `h1.pf-v6-c-modal-box__title` | `getByRole('heading', { name, level: 1 })` |
| `input[type="checkbox"][value="…"]` | `getByRole('checkbox', { name, exact: true })` scoped to container |

**Do this:**
```typescript
await this.page.getByRole('menuitem', { name: 'About' }).click();
await expect(this.page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
```

**Not this:**
```typescript
await this.page.locator('li[role="none"]').filter({hasText: 'About'}).click();
await expect(this.page.locator('h1.pf-v6-c-modal-box__title')).toBeVisible();
```

**Why:** PF class names change between minor versions (`pf-v5-*` → `pf-v6-*`). `role="none"` is a PF presentation node, not a semantic role. Playwright has `getByRole`, `getByTestId`, and semantic ARIA locators that are stable.

**OSSMC:** `linkSelector()` matches standalone `<a href>` and kiosk `<button data-href>`.

**Namespace dropdown:** `getByRole('checkbox', { name: namespace, exact: true })` scoped to `namespace-dropdown-list` — requires `aria-label={namespace.name}` on the source checkbox (added in PR #10217). Without `aria-label`, PF renders the name in a sibling `<span>`, not a `<label>`.

### Filters and dropdowns

- **Exact option names** — e.g. `Present` vs `Not Present`, `Valid` vs `Not Validated` (`exact: true` on `getByRole('option')`).
- **Open once, assert all, close once** — do not loop open/close per option (Cypress `optionCheck` anti-pattern).
- **Apply filters by name**, not by nth-child index in dropdown lists.
- **LabelGroup overflow:** PF renders the overflow button with text `"${n} more"` (not `"+N"`). Use `getByRole('button', { name: /\d+ more/ })` — not PF classes (`pf-v6-c-label.pf-m-overflow`) or wrong regex (`/^\+/`).

**Do this:**
```typescript
async expectAllValidationFilterOptions(): Promise<void> {
  await this.page.getByTestId('filter-value-toggle').click();
  for (const name of VALIDATION_FILTERS) {
    await expect(this.filterOption(name)).toBeVisible();
  }
  await this.page.getByTestId('filter-value-toggle').click();
}
```

### Assertions — positive over negative lists

- Do not assert validity by listing what a value is **not** (`not.toEqual('unknown')`, `not.toContainText('undefined')`, etc.).
- Use **positive** checks: `toHaveText(/^v?\d+\.\d+\.\d+/)` for semver fields, `toMatch(…)` for structured text, `toBeGreaterThan(n)` for counts.

**Do this:**
```typescript
await expect(kialiVersion).toHaveText(/^v?\d+\.\d+\.\d+/);
```

**Not this:**
```typescript
await expect(kialiVersion).not.toBeEmpty();
await expect(kialiVersion).not.toContainText('undefined');
const versionText = (await kialiVersion.innerText()).trim();
expect(versionText).not.toEqual('');
expect(versionText).not.toEqual('unknown');
expect(versionText).not.toEqual('null');
expect(versionText.length).toBeGreaterThan(0);
```

**Why:** Negative lists pass on any garbage not in the list and document no intent. `innerText()` + raw `expect()` loses Playwright's auto-retry. One positive regex replaces seven negative checks.

### Suite tags and projects

- Put suite membership in the Playwright **`tag` option** via exports in `e2e/utils/suite-tags.ts` (e.g. `test('…', core1, async () => { … })`).
- **Do not** embed `@smoke` / `@core-1` only in the title string — reports stay clean and tags stay typed.
- A tag in the title with **no matching project `grep`** is a no-op — use the `annotation` API for cluster preconditions (e.g. "Prometheus disabled"), not a fake `@prometheus-disabled` title tag.
- Run suites with **`--project=`** / `yarn playwright:run:smoke` / `yarn playwright:run:core1`. If using `PLAYWRIGHT_GREP` (Jenkins `TEST_TAGS`), run auth setup first — `authenticate` has no suite tag. `yarn playwright:run:test-group:junit` handles that.

**Do this:**
```typescript
import { core1 } from '../../utils/suite-tags';
test('Apps list shows bookinfo apps', core1, async ({ page }) => { ... });
```

**Not this:**
```typescript
test('Apps list shows bookinfo apps @core-1', async ({ page }) => { ... });
```

### Auth

- **Never** rely on `process.env` set in the setup worker — workers are separate Node.js processes and do not inherit it. Use `getAuthStrategy(page)` or `request.get('/api/auth/info')`.
- **OpenShift-only** login/logout/cookie/session tests: `test.skip(strategy !== 'openshift', '…')` on KinD/Jenkins anonymous CI — **skip**, do not fail the suite.
- **Logout** must use `test.use({ storageState: { cookies: [], origins: [] } })` so `/api/logout` does not invalidate `AUTH_FILE` for later projects.
- **Unimplemented strategies** (`token`, `openid`): write empty `storageState` first, then fail via `expect(implemented).toContain(strategy)`. Hard `throw` crashes the setup project — JUnit emits nothing, Jenkins sees an empty report instead of 1 FAILED + 18 SKIPPED.

### Health indicators in tables

Cypress hovers the first-column icon and checks tooltip text. Playwright equivalent:

1. Hover **`row.locator('td[data-label="Health"] .pf-v6-c-icon__content')`** (PF6 does not put `aria-label` on a row descendant for the trigger).
2. Assert **`await expect(page.getByRole('tooltip')).toContainText(healthStatus)`** — not `tooltip.locator('strong')` alone: failure/degraded tooltips include multiple `<strong>` nodes (status + traffic legend).
3. Bulk "all healthy" checks: scope to `tbody td[data-label="Health"]`, not unscoped icons.
4. Retry via refresh + `waitForLoadingComplete`, not long hover timeouts only.

### Sidebar

Use `isVisible()` / `isHidden()` for toggle guards — same semantics as `toBeVisible()` — not `aria-hidden` alone (can diverge from CSS visibility during PF transitions).

**Do this:**
```typescript
async ensureSidebarOpen(): Promise<void> {
  await this.waitForLoad();
  if (await this.sidebar.isHidden()) {
    await this.navToggle.click();
  }
  await expect(this.sidebar).toBeVisible();
}
```

### Component readiness — data-ready DOM attribute, not fiber walks

Expose component loading state as a `data-ready` DOM attribute. Test with a single `toBeVisible()` locator. Do not walk React fiber internals via `page.evaluate()`.

**Do this:**
```tsx
// Source: MiniGraphCard.tsx
<Card id="MiniGraphCard" data-ready={!isLoading && this.state.isReady}>
```
```typescript
// Test: graphTopology.ts
await expect(page.locator('#MiniGraphCard[data-ready="true"]')).toBeVisible();
```

**Not this:**
```typescript
await expect.poll(async () => {
  const topology = await readMiniGraphTopology(page); // walks React fiber tree
  return topology.nodes.length;
}).toBeGreaterThan(0);
```

**Why:** `expect.poll()` does not retry when the callback throws — it propagates immediately. Fiber internals break on React version changes. The DOM itself is the source of truth.

### Test-migration PRs — only additive data-test changes

Test-migration PRs may add `data-test` attributes and `aria-label` to source components. They must NOT include ESLint fixes, refactors, key changes, or any production behavioral change. Those go to dedicated PRs targeting `master`. See [Reverted approaches](#reverted-approaches) for the StatefulFilters lesson.

### CI and Jenkins

- **Do not run `playwright test --last-failed` before merge-reports** — the rerun overwrites `blob-report/` and Jenkins `combined-report.xml` only lists rerun tests (misleading failure counts).
- GitHub **Playwright CI**: separate parallel jobs for smoke and core-1 (each with its own KinD cluster). Jenkins default `playwright:run:all` runs smoke + core-1 in one invocation.
- **JUnit**: Playwright may record timeouts as `errors` not `failures` — check both in XML.
- Local `kiali run --port-forward-grafana` without `external_services.grafana` in config: **WARN** on `/api/status` (`grafana URL is not set`) is expected and does not fail tests.

### PR slicing (incremental migration)

- Port **one feature area** (or one `.feature` file's tag scope) per PR; state deferred tags in the PR body (e.g. `@multi-cluster` / `@core-caching` apps scenarios left in Cypress until their phase).
- Coexistence: Cypress stays until cutover gate (2+ green full Playwright runs on all suites).

---

## Architecture

### Project structure

```
frontend/e2e/
├── fixtures/kialiFixtures.ts     # Playwright fixtures extending base test
├── global-setup/auth.setup.ts    # Auth setup (anonymous / openshift)
├── pages/                        # Page Object Models
│   ├── BasePage.ts               # getBySel, waitForLoad, expectVisible
│   ├── ListPage.ts               # Shared list page (filters, columns, toggles)
│   ├── AppDetailsPage.ts         # App detail view, mini-graph readiness
│   ├── AppsPage.ts               # Apps list, health tooltips (extends ListPage)
│   ├── GraphPage.ts              # Graph display, toolbar, side panel
│   ├── IstioConfigPage.ts        # Filters (type, validation), list
│   ├── MeshPage.ts               # Mesh graph API assertions
│   ├── OverviewPage.ts           # Help menu, about modal, alerts
│   ├── ServicesPage.ts           # Service list toggles (extends ListPage)
│   ├── SidebarPage.ts            # Navigation toggle
│   └── WorkloadsPage.ts          # Workloads list (extends ListPage)
├── tests/                        # Spec files organized by feature
│   ├── apps/                     # Apps list, health, app details graph
│   ├── column_management/        # Column management (shared across list pages)
│   ├── graph/                    # Display, toolbar, legend, find/hide, context menu, side panel, replay
│   ├── istio_config/             # Type filters, validation filters, list
│   ├── kiali/                    # About, alert, cookie, help, login, logout, sidebar
│   ├── mesh/                     # Mesh connectivity
│   └── services/                 # Service toggles
└── utils/                        # Shared utilities
    ├── suite-tags.ts             # Centralized tag exports (smokeAndCoreCaching, core1, smokeOnly, etc.)
    ├── auth.ts                   # AUTH_FILE path constant
    ├── auth-strategy.ts          # getAuthStrategy(page) — /api/auth/info
    ├── openshift-auth.ts         # OpenShift login helpers (playwrightCredentials, loginOpenShift)
    ├── ambientValidation.ts      # Ambient L7 validation codes (KIA0109, KIA0110, …)
    ├── cluster.ts                # getClusterForSingleCluster (via /api/config)
    ├── demoApps.ts               # ensureDemoApp — install/verify bookinfo, error-rates, sleep, loggers
    ├── graphSelect.ts            # Graph topology node/edge selectors (select, selectAnd, selectOr)
    ├── graphTopology.ts          # React fiber graph reads + data-ready (expectMiniGraphReady)
    ├── health.ts                 # waitForAppHealthStatus (API polling)
    ├── inferenceApi.ts           # Inference API CRD helpers (install, apply InferencePool)
    ├── kubectl.ts                # kubectl shell helpers (namespaceExists, scale)
    ├── linkSelector.ts           # OSSMC-safe link matching
    ├── namespace.ts              # Namespace dropdown selection
    ├── navigation.ts             # gotoConsolePage, gotoListPage (config rewrite)
    ├── table.ts                  # Column assertions
    └── transition.ts             # waitForLoadingComplete
```

### Suite tags → projects → CI mapping

Projects in `playwright.config.ts` (note the negative lookaheads/lookbehinds to disambiguate overlapping tags):

```typescript
projects: [
  { name: 'setup',                    testMatch: /auth\.setup\.ts/ },  // auth setup — no tag
  { name: 'smoke',                    grep: /@smoke/ },
  { name: 'core-1',                   grep: /@core-1/ },
  { name: 'core-2',                   grep: /@core-2/ },
  { name: 'core-caching',             grep: /@core-caching/ },
  { name: 'crd-validation',           grep: /@crd-validation/ },
  { name: 'perses',                   grep: /@perses/ },
  { name: 'ambient',                  grep: /@ambient(?!-)/ },          // excludes @ambient-multi-primary
  { name: 'waypoint',                 grep: /@waypoint(?!-)/ },         // excludes @waypoint-tracing, @waypoint-multicluster
  { name: 'waypoint-tracing',         grep: /@waypoint-tracing/ },
  { name: 'ambient-multi-primary',    grep: /@ambient-multi-primary/ },
  { name: 'waypoint-multicluster',    grep: /@waypoint-multicluster/ },
  { name: 'multi-cluster',            grep: /@multi-cluster/ },
  { name: 'multi-primary',            grep: /@multi-primary/ },
  { name: 'multi-mesh',              grep: /@multi-mesh/ },
  { name: 'external-kiali',           grep: /@external-kiali/ },
  { name: 'tracing',                  grep: /(?<!waypoint-)@tracing/ }, // excludes @waypoint-tracing
  { name: 'offline',                  grep: /@offline/ },
  { name: 'ai-chatbot',              grep: /@ai-chatbot/ },
]
```

Available tag exports in `e2e/utils/suite-tags.ts`:

| Export | Tags | Use for |
|---|---|---|
| `smokeAndCoreCaching` | `@smoke`, `@core-caching` | Tests in both smoke and core-caching suites |
| `smokeOnly` | `@smoke` | Smoke-only tests |
| `coreCachingOnly` | `@core-caching` | Core-caching-only tests |
| `core1` | `@core-1` | Core-1 suite |
| `smokeAndPrometheusDisabled` | `@smoke`, `@prometheus-disabled` | Smoke tests that also annotate Prometheus-disabled |

Add new exports here as suites are ported (e.g. `core2`, `ambient`, `multiCluster`).

Mapping to `hack/run-integration-tests.sh --test-suite` values:

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

### StatefulFilters data-test attributes

`StatefulFilters.tsx` exposes the following `data-test` attributes for stable POM selectors:

| Attribute | Component | Purpose |
|---|---|---|
| `filter-toolbar` | `<Toolbar>` | Filter selection container |
| `filter-type-toggle` | `<MenuToggle>` | Filter type dropdown toggle |
| `filter-type-select` | `<Select>` | Filter type dropdown |
| `filter-value-toggle` | `<MenuToggle>` (3 branches) | Filter value dropdown toggle |
| `filter-value-select` | `<Select>` (3 branches) | Filter value dropdown |
| `filter-type-input` | `<TextInputGroupMain>` | Typeahead filter input (note: renders on outer `<div>`, scope to child `input` for `fill()`) |

### MiniGraphCard data-ready attribute

`MiniGraphCard.tsx` exposes `data-ready={!isLoading && isReady}` on the root `<Card>` element. Tests check readiness with `page.locator('#MiniGraphCard[data-ready="true"]')` instead of polling React fiber state.

---

## Phase tracking

### Phase 0 — Infrastructure

- [x] `@playwright/test` ≥1.48 installed in `frontend/` (pin documented, e.g. v1.61.x)
- [x] `playwright.config.ts` with projects matching CI suites via `grep` tags (see [Suite tags → projects → CI mapping](#suite-tags--projects--ci-mapping))
- [x] `BasePage` with `getBySel()`, `waitForLoad` — **no** `robustClick` / `retryOnError` (PR #10174)
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

---

## Gotchas

- **TextInputGroupMain `data-test` renders on outer `<div>`, not inner `<input>`** — Playwright's `fill()` rejects a `<div>`. Scope to the child input: `page.getByTestId('filter-type-input').locator('input')`. (PR #10217)
- **Version strings may start with `v`** — Kiali emits `"v2.31.0-SNAPSHOT (...)"`. Use `/^v?\d+\.\d+\.\d+/`, not `/^\d+\.\d+\.\d+/`. (PR #10217)
- **PF LabelGroup overflow text has no `+` prefix** — Default `collapsedText` is `"${remaining} more"` (e.g. `"1 more"`), not `"+1"`. Use `/\d+ more/`, not `/^\+/`. (PR #10174 → #10217)
- **`expect.poll()` does not retry on throw** — When the callback throws (e.g. React component not ready), the poll propagates immediately. Wrap in try/catch or use DOM attributes. (PR #10217)
- **`--last-failed` overwrites blob reports** — `blob-report/` gets overwritten; Jenkins XML only lists rerun tests. The `playwright:run:last-failed` script was removed. (PR #10195)
- **Auth setup `throw` produces zero JUnit** — Hard throws crash the setup project. Jenkins sees an empty report instead of 1 FAILED + 18 SKIPPED. Use `expect().toContain()` after writing empty `storageState`. (PR #10217)
- **Namespace dropdown `getByRole('checkbox')` needs `aria-label`** — PF renders the name in a sibling `<span>`, not a `<label>`. Without `aria-label` on the checkbox, Playwright's role query may not match. Scope to `namespace-dropdown-list` with `exact: true`. (PR #10217)
- **Graph topology still uses React fiber reads** — `graphTopology.ts` walks React internals via `page.evaluate()`. Acknowledged as temporary (TODO in PR #10220). MiniGraphCard has been migrated to `data-ready`; the main graph's fiber reads remain.

---

## Reverted approaches

### StatefulFilters.tsx behavioral changes in test-migration PR

PR #10217 commit `e754190` made three behavioral changes alongside `data-test` additions:
1. Split value imports to `import type` (ESLint `consistent-type-imports`)
2. Rewrote `renderChildren` using `React.Children.toArray` + `element.key`
3. Changed toggle keys from array index to `t.name`

All three were reverted in `fd9479e` after review flagged them as production risks:
- `import type` splitting can silently make values `undefined` at runtime
- `React.Children.toArray()` flattens arrays, removes falsy children, reassigns keys — different from the original `Array.isArray` + falsy guard
- Index→name keys cause full unmount/remount when toggle list order changes

Both reviewers agreed: "revert all changes on code behavioral scope, and leave those additions of 'data-test' ones." ESLint cleanup deferred to a dedicated PR targeting `master`.

---

## Current coverage

### Smoke (`yarn playwright:run:smoke`)

Ports all Cypress `@smoke` scenarios: about, alert, cookie, help, login, logout, sidebar, services toggles, graph prometheus-disabled, mesh local-kiali, istio config type + validation filters. On anonymous CI, **6 scenarios skip** (OpenShift login/cookie/logout/session).

### Core-1 (`yarn playwright:run:core1`)

Ports all Cypress `@core-1` scenarios (145 tests): graph display, graph toolbar, graph legend, graph find/hide, graph context menu, graph side panel, graph replay, istio config list, apps list, app details graph, column management.

## Local run

Kiali UI at `http://localhost:3001` (override with `PLAYWRIGHT_BASE_URL`):

```bash
cd frontend
yarn playwright:install chromium   # once, after yarn install
yarn playwright:run:smoke
yarn playwright:run:core1
yarn playwright:run:smoke --headed
yarn playwright:ui --project=smoke
```

Use `yarn playwright:install` — not `yarn playwright install`.

## CI

PRs targeting `epic/playwright-migration` run **Playwright CI** (`.github/workflows/playwright-ci.yml`): build + parallel `playwright-smoke` and `playwright-core-1` integration suites (`hack/run-integration-tests.sh`).

Jenkins: `kiali/test-jobs/kiali-playwright-tests` — prefer `TEST_SET=playwright:run:smoke` or `playwright:run:all` with empty `TEST_TAGS` on OpenShift; use `playwright:run:core1` equivalent via `run:all` or future dedicated script.

---

## Open questions

- **Graph topology DOM hooks:** PR #10220 uses `page.evaluate()` to walk React's fiber tree for graph topology assertions. A TODO marks this for migration to DOM/`data-test`. What `data-test` attributes or DOM hooks should graph components expose? (raised by hhovsepy, acknowledged by jshaughn)

---

## Action items

- [ ] Replace remaining React fiber reads in `graphTopology.ts` with `data-test` / DOM attributes (PR #10220 TODO)
- [ ] Implement `token` and `openid` auth strategies in `auth.setup.ts` (PR #10174 / #10217)
- [ ] Create `cleanup` fixture (`cleanup.trackNamespace()`) for demo mutation teardown (PR #10195 pattern)
- [ ] Create dedicated PR to `master` for StatefulFilters ESLint cleanup — 19 pre-existing violations deferred from PR #10217
- [ ] Port `@core-2`, ambient/multi-cluster, OSSMC suites (PR #10220 — deferred)
- [ ] Add `page.routeWebSocket()` where graph live updates are mocked
- [ ] Verify TextInputGroupMain `data-test` scoping — PF renders `data-test` on outer `<div>`, not inner `<input>`; assess if PF should be patched or if `getByTestId().locator('input')` is sufficient (PR #10217)
- [ ] Add `data-test` on `StatefulFilters` overflow button area — verify `collapsedTextProps` in PF6 LabelGroup (PR #10174 review)
- [ ] OSSMC Playwright sync and Cypress cutover ([#9712](https://github.com/kiali/kiali/issues/9712) later phases)
