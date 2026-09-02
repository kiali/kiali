# Playwright e2e

Living guide for the Cypress → Playwright migration ([#9712](https://github.com/kiali/kiali/issues/9712)). Supplements the epic plan on the issue with **review feedback and lessons from Phase 0–2** (PRs [#10174](https://github.com/kiali/kiali/pull/10174), [#10195](https://github.com/kiali/kiali/pull/10195)).

## Quick reference

- Native Playwright Test (not `playwright-bdd`)
- Suite tags: `e2e/utils/suite-tags.ts` (`smokeAndCoreCaching`, `core1`, …) — use Playwright’s native `tag` option, not tags in titles
- `testIdAttribute: 'data-test'` in `playwright.config.ts`
- Auth: `storageState` from `e2e/global-setup/auth.setup.ts`; strategy via `getAuthStrategy(page)` (`/api/auth/info`)
- Page objects extend `BasePage` (`getBySel`, `waitForLoad`) — no custom click/retry helpers
- OSSMC: `page.route('**/api/...')`, `linkSelector()` for kiosk `<button data-href>`
- List pages with toggles: `gotoListPage()` rewrites `/api/config` `showIncludeToggles`

---

## Migration conventions (required)

These rules come from the [#9712](https://github.com/kiali/kiali/issues/9712) plan and **ScriptingShrimp’s review on #10174**. Do not re-introduce Cypress patterns when porting.

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
- Overflow “+N more” chips: `filterSelection().getByRole('button', { name: /\+\d+/ })` scoped to the toolbar — not PF overflow classes.

### Assertions — positive over negative lists

- Do not assert validity by listing what a value is **not** (`not.toEqual('unknown')`, `not.toContainText('undefined')`, etc.).
- Use **positive** checks: `toHaveText(/^\d+\.\d+\.\d+/)` for semver fields, `toMatch(…)` for structured text, `toBeGreaterThan(n)` for counts.

### Suite tags and projects

- Put suite membership in the Playwright **`tag` option** via exports in `e2e/utils/suite-tags.ts` (e.g. `test('…', core1, async () => { … })`).
- **Do not** embed `@smoke` / `@core-1` only in the title string — reports stay clean and tags stay typed.
- A tag in the title with **no matching project `grep`** is a no-op (e.g. use `annotation` for cluster preconditions like “Prometheus disabled”, not a fake `@prometheus-disabled` project tag).
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
3. Bulk “all healthy” checks: scope to `tbody td[data-label="Health"]`, not unscoped icons.
4. Retry via refresh + `waitForLoadingComplete`, not long hover timeouts only.

### Sidebar

Use `isVisible()` / `isHidden()` for toggle guards — same semantics as `toBeVisible()` — not `aria-hidden` alone (can diverge from CSS visibility during PF transitions).

### CI and Jenkins

- **Do not run `playwright test --last-failed` before merge-reports** — the rerun overwrites `blob-report/` and Jenkins `combined-report.xml` only lists rerun tests (misleading failure counts).
- GitHub **Playwright CI**: separate parallel jobs for smoke and core-1 (each with its own KinD cluster). Jenkins default `playwright:run:all` runs smoke + core-1 in one invocation.
- **JUnit**: Playwright may record timeouts as `errors` not `failures` — check both in XML.
- Local `kiali run --port-forward-grafana` without `external_services.grafana` in config: **WARN** on `/api/status` (`grafana URL is not set`) is expected and does not fail tests.

### PR slicing (incremental migration)

- Port **one feature area** (or one `.feature` file’s tag scope) per PR; state deferred tags in the PR body (e.g. `@multi-cluster` / `@core-caching` apps scenarios left in Cypress until their phase).
- `@core-1` across the repo is **much larger** than apps + column management — graph, istio config details, etc. remain Cypress until ported.
- Coexistence: Cypress stays until cutover gate (2+ green full Playwright runs on all suites).

---

## Smoke coverage

`yarn playwright:run:smoke` runs the Playwright ports of all Cypress `@smoke` scenarios (about, alert, cookie, help, login, logout, sidebar, services toggles, graph prometheus-disabled, mesh local-kiali, istio config type + validation filters). On anonymous CI, **6 scenarios skip** (OpenShift login/cookie/logout/session).

## Local run

Kiali UI at `http://localhost:3001` (override with `PLAYWRIGHT_BASE_URL`):

```bash
cd frontend
yarn playwright:install chromium   # once, after yarn install
yarn playwright:run:smoke
yarn playwright:run:core1
yarn playwright:run:core2
yarn playwright:run:smoke --headed
yarn playwright:ui --project=smoke
```

Use `yarn playwright:install` — not `yarn playwright install`.

## CI

PRs targeting `epic/playwright-migration` run **Playwright CI** (`.github/workflows/playwright-ci.yml`): build + parallel `playwright-smoke`, `playwright-core-1`, and `playwright-core-2` integration suites (`hack/run-integration-tests.sh`).

Jenkins: `kiali/test-jobs/kiali-playwright-tests` — prefer `TEST_SET=playwright:run:smoke` or `playwright:run:all` with empty `TEST_TAGS` on OpenShift; use `playwright:run:core1` equivalent via `run:all` or future dedicated script.

---

## Follow-ups (from review / not done yet)

- Add `data-test` on `StatefulFilters` (`filter-type-toggle`, `filter-value-toggle`, `filter-toolbar`, `filter-type-input`) and migrate `IstioConfigPage` off `#filter_select_*` IDs.
- Replace negative version assertions in `kiali_about.spec.ts` with `toHaveText(/^\d+\.\d+\.\d+/)`.
- `cleanup` fixture (`cleanup.trackNamespace()`) instead of ad-hoc `afterEach` / kubectl for demo mutations.
- `page.routeWebSocket()` wherever graph live updates are mocked.
- `token` / `openid` auth in `auth.setup.ts`.
- OSSMC Playwright sync and Cypress cutover ([#9712](https://github.com/kiali/kiali/issues/9712) later phases).
