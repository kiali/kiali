import { test } from '../../fixtures/kialiFixtures';
import { hasLoggersNamespace } from '../../utils/kialiConfig';
import { core2 } from '../../utils/suite-tags';

test.describe('Workload logs tab', () => {
  test.beforeEach(() => {
    test.skip(!hasLoggersNamespace(), 'loggers demo namespace is not installed (install via install-testing-demos.sh)');
  });

  test(
    'The log pane of the logs tab should only show the lines with the requested text',
    core2,
    async ({ workloadDetailsPage }) => {
      await workloadDetailsPage.openLogsTab('loggers', 'custom-logger');
      await workloadDetailsPage.setLogShow('GET');
      await workloadDetailsPage.expectLogLinesContain('GET');
    }
  );

  test(
    'The log pane of the logs tab should hide the lines with the requested text',
    core2,
    async ({ workloadDetailsPage }) => {
      await workloadDetailsPage.openLogsTab('loggers', 'custom-logger');
      await workloadDetailsPage.setLogHide('GET');
      await workloadDetailsPage.expectLogLinesNotContain('GET');
    }
  );

  test(
    'The log pane of the logs tab should show json log lines with a json log indicator',
    core2,
    async ({ workloadDetailsPage }) => {
      await workloadDetailsPage.openLogsTab('loggers', 'json-logger');
      await workloadDetailsPage.setLogHide('text log format');
      await workloadDetailsPage.expectJsonLogLines();
    }
  );

  test('The json log should contain certain values on the parsed object', core2, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.openLogsTab('loggers', 'json-logger');
    await workloadDetailsPage.setLogHide('text log format');
    await workloadDetailsPage.clickJsonLogLine();
    await workloadDetailsPage.expectParsedJsonValues();
  });
});
