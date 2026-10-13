import type { APIRequestContext, ElementHandle, Page } from '@playwright/test';
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
  timeoutMs = 180_000,
  clusterName?: string
): Promise<TraceListItem[]> => {
  const path = tracesApiPath(targetType, namespace, name);
  const deadline = Date.now() + timeoutMs;
  let lastCount = 0;
  let lastStatus = 0;
  let lastError = '';

  while (Date.now() < deadline) {
    // Tempo rejects bare /traces with start=0; query a recent window (last 10 minutes).
    const nowMicros = Date.now() * 1000;
    const response = await request.get(kialiUrl(path), {
      params: {
        clusterName: clusterName ?? '',
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
 * Find the <path> element of a Victory scatter point with at least `minSpans` spans.
 *
 * Returns the live DOM element rather than its `d` value: Victory circle paths contain
 * newlines between path commands, which cannot be embedded in a CSS attribute selector.
 *
 * TODO(#9712): replace with a data-test hook on the scatter points. Shared by the click
 * (selectTrace*) and hover (tooltip heat map) paths so the fiber heuristic lives in one place.
 */
const findScatterPointElement = async (page: Page, minSpans: number): Promise<ElementHandle<Element> | null> => {
  const handle = await page.evaluateHandle(min => {
    const root = document.querySelector('[data-test="tracing-scatterplot"]');
    if (!root) {
      return null;
    }
    const getFiber = (el: Element): unknown => {
      const key = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      return key ? (el as unknown as Record<string, unknown>)[key] : null;
    };
    const hits: Element[] = [];
    const walk = (fiber: unknown): void => {
      if (!fiber || typeof fiber !== 'object') {
        return;
      }
      const f = fiber as {
        elementType?: { name?: string } | string;
        memoizedProps?: {
          symbol?: string;
          datum?: { trace?: { spans?: unknown[]; matched?: number } };
        };
        child?: unknown;
        sibling?: unknown;
        stateNode?: unknown;
      };
      const typeName =
        typeof f.elementType === 'string'
          ? f.elementType
          : typeof f.elementType?.name === 'string'
            ? f.elementType.name
            : '';
      if (/oint/i.test(typeName) && f.memoizedProps?.symbol === 'circle') {
        const trace = f.memoizedProps.datum?.trace;
        // Same semantics as spanCount() above: Jaeger traces always carry
        // matched=0 (the backend leaves it unset), so only a positive matched
        // (Tempo) may override the actual number of spans.
        const matched = trace?.matched;
        const spans = typeof matched === 'number' && matched > 0 ? matched : (trace?.spans?.length ?? 0);
        if (spans >= min) {
          // Descend through wrapper fibers to the host fiber; its stateNode is the <path> DOM node.
          let node: { child?: unknown; stateNode?: unknown } | undefined = f;
          while (node && !(node.stateNode instanceof Element)) {
            node = node.child as { child?: unknown; stateNode?: unknown } | undefined;
          }
          if (node?.stateNode instanceof Element) {
            hits.push(node.stateNode);
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
  return handle.asElement();
};

/**
 * Select a trace with at least `minSpans` spans.
 * Prefer clicking the Victory scatterplot; fall back to `traceId` URL param.
 * TODO(#9712): Prefer data-test on scatter points when available (same fiber caveat as graphTopology).
 */
export const selectTraceWithMinSpans = async (page: Page, minSpans = 0, fallbackTraceId?: string): Promise<void> => {
  const scatter = page.getByTestId('tracing-scatterplot');
  await expect(scatter).toBeVisible();

  try {
    await expect(async () => {
      const point = await findScatterPointElement(page, minSpans);

      if (!point) {
        throw new Error(`No scatterplot point with >= ${minSpans} spans yet`);
      }

      await point.click({ force: true });
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

/** Hover a scatterplot point with at least `minSpans` spans (tooltip heat map scenarios). */
export const hoverTraceScatterplotWithMinSpans = async (page: Page, minSpans = 4): Promise<void> => {
  const scatter = page.getByTestId('tracing-scatterplot');
  await expect(scatter).toBeVisible({ timeout: 60_000 });

  await expect(async () => {
    const point = await findScatterPointElement(page, minSpans);

    if (!point) {
      throw new Error(`No scatterplot point with >= ${minSpans} spans yet`);
    }

    await point.hover({ force: true });
  }).toPass({ intervals: [3_000], timeout: 60_000 });
};

export const expectTraceTooltipHeatmap = async (page: Page): Promise<void> => {
  const tooltip = page.getByTestId('trace-tooltip');
  await expect(tooltip).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('trace-tooltip-heatmap')).toBeVisible({ timeout: 20_000 });
  // Compact heat maps render only colored cells with no text; "n/a" means the stats
  // matrix completed without data.
  await expect(page.getByTestId('trace-tooltip-heatmap-area')).not.toContainText('n/a');
  await expect(tooltip.locator('[role="progressbar"]')).toHaveCount(0);
};

export const expectTraceDetails = async (page: Page): Promise<void> => {
  await expect(page.getByTestId('trace-details-tabs')).toBeVisible();
  await page.getByTestId('trace-details-kebab').click();
  await expect(page.getByTestId('trace-details-dropdown')).toContainText('View on Graph');
  // Close kebab so later steps are not blocked
  await page.keyboard.press('Escape');
};

export type ExpectSpanDetailsOptions = {
  /**
   * When true (default), require span metrics to have loaded so "Load statistics"
   * is gone. Waypoint/ambient traces often lack matching Prometheus stats, so
   * callers should pass false there.
   */
  expectMetricsLoaded?: boolean;
};

export const expectSpanDetails = async (page: Page, options: ExpectSpanDetailsOptions = {}): Promise<void> => {
  const { expectMetricsLoaded = true } = options;
  // PF Tabs renders role="tab" buttons; data-test on the Tabs root scopes the tablist.
  await page.getByTestId('trace-details-tabs').getByRole('tab', { name: 'Span Details', exact: true }).click();
  const rows = page.locator('table tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  // At least 2 rows are required: the second row is asserted on below.
  await expect(rows.nth(1)).toBeVisible();
  const spanRow = rows.nth(1);
  await expect(spanRow.locator('td').nth(4)).toBeVisible();
  const statsCell = spanRow.locator('td').nth(3);
  await expect(statsCell).toContainText('Duration');
  if (expectMetricsLoaded) {
    await expect(statsCell.getByRole('button', { name: /Load statistics/i })).toHaveCount(0);
  }
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
  // PF ActionsColumn renders the per-row kebab with aria-label "Kebab toggle".
  const row = page.locator('table tbody tr').nth(1);
  await row.getByRole('button', { name: 'Kebab toggle' }).click();
  await expect(page.getByRole('menu')).toContainText(linkText);
  await page.keyboard.press('Escape');
};

/**
 * Pick the expected span-filter option, falling back (e.g. to the waypoint proxy) when the
 * preferred option is absent — ambient traces may only carry the fallback span tags.
 */
const clickSpanFilterOptionWithFallback = async (
  page: Page,
  expectedOption: string,
  fallbackOption: string
): Promise<void> => {
  const dropdown = page.getByTestId('istio-type-dropdown');
  await expect(async () => {
    const preferred = dropdown.getByRole('option', { name: expectedOption, exact: true });
    const fallback = dropdown.getByRole('option', { name: fallbackOption, exact: true });
    const optionCount = (await preferred.count()) + (await fallback.count());
    expect(optionCount, `Expected "${expectedOption}" or "${fallbackOption}" in span filter dropdown`).toBeGreaterThan(
      0
    );
  }).toPass({ intervals: [500], timeout: 15_000 });

  const preferred = dropdown.getByRole('option', { name: expectedOption, exact: true });
  if ((await preferred.count()) > 0) {
    await preferred.click();
  } else {
    await dropdown.getByRole('option', { name: fallbackOption, exact: true }).click();
  }
};

export const filterSpansByApp = async (page: Page, app: string, fallbackApp = 'waypoint'): Promise<void> => {
  await page.getByTestId('filter-type-toggle').click();
  await page.getByTestId('filter-type-select').getByRole('option', { name: 'App', exact: true }).click();
  await page.getByTestId('filter-type-input').locator('input').click();

  await clickSpanFilterOptionWithFallback(page, app, fallbackApp);
  await waitForLoadingComplete(page);

  const cells = page.locator('table tbody tr td[data-label="App / Workload"]');
  await expect(cells).not.toHaveCount(0);
  // toHaveText is a single-element assertion; assert per cell, each expect auto-retries.
  const expectedApp = new RegExp('(' + app + '|' + fallbackApp + ')', 'i');
  for (let i = 0; i < (await cells.count()); i++) {
    await expect(cells.nth(i)).toHaveText(expectedApp);
  }
  // Verify the row kebab opens a menu (PF ActionsColumn, aria-label "Kebab toggle").
  const row = page.locator('table tbody tr').first();
  await row.getByRole('button', { name: 'Kebab toggle' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
};

export const filterSpansByWorkload = async (
  page: Page,
  workload: string,
  fallbackWorkload = 'waypoint'
): Promise<void> => {
  await page.getByTestId('filter-type-toggle').click();
  await page.getByTestId('filter-type-select').getByRole('option', { name: 'Workload', exact: true }).click();
  await page.getByTestId('filter-type-input').locator('input').click();

  await clickSpanFilterOptionWithFallback(page, workload, fallbackWorkload);
  await waitForLoadingComplete(page);

  const cells = page.locator('table tbody tr td[data-label="App / Workload"]');
  await expect(cells).not.toHaveCount(0);
  // toHaveText is a single-element assertion; assert per cell, each expect auto-retries.
  const expectedWorkload = new RegExp('(' + workload + '|' + fallbackWorkload + ')', 'i');
  for (let i = 0; i < (await cells.count()); i++) {
    await expect(cells.nth(i)).toHaveText(expectedWorkload);
  }
  // Verify the row kebab opens a menu (PF ActionsColumn, aria-label "Kebab toggle").
  const row = page.locator('table tbody tr').first();
  await row.getByRole('button', { name: 'Kebab toggle' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
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
  // Span log lines render with the span color as an inline style (WorkloadPodLogs
  // spanColor). Assert the inline color styling exists without coupling to the token value.
  await expect(page.locator('#logsText p').first()).toHaveAttribute('style', /color:/);
};
