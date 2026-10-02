import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { tracingOnly } from '../../utils/suite-tags';
import {
  expectSpanDetails,
  expectTraceDetails,
  expectTraceScatterplot,
  filterSpansByApp,
  openTracesTab,
  selectTrace,
  selectTraceWithMinSpans,
  waitForTracesViaApi
} from '../../utils/tracingHelpers';

test.describe('App details tracing', () => {
  test.describe.configure({ timeout: 180_000 });

  test('See tracing info after selecting a trace', tracingOnly, async ({ appDetailsPage, page, request }) => {
    ensureDemoApp('bookinfo');
    const traces = await waitForTracesViaApi(request, 'app', 'bookinfo', 'details');
    await appDetailsPage.openApp('bookinfo', 'details');
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTrace(page, traces[0]?.traceID);
    await expectTraceDetails(page);
  });

  test('See span info after selecting app span', tracingOnly, async ({ appDetailsPage, page, request }) => {
    ensureDemoApp('bookinfo');
    const traces = await waitForTracesViaApi(request, 'app', 'bookinfo', 'details', 6);
    await appDetailsPage.openApp('bookinfo', 'details');
    await openTracesTab(page);
    await expectTraceScatterplot(page);
    await selectTraceWithMinSpans(page, 6, traces[0]?.traceID);
    await expectSpanDetails(page);
    await filterSpansByApp(page, 'productpage');
  });
});
