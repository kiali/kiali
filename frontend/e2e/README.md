# Playwright e2e

Living guide for the Cypress → Playwright migration ([#9712](https://github.com/kiali/kiali/issues/9712)).

> **Companion files (temporary):** Detailed porting conventions live in [`AGENTS.md`](AGENTS.md);
> progress tracking and checklists in [`MIGRATION-PLAN.md`](MIGRATION-PLAN.md). Both are deleted
> before merging to `master`.

## Quick reference

- Native Playwright Test (not `playwright-bdd`)
- Suite tags: `e2e/utils/suite-tags.ts` (`smokeAndCoreCaching`, `core1`, …) — use Playwright's native `tag` option, not tags in titles
- `testIdAttribute: 'data-test'` in `playwright.config.ts`
- Auth: `storageState` from `e2e/global-setup/auth.setup.ts`; strategy via `getAuthStrategy(page)` (`/api/auth/info`)
- Page objects extend `BasePage` (`getBySel`, `waitForLoad`) — no custom click/retry helpers
- OSSMC: `page.route('**/api/...')`, `linkSelector()` for kiosk `<button data-href>`
- List pages with toggles: `gotoListPage()` rewrites `/api/config` `showIncludeToggles`

---

## Migration conventions (required)

These rules come from the [#9712](https://github.com/kiali/kiali/issues/9712) plan and review feedback on PRs #10174, #10195, #10217, #10220. Do not re-introduce Cypress patterns when porting.

### Playwright mechanics — trust auto-wait

- **No `page.waitForTimeout()`** — Playwright auto-waits on every action (`actionTimeout: 40_000` in config).
- **No `robustClick` / `retryOnError` / manual click loops** — `locator.click()` already retries for actionability (visible, stable, not covered). If a PF overlay blocks the target, wait for it to disappear: `await expect(overlay).not.toBeVisible()` then click.
- **No stale-element retries** — Playwright locators re-query the DOM; Cypress-style retry loops add latency and hide real errors.
- Prefer **web-first assertions** (`await expect(locator).…`) over `innerText()` + raw `expect()`.

### Selectors — upgrade when porting, do not copy Cypress verbatim

| Avoid | Use instead |
|-------|-------------|
| `li[role="none"]`, structural PF nodes | `getByRole('menuitem', { name })`, `getByRole('option', { name, exact: true })` |
| `#foo > :nth-child(n)`, positional indices | `getByRole`, `getByTestId`, or add `data-test` in source |
| PF classes (`pf-v6-c-*`, `pf-m-*`) for interaction | `data-test` or ARIA roles (classes change across PF versions) |
| `input[placeholder="…"]` | `getByTestId` on the input (placeholders break under i18n) |
| Bare `#filter_select_value` long term | Prefer `data-test` on `StatefulFilters` (see follow-ups below) |

**OSSMC:** `linkSelector()` matches standalone `<a href>` and kiosk `<button data-href>`.

**Namespace dropdown:** `getByRole('checkbox', { name: namespace })` instead of `input[value=…]`.

**Modals:** `getByRole('heading', { name, level: 1 })` instead of `h1.pf-v6-c-modal-box__title`.

### Filters and dropdowns

- **Exact option names** — e.g. `Present` vs `Not Present`, `Valid` vs `Not Validated` (`exact: true` on `getByRole('option')`).
- **Open once, assert all, close once** — do not loop open/close per option (Cypress `optionCheck` anti-pattern).
- **Apply filters by name**, not by nth-child index in dropdown lists.
- **LabelGroup overflow:** PF renders overflow text as `"${n} more"` (no `+` prefix). Use `filterSelection().getByRole('button', { name: /\d+ more/ })` — not PF overflow classes.

### Assertions — positive over negative lists

- Do not assert validity by listing what a value is **not** (`not.toEqual('unknown')`, `not.toContainText('undefined')`, etc.).
- Use **positive** checks: `toHaveText(/^v?\d+\.\d+\.\d+/)` for semver fields, `toMatch(…)` for structured text, `toBeGreaterThan(n)` for counts.

### Suite tags and projects

- Put suite membership in the Playwright **`tag` option** via exports in `e2e/utils/suite-tags.ts` (e.g. `test('…', core1, async () => { … })`).
- **Do not** embed `@smoke` / `@core-1` only in the title string — reports stay clean and tags stay typed.
- A tag in the title with **no matching project `grep`** is a no-op (e.g. use `annotation` for cluster preconditions like "Prometheus disabled", not a fake `@prometheus-disabled` project tag).
- Run suites with **`--project=`** / `yarn playwright:run:smoke` / `yarn playwright:run:core1`. If using `PLAYWRIGHT_GREP` (Jenkins `TEST_TAGS`), run auth setup first — `authenticate` has no suite tag. `yarn playwright:run:test-group:junit` handles that.

### Auth

- **Never** rely on `process.env` set in the setup worker — workers do not inherit it. Use `getAuthStrategy(page)` or `request.get('/api/auth/info')`.
- **OpenShift-only** login/logout/cookie/session tests: `test.skip(strategy !== 'openshift', '…')` on KinD/Jenkins anonymous CI — **skip**, do not fail the suite.
- **Logout** must use `test.use({ storageState: { cookies: [], origins: [] } })` so `/api/logout` does not invalidate `AUTH_FILE` for later projects.
- Unimplemented strategies (`token`, `openid`): prefer failing setup with JUnit output (empty `storageState` + `expect(implemented).toContain(strategy)`) over a bare `throw` that skips all projects with no report.

### Health indicators in tables

Cypress hovers the first-column icon and checks tooltip text. Playwright equivalent:

1. Hover **`row.locator('td[data-label="Health"] .pf-v6-c-icon__content')`** (PF6 does not put `aria-label` on a row descendant for the trigger).
2. Assert **`await expect(page.getByRole('tooltip')).toContainText(healthStatus)`** — not `tooltip.locator('strong')` alone: failure/degraded tooltips include multiple `<strong>` nodes (status + traffic legend).
3. Bulk "all healthy" checks: scope to `tbody td[data-label="Health"]`, not unscoped icons.
4. Retry via refresh + `waitForLoadingComplete`, not long hover timeouts only.

### Sidebar

Use `isVisible()` / `isHidden()` for toggle guards — same semantics as `toBeVisible()` — not `aria-hidden` alone (can diverge from CSS visibility during PF transitions).

### CI and Jenkins

- **GitHub** (`playwright-smoke`, `playwright-core-1`, `playwright-core-2`, `playwright-core-caching`, `playwright-core-optional`): KinD cluster + local `kiali` binary. Smoke/core-1/core-2/core-optional use `hack/ci-yaml/ci-test-config-no-cache.yaml`; **core-caching** uses `ci-test-config-cache.yaml` (graph + health cache enabled) and installs **bookinfo only** before Kiali starts. **core-optional** installs bookinfo + sleep + Perses (same cluster setup as Cypress `frontend-core-optional`). One parallel job per suite.
- **Jenkins** (`kiali-playwright-tests`): in-cluster OSSM Kiali via OpenShift route (downstream validation). Default `TEST_SET` is `playwright:run:junit` (crd-validation, core-1, core-2, core-caching). Error-rates health tests poll `/api/.../health`; empty `health_config.rate` on the OSSM CR is fine (Kiali uses built-in degraded thresholds).
- **Do not run `playwright test --last-failed` before merge-reports** — the rerun overwrites `blob-report/` and Jenkins `combined-report.xml` only lists rerun tests (misleading failure counts).
- **JUnit**: Playwright may record timeouts as `errors` not `failures` — check both in XML.
- Local `kiali run --port-forward-grafana` without `external_services.grafana` in config: **WARN** on `/api/status` (`grafana URL is not set`) is expected and does not fail tests.

### PR slicing (incremental migration)

- Port **one feature area** (or one `.feature` file's tag scope) per PR; state deferred tags in the PR body (e.g. `@multi-cluster` / `@core-caching` apps scenarios left in Cypress until their phase).
- `@core-1` across the repo is **much larger** than apps + column management — graph, istio config details, etc. remain Cypress until ported.
- Coexistence: Cypress stays until cutover gate (2+ green full Playwright runs on all suites).

---

## Coverage

### Smoke (`yarn playwright:run:smoke`)

Ports all Cypress `@smoke` scenarios: about, alert, cookie, help, login, logout, sidebar, services toggles, graph prometheus-disabled, mesh local-kiali, istio config type + validation filters. On anonymous CI, **6 scenarios skip** (OpenShift login/cookie/logout/session).

### Core-1 (`yarn playwright:run:core1`)

Ports all Cypress `@core-1` scenarios (145 tests): graph display, toolbar, legend, find/hide, context menu, side panel, replay; istio config list; apps list, health, app details graph; column management.

### Core-2 (`yarn playwright:run:core2`)

Ports all Cypress `@core-2` scenarios (~240 tests): mesh, shared mesh, sidecar injection, istio config editor/actions, workload logs, wizards, and related list/detail flows (PR #10269).

### Core-caching (`yarn playwright:run:core-caching`)

Ports Cypress `@core-caching` scenarios: overview health/cache metrics, namespaces/services/workloads/apps list caching, mesh infra, manual refresh, details pages (app/service/workload/namespace), graph cache metrics, istio config wizards/editor, request routing wizard, workload logs. Includes smoke scenarios tagged `smokeAndCoreCaching`. Run with **cache enabled** locally:

```bash
$(go env GOPATH)/bin/kiali \
  -c hack/ci-yaml/ci-test-config-cache.yaml run \
  --cluster-name-overrides kind-ci=cluster-default \
  --port-forward-tracing --enable-tracing \
  --port-forward-prom --port-forward-grafana --no-browser
```

Full KinD setup: `hack/run-integration-tests.sh --test-suite playwright-core-caching`.

### Core-optional (`yarn playwright:run:core-optional`)

Ports Cypress `frontend-core-optional` scope: `@crd-validation` and `@perses` Playwright projects. KinD setup matches Cypress (bookinfo + sleep, Perses Helm chart in `istio-system`).

```bash
hack/run-integration-tests.sh --test-suite playwright-core-optional
```

### Perses (`yarn playwright:run:perses`)

Ports Cypress `@perses` scenarios from `mesh.feature` and `workloads_details.feature` (2 tests): mesh Perses infra node side panel, and Perses dashboard link on workload Inbound Metrics.

Requires Perses installed and configured (`hack/setup-kind-in-ci.sh --install-perses true` or Jenkins with Perses in the mesh). Tests skip when the Perses deployment or `/api/perses` external links are missing.

```bash
cd frontend
yarn playwright:run:perses
```

## Local run

Kiali UI at `http://localhost:3001` (override with `PLAYWRIGHT_BASE_URL`):

```bash
cd frontend
yarn playwright:install chromium   # once, after yarn install
yarn playwright:run:smoke
yarn playwright:run:core1
yarn playwright:run:core2
yarn playwright:run:core-caching
yarn playwright:run:core-optional
yarn playwright:run:perses
yarn playwright:run:smoke --headed
yarn playwright:ui --project=smoke
```

Use `yarn playwright:install` — not `yarn playwright install`.

## CI

PRs targeting `epic/playwright-migration` run **Playwright CI** (`.github/workflows/playwright-ci.yml`): build + parallel `playwright-smoke`, `playwright-core-1`, `playwright-core-2`, `playwright-core-caching`, and `playwright-core-optional` integration suites (`hack/run-integration-tests.sh`).

Jenkins: `kiali/test-jobs/kiali-playwright-tests` — prefer `TEST_SET=playwright:run:smoke` or `playwright:run:all` with empty `TEST_TAGS` on OpenShift; use `playwright:run:core1` equivalent via `run:all` or future dedicated script.

---

## Follow-ups (from review / not done yet)

- Add `data-test` on `StatefulFilters` (`filter-type-toggle`, `filter-value-toggle`, `filter-toolbar`, `filter-type-input`) and migrate `IstioConfigPage` off `#filter_select_*` IDs.
- Replace negative version assertions in `kiali_about.spec.ts` with `toHaveText(/^v?\d+\.\d+\.\d+/)`.
- `cleanup` fixture (`cleanup.trackNamespace()`) instead of ad-hoc `afterEach` / kubectl for demo mutations.
- `page.routeWebSocket()` wherever graph live updates are mocked.
- `token` / `openid` auth in `auth.setup.ts`.
- OSSMC Playwright sync and Cypress cutover ([#9712](https://github.com/kiali/kiali/issues/9712) later phases).
