import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { openDetailsTab } from './detailsPage';
import { kialiUrl } from './kialiUrl';
import { waitForLoadingComplete } from './transition';

type TraceListItem = {
  matched?: number;
  spans?: unknown[];
  traceID?: string;
};

type TracesResponse = {
  data?: TraceListItem[];
};

export type TracingTargetType = 'app' | 'service' | 'workload';

const tracesApiPath = (targetType: TracingTargetType, namespace: string, name: string): string => {
  switch (targetType) {
    case 'app':
      return `/api/namespaces/${namespace}/apps/${name}/traces`;
    case 'service':
      return `/api/namespaces/${namespace}/services/${name}/traces`;
    case 'workload':
      return `/api/namespaces/${namespace}/workloads/${name}/traces`;
  }
};

const spanCount = (trace: TraceListItem): number => {
  if (typeof trace.matched === 'number' && trace.matched > 0) {
    return trace.matched;
  }
  return Array.isArray(trace.spans) ? trace.spans.length : 0;
};

/** Poll Kiali traces API until at least one trace is available (Tempo ingestion lag). */
export const waitForTracesViaApi = async (
  request: APIRequestContext,
  targetType: TracingTargetType,
  namespace: string,
  name: string,
  minSpans = 0,
  timeoutMs = 180_000
): Promise<TraceListItem[]> => {
  const path = tracesApiPath(targetType, namespace, name);
  const deadline = Date.now() + timeoutMs;
  let lastCount = 0;
  let lastStatus = 0;
  let lastError = '';

  while (Date.now() < deadline) {
    // Same window as Cypress waitForTargetTracesInApi — bare /traces uses start=0 and Tempo 400s.
    const nowMicros = Date.now() * 1000;
    const response = await request.get(kialiUrl(path), {
      params: {
        endMicros: String(nowMicros),
        limit: '100',
        startMicros: String(nowMicros - 10 * 60 * 1000 * 1000),
        tags: '{}'
      }
    });
    lastStatus = response.status();
    if (response.ok()) {
      const body = (await response.json()) as TracesResponse & { error?: string };
      const traces = body.data ?? [];
      lastCount = traces.length;
      lastError = body.error ?? '';
      const matching = traces.filter(t => spanCount(t) >= minSpans);
      if (matching.length > 0 || (minSpans === 0 && traces.length > 0)) {
        return matching.length > 0 ? matching : traces;
      }
    } else {
      const text = await response.text();
      try {
        lastError = (JSON.parse(text) as { error?: string }).error ?? text;
      } catch {
        lastError = text;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 5_000));
  }

  throw new Error(
    `Timeout waiting for ${path} traces (minSpans=${minSpans}). Last list size: ${lastCount}, status: ${lastStatus}, error: ${lastError}`
  );
};

export const openTracesTab = async (page: Page): Promise<void> => {
  await openDetailsTab(page, 'Traces');
  await waitForLoadingComplete(page);
};

export const expectTraceScatterplot = async (page: Page): Promise<void> => {
  const scatter = page.getByTestId('tracing-scatterplot');
  await expect(scatter).toBeVisible({ timeout: 60_000 });
  await expect(scatter).toContainText('Traces');
  await expect(page.getByTestId('trace-details-tabs')).toHaveCount(0);
};

/**
 * Select a trace with at least `minSpans` spans.
 * Prefer clicking the Victory scatterplot (Cypress parity); fall back to `traceId` URL param.
 * TODO(#9712): Prefer data-test on scatter points when available (same fiber caveat as graphTopology).
 */
export const selectTraceWithMinSpans = async (page: Page, minSpans = 0, fallbackTraceId?: string): Promise<void> => {
  const scatter = page.getByTestId('tracing-scatterplot');
  await expect(scatter).toBeVisible();

  try {
    await expect(async () => {
      const pathD = await page.evaluate(min => {
        const root = document.querySelector('[data-test="tracing-scatterplot"]');
        if (!root) {
          return null;
        }
        const getFiber = (el: Element): unknown => {
          const key = Object.keys(el).find(
            k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
          );
          return key ? (el as unknown as Record<string, unknown>)[key] : null;
        };
        const hits: string[] = [];
        const walk = (fiber: unknown): void => {
          if (!fiber || typeof fiber !== 'object') {
            return;
          }
          const f = fiber as {
            elementType?: { name?: string } | string;
            memoizedProps?: {
              symbol?: string;
              datum?: { trace?: { spans?: unknown[]; matched?: number } };
              d?: string;
            };
            child?: unknown;
            sibling?: unknown;
          };
          const typeName =
            typeof f.elementType === 'string'
              ? f.elementType
              : typeof f.elementType?.name === 'string'
                ? f.elementType.name
                : '';
          if (/oint/i.test(typeName) && f.memoizedProps?.symbol === 'circle') {
            const trace = f.memoizedProps.datum?.trace;
            const spans = trace?.matched ?? trace?.spans?.length ?? 0;
            if (spans >= min) {
              const child = f.child as { memoizedProps?: { d?: string } } | undefined;
              const d = child?.memoizedProps?.d ?? f.memoizedProps.d;
              if (d) {
                hits.push(d);
              }
            }
          }
          walk(f.child);
          walk(f.sibling);
        };
        walk(getFiber(root));
        root.querySelectorAll('*').forEach(el => walk(getFiber(el)));
        return hits[0] ?? null;
      }, minSpans);

      if (!pathD) {
        throw new Error(`No scatterplot point with >= ${minSpans} spans yet`);
      }

      await scatter.locator(`path[d="${pathD}"]`).click({ force: true });
      await expect(page.getByTestId('trace-details-tabs')).toBeVisible({ timeout: 10_000 });
    }).toPass({ intervals: [3_000], timeout: 45_000 });
    return;
  } catch {
    if (!fallbackTraceId) {
      throw new Error(`Could not click scatterplot point (minSpans=${minSpans}) and no fallbackTraceId provided`);
    }
  }

  const url = new URL(page.url());
  url.searchParams.set('traceId', fallbackTraceId!);
  url.searchParams.set('tab', 'traces');
  await page.goto(url.pathname + url.search);
  await waitForLoadingComplete(page);
  await expect(page.getByTestId('trace-details-tabs')).toBeVisible({ timeout: 30_000 });
};

/** Select any available trace (minSpans=0). */
export const selectTrace = async (page: Page, fallbackTraceId?: string): Promise<void> => {
  await selectTraceWithMinSpans(page, 0, fallbackTraceId);
};

export const expectTraceDetails = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('trace-details-tabs')).toBeVisible();
  await page.getByTestId('trace-details-kebab').click();
  await expect(page.getByTestId('trace-details-dropdown')).toContainText('View on Graph');
  // Close kebab so later steps are not blocked
  await page.keyboard.press('Escape');
};

export const expectSpanDetails = async (page: Page): Promise<void> => {
  await page.getByTestId('trace-details-tabs').getByText('Span Details').click();
  const rows = page.locator('table tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  await expect(rows).not.toHaveCount(0);
  await expect(rows.nth(1).locator('td').nth(4)).toBeVisible();
  await expect(rows.nth(1).locator('td').nth(3).locator('button')).toHaveCount(0);
};

export const expectViewInTracingLink = async (page: Page, linkText: string): Promise<void> => {
  await expect(page.getByTestId('view-in-tracing')).toContainText(linkText);
};

export const expectViewInTracingTraceLink = async (page: Page, linkText: string): Promise<void> => {
  await expect(page.getByTestId('trace-details-tabs')).toBeVisible();
  await page.getByTestId('trace-details-kebab').click();
  await expect(page.getByTestId('trace-details-dropdown')).toContainText(linkText);
  await page.keyboard.press('Escape');
};

export const expectMoreSpanDetailsLink = async (page: Page, linkText: string): Promise<void> => {
  const row = page.locator('table tbody tr').nth(1);
  await row.locator('td').nth(4).locator('button').click();
  await expect(page.locator('ul[role="menu"]')).toContainText(linkText);
  await page.keyboard.press('Escape');
};

export const filterSpansByApp = async (page: Page, app: string): Promise<void> => {
  await page.locator('button#filter_select_type-toggle').click();
  await page.locator('div#filter_select_type button').filter({ hasText: /^App$/ }).click();
  await page.locator('input[placeholder="Filter by App"]').click();
  await page
    .getByRole('option', { name: app })
    .or(page.locator(`button:has-text("${app}")`))
    .first()
    .click();
  await waitForLoadingComplete(page);

  const cells = page.locator('table tbody tr td[data-label="App / Workload"]');
  const count = await cells.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const text = (await cells.nth(i).innerText()).toLowerCase();
    expect(text.includes(app.toLowerCase()) || text.includes('waypoint')).toBeTruthy();
  }
  await page.locator('table tbody tr td').nth(4).locator('button').first().click();
  await expect(page.locator('ul[role="menu"]')).toBeVisible();
  await page.keyboard.press('Escape');
};

export const filterSpansByWorkload = async (page: Page, workload: string): Promise<void> => {
  await page.locator('button#filter_select_type-toggle').click();
  await page.locator('button#Workload').click();
  await page.locator('input[placeholder="Filter by Workload"]').click();
  await page
    .getByRole('option', { name: workload })
    .or(page.locator(`button:has-text("${workload}")`))
    .first()
    .click();
  await waitForLoadingComplete(page);

  const cells = page.locator('table tbody tr td[data-label="App / Workload"]');
  const count = await cells.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const text = (await cells.nth(i).innerText()).toLowerCase();
    expect(text.includes(workload.toLowerCase()) || text.includes('waypoint')).toBeTruthy();
  }
  await page.locator('table tbody tr td').nth(4).locator('button').first().click();
  await expect(page.locator('ul[role="menu"]')).toBeVisible();
  await page.keyboard.press('Escape');
};

export const enableSpansInLogs = async (page: Page): Promise<void> => {
  const containers = page.getByTestId('workload-logs-pod-containers');
  const checkboxes = containers.locator('[type=checkbox]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).uncheck();
  }
  await page.locator('#spans-show').check();
  await waitForLoadingComplete(page);
};

export const expectLogPaneShowsSpans = async (page: Page): Promise<void> => {
  await expect(page.locator('#trace-limit-dropdown-toggle')).toBeVisible();
  const spansColor = await page.locator('#spans-show').evaluate(el => getComputedStyle(el).accentColor);
  await expect(page.locator('#logsText p').first()).toHaveCSS('color', spansColor);
};
