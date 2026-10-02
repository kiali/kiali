import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { tracingOnly } from '../../utils/suite-tags';
import { enableSpansInLogs, expectLogPaneShowsSpans } from '../../utils/tracingHelpers';

test.describe('Workload logs spans', () => {
  test.describe.configure({ timeout: 180_000 });

  test('The log pane of the logs tab should show spans', tracingOnly, async ({ page, workloadDetailsPage }) => {
    ensureDemoApp('bookinfo');
    await workloadDetailsPage.openLogsTab('bookinfo', 'ratings-v1');
    await enableSpansInLogs(page);
    await expectLogPaneShowsSpans(page);
  });
});
