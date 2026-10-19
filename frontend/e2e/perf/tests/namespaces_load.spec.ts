import { test } from '@playwright/test';
import { consoleUrl, listReady, measureLoadTime } from '../utils/measure';
import { perfBaselines, perfParams } from '../utils/perfFixtures';

const LIST_SECTION = 'Namespaces List page';

const listQuery: [string, string][] = [
  ['duration', perfParams.duration],
  ['refresh', perfParams.refresh]
];

const unhealthyQuery: [string, string][] = [
  ...listQuery,
  ['health', 'Failure'],
  ['health', 'Not Ready'],
  ['health', 'Degraded'],
  ['opLabel', 'or']
];

test.describe('Namespaces performance tests', () => {
  test('Measures All Namespaces load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.namespaceListAll,
      name: 'All Namespaces',
      ready: listReady,
      section: LIST_SECTION,
      url: consoleUrl('namespaces', listQuery)
    });
  });

  test('Measures Unhealthy Namespaces load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.namespaceListUnhealthy,
      name: 'Unhealthy Namespaces',
      ready: listReady,
      section: LIST_SECTION,
      url: consoleUrl('namespaces', unhealthyQuery)
    });
  });
});
