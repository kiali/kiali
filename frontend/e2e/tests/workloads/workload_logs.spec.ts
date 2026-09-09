import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { hasLoggersNamespace } from '../../utils/kialiConfig';
import { core2, coreCachingOnly } from '../../utils/suite-tags';

test.describe('Workload logs tab core-caching', () => {
  test('The logs tab should show the logs of a pod', coreCachingOnly, async ({ workloadDetailsPage }) => {
    ensureDemoApp('bookinfo');
    await workloadDetailsPage.open('bookinfo', 'ratings-v1');
    await workloadDetailsPage.goToLogsTab();
    await workloadDetailsPage.expectContainerListed('sidecar-proxy');
    await workloadDetailsPage.expectContainerListed('ratings');
    await workloadDetailsPage.expectContainerChecked('container-sidecar-proxy');
    await workloadDetailsPage.expectContainerChecked('container-ratings');
    await workloadDetailsPage.expectPodSelected('ratings-v1');
  });

  test(
    'The log pane of the logs tab should limit the number of log lines that are fetched',
    coreCachingOnly,
    async ({ workloadDetailsPage }) => {
      ensureDemoApp('bookinfo');
      await workloadDetailsPage.openLogsTab('bookinfo', 'ratings-v1');
      await workloadDetailsPage.setMaxLogLines(100);
      await workloadDetailsPage.expectLogLineCountAtMost(100);
    }
  );

  test(
    'The log pane of the logs tab should only show logs for the selected container',
    coreCachingOnly,
    async ({ workloadDetailsPage }) => {
      ensureDemoApp('bookinfo');
      await workloadDetailsPage.openLogsTab('bookinfo', 'ratings-v1');
      await workloadDetailsPage.selectOnlyContainer('ratings');
      await workloadDetailsPage.expectLogsOnlyForContainer('ratings');
    }
  );
});

test.describe('Workload logs tab core-2', () => {
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
