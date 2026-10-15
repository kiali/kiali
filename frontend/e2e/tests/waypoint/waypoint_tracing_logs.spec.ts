import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { waypointTracingOnly } from '../../utils/suite-tags';
import { enableSpansInLogs, expectLogPaneShowsSpans } from '../../utils/tracingHelpers';

test.describe('Waypoint tracing workload logs', () => {
  // 240s so the 180s waitForTracesViaApi poll fires before the test timeout and
  // its informative error (list size / status) reaches the JUnit report instead of a
  // generic test timeout.
  test.describe.configure({ timeout: 240_000 });

  test('The log pane of the logs tab should show spans', waypointTracingOnly, async ({ page, workloadDetailsPage }) => {
    ensureDemoApp('bookinfo');
    await workloadDetailsPage.openLogsTab('bookinfo', 'ratings-v1');
    await enableSpansInLogs(page);
    await expectLogPaneShowsSpans(page);
  });
});
