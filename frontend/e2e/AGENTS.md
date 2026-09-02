# Playwright migration conventions (agent guide)

> **Temporary file.** Best-practices and forbidden-practices for porting Kiali's Cypress e2e tests to
> Playwright. Written for an AI agent (or human) doing the migration. Delete before merging to
> `master`; fold anything durable into `README.md`. Progress tracking lives in `MIGRATION-PLAN.md`.

These rules come from the [#9712](https://github.com/kiali/kiali/issues/9712) plan and review feedback
on PRs #10174, #10195, #10217, #10220. **Do not re-introduce Cypress patterns when porting.** Every
rule below is already applied in the branch code — match the existing code, don't regress it.

---

## Playwright mechanics — trust auto-wait

- **No `page.waitForTimeout()`** — Playwright auto-waits on every action (`actionTimeout: 40_000`).
- **No `robustClick` / `retryOnError` / manual click loops** — `locator.click()` already retries for
  actionability (attached, visible, stable, not covered, enabled). If a PF overlay blocks the target,
  wait for it to disappear: `await expect(overlay).not.toBeVisible()` then click.
- **No stale-element retries** — Playwright locators re-query the DOM on every action; Cypress-style
  retry loops add latency and hide real errors.
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

**Why:** `waitForTimeout(250)` is a hard pause even when the element is ready. The outer `catch`
swallows the real error and replaces it with `robustClick failed`. This pattern was copied from
openshift/console's PF5 migration and does not transfer — Playwright locators re-query the DOM on
every action, so stale references don't exist.

---

## Selectors — upgrade when porting, do not copy Cypress verbatim

| Avoid | Use instead |
|-------|-------------|
| `li[role="none"]`, structural PF nodes | `getByRole('menuitem', { name })`, `getByRole('option', { name, exact: true })` |
| `#foo > :nth-child(n)`, positional indices | `getByRole`, `getByTestId`, or add `data-test` in source |
| PF classes (`pf-v6-c-*`, `pf-m-*`) **for interaction** | `data-test` or ARIA roles (classes change across PF versions) |
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
await this.page.locator('li[role="none"]').filter({ hasText: 'About' }).click();
await expect(this.page.locator('h1.pf-v6-c-modal-box__title')).toBeVisible();
```

**Why:** PF class names change between minor versions (`pf-v5-*` → `pf-v6-*`). `role="none"` is a PF
presentation node, not a semantic role. Playwright's `getByRole` / `getByTestId` / ARIA locators are
stable.

- **Add hooks in source when none exists.** When no stable selector is available, add `data-test`
  (or `aria-label`) to the source component — that is the *only* production change a test-migration PR
  may make (see [PR scope](#pr-scope)).
- **OSSMC:** `linkSelector()` matches standalone `<a href>` and kiosk `<button data-href>`.
- **Namespace dropdown:** `getByRole('checkbox', { name: namespace, exact: true })` scoped to
  `namespace-dropdown-list` — requires `aria-label={namespace.name}` on the source checkbox (added in
  PR #10217). Without `aria-label`, PF renders the name in a sibling `<span>`, not a `<label>`.

---

## Filters and dropdowns

- **Exact option names** — e.g. `Present` vs `Not Present`, `Valid` vs `Not Validated`
  (`exact: true` on `getByRole('option')`).
- **Open once, assert all, close once** — do not loop open/close per option (Cypress `optionCheck`
  anti-pattern: 8 clicks to check 4 options).
- **Apply filters by name**, not by nth-child index in dropdown lists.
- **LabelGroup overflow:** PF renders the overflow button with text `"${n} more"` (not `"+N"`). Use
  `getByRole('button', { name: /\d+ more/ })` — not PF classes (`pf-v6-c-label.pf-m-overflow`) or a
  wrong regex (`/^\+/`).

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

---

## Assertions — positive over negative lists

- Do not assert validity by listing what a value is **not** (`not.toEqual('unknown')`,
  `not.toContainText('undefined')`, etc.).
- Use **positive** checks: `toHaveText(/^v?\d+\.\d+\.\d+/)` for semver fields, `toMatch(…)` for
  structured text, `toBeGreaterThan(n)` for counts.
- Don't over-assert against multiple matching nodes — scope to a specific container.

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

**Why:** Negative lists pass on any garbage not in the list and document no intent. `innerText()` +
raw `expect()` loses Playwright's auto-retry. One positive regex replaces seven negative checks.

---

## Visibility semantics

Use `isVisible()` / `isHidden()` for toggle guards — same CSS-visibility signal as `toBeVisible()` —
not `aria-hidden` `getAttribute` alone (can diverge from CSS visibility during PF transitions).

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

---

## Waiting / timeouts / retries

- No hard sleeps (see [mechanics](#playwright-mechanics--trust-auto-wait)).
- **`expect.poll()` does not retry when the callback throws** — it propagates immediately. Wrap in
  try/catch, or better, assert against a DOM attribute (see [component readiness](#component-readiness)).

---

## Component readiness — data-ready DOM attribute, not fiber walks

Expose component loading state as a `data-ready` DOM attribute and assert it with a single
`toBeVisible()` locator. Do not walk React fiber internals via `page.evaluate()`.

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

**Why:** `expect.poll()` does not retry when the callback throws. Fiber internals break on React
version changes. The DOM itself is the source of truth.

---

## Page Object Model

- `BasePage` provides only `getBySel` / `waitForLoad` / `expectVisible` — **no** custom click/retry
  helpers.
- List pages (`AppsPage`, `ServicesPage`, `WorkloadsPage`) extend a shared `ListPage` (filters,
  columns, toggles). Put shared list behavior there, not per-page.

---

## Suite tags and projects

- Put suite membership in the Playwright **`tag` option** via exports in `e2e/utils/suite-tags.ts`
  (e.g. `test('…', core1, async () => { … })`).
- **Do not** embed `@smoke` / `@core-1` in the title string — it pollutes report output and only works
  if a project `grep` matches the title.
- A tag in the title with **no matching project `grep`** is a no-op invisible to CI operators. Use the
  `annotation` API for cluster preconditions (e.g. "Prometheus disabled"), not a fake
  `@prometheus-disabled` title tag.

**Do this:**
```typescript
import { core1 } from '../../utils/suite-tags';
test('Apps list shows bookinfo apps', core1, async ({ page }) => { ... });
```

**Not this:**
```typescript
test('Apps list shows bookinfo apps @core-1', async ({ page }) => { ... });
```

---

## Auth

- **Never** rely on `process.env` set in the setup worker — workers are separate Node.js processes and
  do not inherit it. Use `getAuthStrategy(page)` or `request.get('/api/auth/info')`.
- **OpenShift-only** login/logout/cookie/session tests: `test.skip(strategy !== 'openshift', '…')` on
  KinD/Jenkins anonymous CI — **skip**, do not fail the suite.
- **Logout** must run on a fresh session — `test.use({ storageState: { cookies: [], origins: [] } })`
  — so `/api/logout` does not invalidate `AUTH_FILE` for later projects.
- **Unimplemented strategies** (`token`, `openid`): write empty `storageState` first, then fail via
  `expect(implemented).toContain(strategy)`. A hard `throw` crashes the setup project — JUnit emits
  nothing and Jenkins sees an empty report instead of 1 FAILED + 18 SKIPPED.
- Use `page.request` (carries browser cookies) for post-login API checks, not standalone `request`
  (401 after OAuth).

---

## Health indicators in tables

Cypress hovers the first-column icon and checks tooltip text. Playwright equivalent:

1. Hover **`row.locator('td[data-label="Health"] .pf-v6-c-icon__content')`** — see the
   [sanctioned exception](#sanctioned-exceptions) on this PF class.
2. Assert **`await expect(page.getByRole('tooltip')).toContainText(healthStatus)`** — not
   `tooltip.locator('strong')` alone: failure/degraded tooltips include multiple `<strong>` nodes
   (status + traffic legend).
3. Bulk "all healthy" checks: scope to `tbody td[data-label="Health"]`, not unscoped icons.
4. Retry via refresh + `waitForLoadingComplete`, not long hover timeouts only.

---

## CI and JUnit

- **Do not run `playwright test --last-failed` before merge-reports** — the rerun overwrites
  `blob-report/` and Jenkins `combined-report.xml` only lists rerun tests (misleading failure counts).
  The `playwright:run:last-failed` script was removed.
- **`workers: 2` in CI** is intentional (Jenkins OOM prevention) — keep it documented if changed.
- **JUnit**: Playwright may record timeouts as `errors`, not `failures` — check both in the XML.
- Avoid `sudo` / `--with-deps` in CI browser install (Jenkins blocks root); install Chromium binaries
  only.
- Local `kiali run --port-forward-grafana` without `external_services.grafana` in config: a **WARN**
  on `/api/status` (`grafana URL is not set`) is expected and does not fail tests.

---

## PR scope

- Keep test-migration PRs **additive in source**: only `data-test` attributes and `aria-label`
  additions. **No** ESLint fixes, refactors, React key changes, or production behavioral changes —
  those go to dedicated PRs targeting `master`.
- Port **one feature area per PR**; state deferred tags in the PR body (e.g. `@multi-cluster`,
  `@core-caching` left in Cypress until their phase).

### Lesson: StatefulFilters revert (PR #10217)

PR #10217 commit `e754190` made three behavioral changes alongside `data-test` additions, all reverted
in `fd9479e` after review:
1. `import type` splitting — can silently make values `undefined` at runtime.
2. `React.Children.toArray()` rewrite — flattens arrays, removes falsy children, reassigns keys;
   differs from the original `Array.isArray` + falsy guard.
3. Index→name toggle keys — cause full unmount/remount when toggle list order changes.

Only the `data-test` additions stayed. ESLint cleanup was deferred to a dedicated `master` PR.

---

## Sanctioned exceptions

These look like rule violations but are intentional — **do not "fix" them:**

1. **PF internal class as a hover/read target.** `utils/table.ts` uses
   `.pf-v6-c-icon__content` to *hover* the health-status icon because PF6 exposes no `aria-label` on a
   row descendant for that trigger. The "no PF classes" rule applies to **interaction** (clicks/fills)
   — reads and hovers of last resort are allowed. Prefer a stable hook when one exists.
2. **Graph topology fiber walk.** `utils/graphTopology.ts` still walks `__reactFiber` via
   `page.evaluate()` for main-graph topology, carrying `TODO(#9712)`. This is an accepted deferral —
   only `MiniGraphCard` was migrated to `data-ready`. Don't add *new* fiber walks; new components must
   expose DOM hooks.
3. **`smokeAndPrometheusDisabled` tag.** This export currently rides the `@smoke` project. The
   guidance "use the `annotation` API, not a tag" for non-project conditions is not yet literally
   applied here; migrate it to an annotation when convenient, but it is not a regression.

---

## Gotchas

- **`TextInputGroupMain` `data-test` renders on the outer `<div>`, not the inner `<input>`** —
  `fill()` rejects a `<div>`. Scope to the child: `getByTestId('filter-type-input').locator('input')`.
  (PR #10217)
- **Version strings may start with `v`** — Kiali emits `"v2.31.0-SNAPSHOT (...)"`. Use
  `/^v?\d+\.\d+\.\d+/`, not `/^\d+\.\d+\.\d+/`. (PR #10217)
- **PF LabelGroup overflow text has no `+` prefix** — default `collapsedText` is `"${remaining} more"`
  (e.g. `"1 more"`). Use `/\d+ more/`, not `/^\+/`. (PR #10174 → #10217)
- **`expect.poll()` does not retry on throw** — wrap in try/catch or use DOM attributes. (PR #10217)
- **`--last-failed` overwrites blob reports** — the `playwright:run:last-failed` script was removed.
  (PR #10195)
- **Auth setup `throw` produces zero JUnit** — use `expect().toContain()` after writing empty
  `storageState`. (PR #10217)
- **Namespace dropdown `getByRole('checkbox')` needs `aria-label`** — PF renders the name in a sibling
  `<span>`, not a `<label>`. Scope to `namespace-dropdown-list` with `exact: true`. (PR #10217)

---

## Source `data-test` reference

`StatefulFilters.tsx` exposes these `data-test` attributes for stable POM selectors:

| Attribute | Component | Purpose |
|---|---|---|
| `filter-toolbar` | `<Toolbar>` | Filter selection container |
| `filter-type-toggle` | `<MenuToggle>` | Filter type dropdown toggle |
| `filter-type-select` | `<Select>` | Filter type dropdown |
| `filter-value-toggle` | `<MenuToggle>` (3 branches) | Filter value dropdown toggle |
| `filter-value-select` | `<Select>` (3 branches) | Filter value dropdown |
| `filter-type-input` | `<TextInputGroupMain>` | Typeahead filter input (scope to child `input` for `fill()`) |

`MiniGraphCard.tsx` exposes `data-ready={!isLoading && isReady}` on the root `<Card>`; assert with
`page.locator('#MiniGraphCard[data-ready="true"]')`.
