# Playwright e2e

Patterns for migrations:

- Native Playwright Test (not playwright-bdd); native `tag` option on tests drives projects
- Suite tags: `e2e/utils/suite-tags.ts` (`smokeAndCoreCaching`, `core1`, …) — aligned with Cypress @tags
- `testIdAttribute: 'data-test'` (Kiali `data-test` selectors)
- Auth via `storageState` (`e2e/global-setup/auth.setup.ts`); supports anonymous and OpenShift (`PLAYWRIGHT_*` env)
- Page objects extend `BasePage` (`getBySel`, `waitForLoad`); Playwright auto-retries clicks and assertions
- API mocks use `page.route('**/api/...')` for OSSMC proxy compatibility
- `linkSelector()` matches `<a href>` and `<button data-href>` (OSSMC kiosk)
- List pages that need toggles: `gotoListPage()` rewrites `/api/config` `showIncludeToggles`

## Smoke coverage

`yarn playwright:run:smoke` runs the Playwright ports of all Cypress `@smoke` scenarios
(about, alert, cookie, help, login, logout, sidebar, services toggles, graph prometheus-disabled,
mesh local-kiali, istio config type + validation filters). OpenShift-only scenarios skip when
auth strategy is not `openshift`.

### Tag filtering (`PLAYWRIGHT_GREP` / Jenkins `TEST_TAGS`)

Prefer `--project=smoke` / `yarn playwright:run:smoke` for smoke-only. If you use
`PLAYWRIGHT_GREP=@smoke` (or Jenkins `TEST_TAGS`), run auth setup first — the setup test
title is `authenticate` and does not match suite tags. `yarn playwright:run:test-group:junit`
does that automatically.

## Local run

Kiali UI at `http://localhost:3001` (override with `PLAYWRIGHT_BASE_URL`):

```bash
cd frontend
yarn playwright:install chromium   # once, after yarn install
yarn playwright:run:smoke
yarn playwright:run:smoke --headed # visible browser
yarn playwright:ui --project=smoke # interactive debugger
```

Use `yarn playwright:install` for browsers — not `yarn playwright install`.

## CI

PRs and pushes targeting `epic/playwright-migration` run Playwright CI
(`.github/workflows/playwright-ci.yml`): build + `playwright-smoke` and `playwright-core-1` integration suites.
