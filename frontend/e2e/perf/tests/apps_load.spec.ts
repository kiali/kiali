import { test } from '@playwright/test';
import { consoleUrl, detailsReady, listReady, measureLoadTime } from '../utils/measure';
import { perfBaselines, perfParams } from '../utils/perfFixtures';

const LIST_SECTION = 'Apps List page';
const DETAILS_SECTION = 'App details page';

const listQuery = { duration: perfParams.duration, refresh: perfParams.refresh };

const detailsQuery = {
  duration: perfParams.duration,
  rangeDuration: perfParams.rangeDuration,
  refresh: perfParams.refresh
};

const detailsPath = `namespaces/${perfParams.detailsNs}/applications/${perfParams.applicationName}`;

const detailsUrls: [string, string][] = [
  ['App Overview', consoleUrl(detailsPath, detailsQuery)],
  ['App Traffic', consoleUrl(detailsPath, { ...detailsQuery, tab: 'traffic' })],
  ['App Inbound Metrics', consoleUrl(detailsPath, { ...detailsQuery, tab: 'in_metrics' })],
  ['App Outbound Metrics', consoleUrl(detailsPath, { ...detailsQuery, tab: 'out_metrics' })],
  ['App Traces', consoleUrl(detailsPath, { ...detailsQuery, tab: 'traces' })]
];

test.describe('Apps performance tests', () => {
  test('Measures All Namespaces Apps load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.appListAll,
      name: 'All Namespaces Apps',
      ready: listReady,
      section: LIST_SECTION,
      url: consoleUrl('applications/namespaces', { ...listQuery, namespaces: perfParams.allNamespaces })
    });
  });

  test('Measures Apps load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.appListSelected,
      name: 'Selected Namespaces Apps',
      ready: listReady,
      section: LIST_SECTION,
      url: consoleUrl('applications/namespaces', { ...listQuery, namespaces: perfParams.namespaces })
    });
  });

  test('Measures App details load time', async ({ page }, testInfo) => {
    for (const [name, url] of detailsUrls) {
      await measureLoadTime(page, testInfo, {
        baseline: perfBaselines.appDetails,
        name,
        ready: detailsReady,
        section: DETAILS_SECTION,
        url
      });
    }
  });
});
