# Cypress → Playwright migration plan

> **Temporary file.** Progress tracker for the Cypress→Playwright e2e migration, seeded from issue
> [#9712](https://github.com/kiali/kiali/issues/9712). Delete this file before merging the migration
> to `master`. Porting conventions live in `AGENTS.md` (also temporary); the permanent user guide is
> `README.md`.

## Acceptance criteria (from #9712)

- [x] Decision made on Cucumber BDD vs native Playwright — **native Playwright Test** (PR #10174)
- [x] Playwright installed and configured with projects matching current test suites (PR #10174)
- [ ] All existing Cypress tests migrated to Playwright
- [x] JUnit reporting preserved for CI integration (PR #10174)
- [ ] CI workflows updated (`hack/run-integration-tests.sh` and GitHub Actions) — partial: smoke +
  core-1 done (PR #10174/#10195/#10220); remaining suites pending
- [ ] AGENTS.md and developer documentation updated
- [ ] Cypress and all Cypress-specific devDependencies removed
- [x] `@smoke` tests pass (~32 scenarios, PR #10174)
- [ ] `@core-1` and `@core-2` tests pass — core-1 done (145 tests, PR #10195/#10220); core-2 pending
- [ ] Multi-cluster and ambient test suites pass
- [ ] OSSMC plugin mode tested and working
- [ ] Equivalent-or-better failure investigation tooling is available versus Cypress
- [x] Failed Playwright tests automatically capture screenshots and preserve videos in CI artifacts
  (PR #10174/#10220)
- [x] Playwright traces are retained on failure (or first retry) and are viewable from archived
  artifacts (PR #10174/#10220)
- [x] CI archives actionable test reports/logs (`combined-report.xml` and test result artifacts)
- [ ] CI continues to archive Kiali server and operator logs for cluster-side failure diagnosis
- [ ] Environment snapshot capture remains available for downstream reporting/debugging workflows

## Decisions & tracking

- [x] Decision documented: **Native Playwright Test** (not `playwright-bdd`) — self-contained
  `.spec.ts` + Page Object Models; no third-party Gherkin dependency. (PR #10174)
- [x] React fiber policy documented: prefer `data-test` / DOM assertions; no new `page.evaluate()`
  fiber walking without a TODO. `data-ready` DOM attribute demonstrated on MiniGraphCard.
  (PR #10217, PR #10220)
- [ ] CI strategy documented: **coexistence on `master` first**; LTS/supported branches after master
  cutover
- [ ] Private pipelines (Jenkins) included in cutover acceptance — not GitHub Actions only
- [ ] Epic broken into sub-issues (Phase 0 spike, migration skill, smoke, core-1, core-2, specialized,
  OSSMC, Jenkins, Cypress removal)
- [x] Suite tags: use Playwright's native `tag` option via centralized exports in
  `e2e/utils/suite-tags.ts`, not title-only strings. Non-project conditions (e.g.
  `@prometheus-disabled`) use the `annotation` API. (PR #10174 review, PR #10195, PR #10217)
- [x] Test-migration PR scope: only `data-test` attributes and `aria-label` additions in source code.
  No ESLint fixes, refactors, or production behavioral changes — those go to dedicated PRs targeting
  `master`. (PR #10217 — StatefulFilters revert)
- [x] Auth setup failure handling: write empty `storageState` then fail via `expect().toContain()`,
  not `throw`. Hard throws produce zero JUnit output; `expect` produces 1 FAILED + 18 SKIPPED.
  (PR #10217)
- [x] `playwright:run:last-failed` removed — `--last-failed` overwrites `blob-report/` and produces
  misleading Jenkins failure counts. CI reports reflect the full first pass only. (PR #10195)

## Phase 0 — Infrastructure

- [x] `@playwright/test` ≥1.48 installed in `frontend/` (pin documented, e.g. v1.61.x)
- [x] `playwright.config.ts` with projects matching CI suites via `grep` tags
- [x] `BasePage` with `getBySel()`, `waitForLoad` — **no** `robustClick` / `retryOnError` (PR #10174)
- [x] `auth.setup.ts` / `storageState` handles: `anonymous`, `openshift`. Unimplemented strategies
  (`token`, `openid`) fail gracefully via `expect().toContain()`. (PR #10174, #10217)
- [ ] `cleanup` fixture established (replaces `@clean-istio-namespace-resources-after`-style hooks)
- [x] Shared utils ported: navigation, table, `linkSelector`, transition, namespace, suite-tags
  (PR #10174, #10195, #10217)
- [x] JUnit reporter configured (built-in Playwright reporter — no Cypress multi-reporter stack)
  (PR #10174)
- [x] `yarn playwright:run:smoke` passes headless (PR #10174)
- [ ] Playwright MCP (`@playwright/mcp`) produces a valid `browser_snapshot` of the Kiali UI
- [ ] Kiali-specific migration skill added (adapted from
  [openshift/console#16315](https://github.com/openshift/console/pull/16315)): auth strategies, graph
  WebSocket mocking, OSSMC proxy patterns, vendored-code boundary
- [ ] At least one smoke path verified OSSMC-safe: `linkSelector()` + `**/api/**` route patterns

## Migration completeness

- [ ] All existing Cypress Gherkin scenarios migrated to Playwright `.spec.ts` + Page Object Models
  under `frontend/e2e/`
- [ ] `page.routeWebSocket()` used alongside `page.route()` wherever graph/watch APIs are mocked
- [ ] React fiber usages (`getReact` / `waitForReact` / `getCurrentState` / `getProps`) replaced with
  `data-test` or DOM assertions (no residual Cypress React helpers). Graph topology fiber reads remain
  with TODO (PR #10220).
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

## CI / pipelines

- [x] During migration: Playwright runs **alongside** Cypress in GitHub Actions for migrated suites
  (coexistence) (PR #10195 — `integration-tests-frontend-playwright-core-1.yml`)
- [x] `hack/run-integration-tests.sh` updated for `playwright-smoke` and `playwright-core-1` suites
  (PR #10174, #10195, #10220)
- [ ] `hack/run-integration-tests.sh` updated for all remaining Playwright projects
- [x] GitHub Actions workflows updated for Playwright (JUnit artifacts, screenshots/traces on failure)
  (PR #10174, #10220)
- [ ] Jenkins / private nightly pipelines updated and green for Playwright suites before Cypress
  removal
- [ ] Cutover gate: **2+ consecutive all-green** Playwright runs covering all suites before Cypress is
  removed

## OSSMC

- [ ] `hack/copy-frontend-src-to-ossmc.sh` updated to sync Playwright e2e (and stop syncing Cypress
  once cut over)
- [ ] OSSMC-specific tests migrated (`sidebar_navigation`, any non-vendored support: visit/request
  rewriting, Console login, guided tour)
- [ ] OSSMC plugin mode verified: Console proxy API paths + `linkSelector` (kiosk `<button data-href>`)
  work under Playwright
- [ ] OSSMC Cypress test image / Dockerfile updated or replaced for Playwright

## Cutover & docs

- [ ] Cypress and all Cypress-specific `devDependencies` removed from `frontend/package.json` (and
  OSSMC `plugin/package.json`)
- [ ] Cypress configs, support, feature files, and Cucumber preprocessor config removed
- [ ] `.mcp.json` / `AGENTS.md`: Playwright MCP debugging guidance replaces
  `CYPRESS_REMOTE_DEBUGGING_PORT=9222` Cypress CDP section
- [ ] Zero Cypress e2e references remaining in Kiali and OSSMC codebases (perf suite migrated or
  explicitly deferred with follow-up issue)
- [ ] LTS/supported-branch backport strategy executed or explicitly deferred with a tracked follow-up
- [ ] Delete temporary `MIGRATION-PLAN.md` and `AGENTS.md`; fold any lasting guidance into `README.md`

## Open questions

- **Graph topology DOM hooks:** PR #10220 uses `page.evaluate()` to walk React's fiber tree for graph
  topology assertions. A TODO marks this for migration to DOM/`data-test`. What `data-test` attributes
  or DOM hooks should graph components expose? (raised by hhovsepy, acknowledged by jshaughn)

## Action items

- [ ] Replace remaining React fiber reads in `graphTopology.ts` with `data-test` / DOM attributes
  (PR #10220 TODO)
- [ ] Implement `token` and `openid` auth strategies in `auth.setup.ts` (PR #10174 / #10217)
- [ ] Create `cleanup` fixture (`cleanup.trackNamespace()`) for demo mutation teardown (PR #10195
  pattern)
- [ ] Create dedicated PR to `master` for StatefulFilters ESLint cleanup — 19 pre-existing violations
  deferred from PR #10217
- [ ] Port `@core-2`, ambient/multi-cluster, OSSMC suites (PR #10220 — deferred)
- [ ] Add `page.routeWebSocket()` where graph live updates are mocked
- [ ] Verify TextInputGroupMain `data-test` scoping — PF renders `data-test` on outer `<div>`, not
  inner `<input>`; assess if PF should be patched or if `getByTestId().locator('input')` is sufficient
  (PR #10217)
- [ ] Add `data-test` on `StatefulFilters` overflow button area — verify `collapsedTextProps` in PF6
  LabelGroup (PR #10174 review)
- [ ] OSSMC Playwright sync and Cypress cutover ([#9712](https://github.com/kiali/kiali/issues/9712)
  later phases)
