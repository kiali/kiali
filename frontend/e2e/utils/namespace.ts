import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { kialiUrl } from './kialiUrl';
import { waitForLoadingComplete } from './transition';

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait until the Kiali API lists the namespace. The list is served from a
 * server-side cache, so a namespace created moments ago can be missing for a
 * few seconds after it exists in the cluster — and the namespace dropdown
 * fetches the list only once per page load, so a page mounted against a stale
 * list never shows the namespace. Same pattern as the /api/namespaces waits in
 * waypointHelpers.ts.
 */
export const waitForNamespaceListed = async (
  request: APIRequestContext,
  namespace: string,
  timeoutMs = 60_000
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let response;
    try {
      response = await request.get(kialiUrl('/api/namespaces'));
    } catch {
      await sleep(5_000);
      continue;
    }
    const namespaces = (await response.json().catch(() => [])) as Array<{ name?: string }>;
    if (response.ok() && namespaces.some(ns => ns.name === namespace)) {
      return;
    }
    await sleep(5_000);
  }
  throw new Error(`Namespace ${namespace} not listed by the Kiali API within ${timeoutMs}ms`);
};

/** Select one or more namespaces in the Kiali namespace dropdown (additive — does not clear others). */
export const selectNamespaces = async (page: Page, namespaces: string[]): Promise<void> => {
  const dropdown = page.getByTestId('namespace-dropdown');
  await dropdown.click();
  const list = page.getByTestId('namespace-dropdown-list');
  await expect(list).toBeVisible();
  for (const namespace of namespaces) {
    // aria-label on the checkbox (NamespaceDropdown); wait until the ns appears after page load.
    const checkbox = list.getByRole('checkbox', { name: namespace, exact: true });
    await expect(checkbox).toBeVisible({ timeout: 60_000 });
    await checkbox.check();
  }
  await dropdown.click();
  await waitForLoadingComplete(page);
};

/** Select a namespace in the Kiali namespace dropdown (PatternFly checkbox list). */
export const selectNamespace = async (page: Page, namespace: string): Promise<void> => {
  await selectNamespaces(page, [namespace]);
};

/** Select exactly the given namespaces (unchecks all others). */
export const selectOnlyNamespaces = async (page: Page, namespaces: string[]): Promise<void> => {
  const selected = new Set(namespaces);
  const dropdown = page.getByTestId('namespace-dropdown');
  await dropdown.click();
  const list = page.getByTestId('namespace-dropdown-list');
  await expect(list).toBeVisible();
  const checkboxes = list.locator('input[type="checkbox"][value]');
  await expect(checkboxes.first()).toBeVisible({ timeout: 60_000 });
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    const checkbox = checkboxes.nth(i);
    const value = (await checkbox.getAttribute('value')) ?? '';
    if (selected.has(value)) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }
  await dropdown.click();
  await waitForLoadingComplete(page);
};
