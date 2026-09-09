import { expect, type Page } from '@playwright/test';
import { waitForLoadingComplete } from './transition';

/** Cypress uses `cy.location('pathname')` — Playwright `toHaveURL` matches the full URL including query params. */
export const expectPathname = async (page: Page, pattern: RegExp): Promise<void> => {
  await expect.poll(() => new URL(page.url()).pathname).toMatch(pattern);
};

export type GotoConsolePageOptions = {
  /** When false, navigate only — use before asserting loading states with mocked/slow APIs. */
  waitForLoad?: boolean;
};

/**
 * Navigate to a Kiali console page.
 * Default `refresh=0` (Pause) avoids background refresh during tests; pass `refresh` in `query` to override.
 */
export const gotoConsolePage = async (
  page: Page,
  pagePath: string,
  query: Record<string, string> = {},
  options: GotoConsolePageOptions = {}
): Promise<void> => {
  const params = new URLSearchParams({ refresh: '0', ...query });
  await page.goto(`/console/${pagePath}?${params.toString()}`);
  if (options.waitForLoad !== false) {
    await waitForLoadingComplete(page);
  }
};

/**
 * Navigate to a list page with include-toggles enabled via `/api/config` rewrite.
 * OSSMC-safe: leading `**` matches proxy-prefixed API paths.
 */
export const gotoListPage = async (page: Page, pagePath: string, query: Record<string, string> = {}): Promise<void> => {
  await page.route('**/api/config', async route => {
    const response = await route.fetch();
    const body = await response.json();
    if (!body.kialiFeatureFlags) {
      body.kialiFeatureFlags = {};
    }
    if (!body.kialiFeatureFlags.uiDefaults) {
      body.kialiFeatureFlags.uiDefaults = {};
    }
    if (!body.kialiFeatureFlags.uiDefaults.list) {
      body.kialiFeatureFlags.uiDefaults.list = {};
    }
    body.kialiFeatureFlags.uiDefaults.list.showIncludeToggles = true;
    await route.fulfill({ response, json: body });
  });

  await gotoConsolePage(page, pagePath, query);
  await page.locator('#filter-selection').waitFor({ state: 'visible', timeout: 15_000 });
};
