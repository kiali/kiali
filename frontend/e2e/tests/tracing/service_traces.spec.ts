import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { tracingOnly } from '../../utils/suite-tags';
import {
  expectSpanDetails,
  expectTraceDetails,
  expectTraceScatterplot,
  openTracesTab,
  selectTrace,
  selectTraceWithMinSpans,
  waitForTracesViaApi
} from '../../utils/tracingHelpers';

test.describe('Service details tracing', () => {
  test.describe.configure({ timeout: 180_000 });

  test('See graph traces for details service details', tracingOnly, async ({ page, request, serviceDetailsPage }) => {
    ensureDemoApp('bookinfo');
    const traces = await waitForTracesViaApi(request, 'service', 'bookinfo', 'details');
    await serviceDetailsPage.open('bookinfo', 'details');
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTrace(page, traces[0]?.traceID);
    await expectTraceDetails(page);
  });

  test('See span info after selecting service span', tracingOnly, async ({ page, request, serviceDetailsPage }) => {
    ensureDemoApp('bookinfo');
    const traces = await waitForTracesViaApi(request, 'service', 'bookinfo', 'details', 4);
    await serviceDetailsPage.open('bookinfo', 'details');
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTraceWithMinSpans(page, 4, traces[0]?.traceID);
    await expectSpanDetails(page);
  });
});
