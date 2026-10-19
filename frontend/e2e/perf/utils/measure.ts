import { expect, type Page, type TestInfo } from '@playwright/test';
import { kialiUrl } from '../../utils/kialiUrl';
import { PERF_ATTACHMENT, type PerfSample } from './perfReport';

/** Repeat count per measured page — averaging smooths out cluster jitter. */
export const PERF_VISITS = Number(process.env.PERF_VISITS ?? 5);

/** Large data sets (all namespaces, idle nodes) keep the spinner up well past the suite default. */
const READY_TIMEOUT = Number(process.env.PERF_READY_TIMEOUT ?? 300_000);

/** Signals that a page finished rendering the content being measured. */
export type ReadyCheck = (page: Page) => Promise<void>;

/** Graph page: topology mounted with data (`data-ready` on the graph container). */
export const graphReady: ReadyCheck = async page => {
  await expect(page.locator('#pft-graph[data-ready="true"]')).toBeVisible({ timeout: READY_TIMEOUT });
};

/** List pages (apps, services, workloads, istio config, namespaces): filter toolbar rendered. */
export const listReady: ReadyCheck = async page => {
  await expect(page.getByTestId('filter-toolbar')).toBeVisible({ timeout: READY_TIMEOUT });
};

/** Details pages (app, service, workload, istio config): tab bar rendered. */
export const detailsReady: ReadyCheck = async page => {
  await expect(page.locator('#basic-tabs')).toBeVisible({ timeout: READY_TIMEOUT });
};

export type MeasureOptions = {
  /** Expected load time in seconds, from `perfBaselines`. */
  baseline: number;
  /** Measured page name as it appears in the report. */
  name: string;
  /** Content check marking the end of the measured load. */
  ready: ReadyCheck;
  /** Report section the measurement belongs to. */
  section: string;
  /** Console path with query, e.g. `/console/overview?refresh=0`. */
  url: string;
};

/** Build an absolute console URL; `URLSearchParams` escapes namespace lists and filter values. */
export const consoleUrl = (pagePath: string, params: Record<string, string> | [string, string][] = {}): string => {
  const query = new URLSearchParams(params).toString();
  return kialiUrl(`/console/${pagePath}${query ? `?${query}` : ''}`);
};

/**
 * Load a page `PERF_VISITS` times and attach the average duration to the test.
 *
 * Each visit is a full navigation, so `performance.now()` evaluated once the
 * page is ready is the elapsed time since that document's navigation start.
 */
export const measureLoadTime = async (
  page: Page,
  testInfo: TestInfo,
  { baseline, name, ready, section, url }: MeasureOptions
): Promise<void> => {
  let sum = 0;

  for (let visit = 0; visit < PERF_VISITS; visit++) {
    await page.goto(url);
    await ready(page);
    await expect(page.locator('#loading_kiali_spinner')).toHaveCount(0, { timeout: READY_TIMEOUT });

    sum += await page.evaluate(() => performance.now());
  }

  const sample: PerfSample = {
    baseline,
    durationSec: sum / PERF_VISITS / 1000,
    name,
    section
  };

  await testInfo.attach(PERF_ATTACHMENT, {
    body: JSON.stringify(sample),
    contentType: 'application/json'
  });
};
