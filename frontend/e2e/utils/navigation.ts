import { expect, type Page } from '@playwright/test';
import { kialiUrl } from './kialiUrl';
import { waitForLoadingComplete } from './transition';

/** Assert pathname (web_root-aware) — Playwright `toHaveURL` matches the full URL including query params. */
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
  const url = kialiUrl(`/console/${pagePath}?${params.toString()}`);
  const deadline = Date.now() + 90_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await page.goto(url);
      lastError = undefined;
      break;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (!/ERR_CONNECTION_REFUSED|EHOSTUNREACH|ERR_CONNECTION_RESET|net::ERR_FAILED/.test(message)) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 2_000));
    }
  }
  if (lastError) {
    throw lastError;
  }
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
