import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { waypointTracingOnly } from '../../utils/suite-tags';
import {
  expectSpanDetails,
  expectTraceDetails,
  expectTraceScatterplot,
  filterSpansByApp,
  filterSpansByWorkload,
  openTracesTab,
  selectTrace,
  selectTraceWithMinSpans,
  waitForTracesViaApi
} from '../../utils/tracingHelpers';

test.describe('Waypoint tracing details', () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    'See workload tracing info after selecting a trace',
    waypointTracingOnly,
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

  test(
    'See workload span info after selecting a span',
    waypointTracingOnly,
    async ({ page, request, workloadDetailsPage }) => {
      ensureDemoApp('bookinfo');
      const traces = await waitForTracesViaApi(request, 'workload', 'bookinfo', 'details-v1', 4);
      await workloadDetailsPage.open('bookinfo', 'details-v1');
      await openTracesTab(page);
      await expectTraceScatterplot(page);
      await selectTraceWithMinSpans(page, 4, traces[0]?.traceID);
      await expectSpanDetails(page, { expectMetricsLoaded: false });
      await filterSpansByWorkload(page, 'details-v1');
    }
  );

  test(
    'See graph traces for details service details',
    waypointTracingOnly,
    async ({ page, request, serviceDetailsPage }) => {
      ensureDemoApp('bookinfo');
      const traces = await waitForTracesViaApi(request, 'service', 'bookinfo', 'details');
      await serviceDetailsPage.open('bookinfo', 'details');
      await openTracesTab(page);
      await expectTraceScatterplot(page);
      await selectTrace(page, traces[0]?.traceID);
      await expectTraceDetails(page);
    }
  );

  test(
    'See span info after selecting service span',
    waypointTracingOnly,
    async ({ page, request, serviceDetailsPage }) => {
      ensureDemoApp('bookinfo');
      const traces = await waitForTracesViaApi(request, 'service', 'bookinfo', 'details', 4);
      await serviceDetailsPage.open('bookinfo', 'details');
      await openTracesTab(page);
      await expectTraceScatterplot(page);
      await selectTraceWithMinSpans(page, 4, traces[0]?.traceID);
      await expectSpanDetails(page, { expectMetricsLoaded: false });
    }
  );

  test('See tracing info after selecting a trace', waypointTracingOnly, async ({ appDetailsPage, page, request }) => {
    ensureDemoApp('bookinfo');
    const traces = await waitForTracesViaApi(request, 'app', 'bookinfo', 'details');
    await appDetailsPage.openApp('bookinfo', 'details');
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTrace(page, traces[0]?.traceID);
    await expectTraceDetails(page);
  });

  test('See span info after selecting app span', waypointTracingOnly, async ({ appDetailsPage, page, request }) => {
    ensureDemoApp('bookinfo');
    const traces = await waitForTracesViaApi(request, 'app', 'bookinfo', 'details', 4);
    await appDetailsPage.openApp('bookinfo', 'details');
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTraceWithMinSpans(page, 4, traces[0]?.traceID);
    await expectSpanDetails(page, { expectMetricsLoaded: false });
    await filterSpansByApp(page, 'details', 'waypoint');
  });
});
