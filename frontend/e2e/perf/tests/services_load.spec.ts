import { test } from '@playwright/test';
import { consoleUrl, detailsReady, listReady, measureLoadTime } from '../utils/measure';
import { perfBaselines, perfParams } from '../utils/perfFixtures';

const LIST_SECTION = 'Services List page';
const DETAILS_SECTION = 'Service details page';

const listQuery = { duration: perfParams.duration, refresh: perfParams.refresh };

const detailsQuery = {
  duration: perfParams.duration,
  rangeDuration: perfParams.rangeDuration,
  refresh: perfParams.refresh
};

const detailsPath = `namespaces/${perfParams.detailsNs}/services/${perfParams.serviceName}`;

const detailsUrls: [string, string][] = [
  ['Service Overview', consoleUrl(detailsPath, detailsQuery)],
  ['Service Traffic', consoleUrl(detailsPath, { ...detailsQuery, tab: 'traffic' })],
  ['Service Inbound Metrics', consoleUrl(detailsPath, { ...detailsQuery, tab: 'in_metrics' })],
  ['Service Traces', consoleUrl(detailsPath, { ...detailsQuery, tab: 'traces' })]
];

test.describe('Services performance tests', () => {
  test('Measures All Namespaces Services load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.serviceListAll,
      name: 'All Namespaces Services',
      ready: listReady,
      section: LIST_SECTION,
      url: consoleUrl('services/namespaces', { ...listQuery, namespaces: perfParams.allNamespaces })
    });
  });

  test('Measures Services load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.serviceListSelected,
      name: 'Selected Namespaces Services',
      ready: listReady,
      section: LIST_SECTION,
      url: consoleUrl('services/namespaces', { ...listQuery, namespaces: perfParams.namespaces })
    });
  });

  test('Measures Service details load time', async ({ page }, testInfo) => {
    for (const [name, url] of detailsUrls) {
      await measureLoadTime(page, testInfo, {
        baseline: perfBaselines.serviceDetails,
        name,
        ready: detailsReady,
        section: DETAILS_SECTION,
        url
      });
    }
  });
});
