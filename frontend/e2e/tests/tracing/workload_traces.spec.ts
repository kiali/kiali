import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { tracingOnly } from '../../utils/suite-tags';
import {
  expectMoreSpanDetailsLink,
  expectSpanDetails,
  expectTraceDetails,
  expectTraceScatterplot,
  expectViewInTracingLink,
  expectViewInTracingTraceLink,
  filterSpansByWorkload,
  openTracesTab,
  selectTrace,
  selectTraceWithMinSpans,
  waitForTracesViaApi
} from '../../utils/tracingHelpers';

test.describe('Workload details tracing', () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    'See workload tracing info after selecting a trace',
    tracingOnly,
    async ({ page, request, workloadDetailsPage }) => {
      ensureDemoApp('bookinfo');
      const traces = await waitForTracesViaApi(request, 'workload', 'bookinfo', 'details-v1');
      await workloadDetailsPage.open('bookinfo', 'details-v1');
      await openTracesTab(page);
      await expectTraceScatterplot(page);
      await selectTrace(page, traces[0]?.traceID);
      await expectTraceDetails(page);
    }
  );

  test('See workload span info after selecting a span', tracingOnly, async ({ page, request, workloadDetailsPage }) => {
    ensureDemoApp('bookinfo');
    const traces = await waitForTracesViaApi(request, 'workload', 'bookinfo', 'details-v1', 6);
    await workloadDetailsPage.open('bookinfo', 'details-v1');
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTraceWithMinSpans(page, 6, traces[0]?.traceID);
    await expectSpanDetails(page);
    await filterSpansByWorkload(page, 'details-v1');
  });

  test('See tracing links', tracingOnly, async ({ page, request, workloadDetailsPage }) => {
    ensureDemoApp('bookinfo');
    const traces = await waitForTracesViaApi(request, 'workload', 'bookinfo', 'details-v1', 6);
    await workloadDetailsPage.open('bookinfo', 'details-v1');
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await expectViewInTracingLink(page, 'View in Tracing');
    await selectTraceWithMinSpans(page, 6, traces[0]?.traceID);
    await expectViewInTracingTraceLink(page, 'View in Tracing');
    await expectSpanDetails(page);
    await expectMoreSpanDetailsLink(page, 'More span details');
  });
});
