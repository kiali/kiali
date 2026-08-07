# Playwright e2e

Patterns for remaining migrations:

- Native Playwright Test (not playwright-bdd); tags in test titles drive projects
- `testIdAttribute: 'data-test'` (Kiali `data-test` selectors)
- Auth via `storageState` (`e2e/global-setup/auth.setup.ts`); Phase 0 = anonymous only
- Page objects extend `BasePage` (`getBySel`, `robustClick`, `waitForLoad`, `retryOnError`)
- API mocks use `page.route('**/api/...')` for OSSMC proxy compatibility
- `linkSelector()` matches `<a href>` and `<button data-href>` (OSSMC kiosk)
- List pages that need toggles: `gotoListPage()` rewrites `/api/config` `showIncludeToggles`

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
(`.github/workflows/playwright-ci.yml`): build + `hack/run-integration-tests.sh --test-suite playwright-smoke`.
