import { test } from '@playwright/test';
import { consoleUrl, detailsReady, listReady, measureLoadTime } from '../utils/measure';
import { perfBaselines, perfParams } from '../utils/perfFixtures';

const LIST_SECTION = 'Workloads List page';
const DETAILS_SECTION = 'Workload details page';

const listQuery = { duration: perfParams.duration, refresh: perfParams.refresh };

const detailsQuery = {
  duration: perfParams.duration,
  rangeDuration: perfParams.rangeDuration,
  refresh: perfParams.refresh
};

const detailsPath = `namespaces/${perfParams.detailsNs}/workloads/${perfParams.workloadName}`;

const envoyUrl = (envoyTab: string): string => consoleUrl(detailsPath, { ...detailsQuery, envoyTab, tab: 'envoy' });

const detailsUrls: [string, string][] = [
  ['Workload Overview', consoleUrl(detailsPath, detailsQuery)],
  ['Workload Traffic', consoleUrl(detailsPath, { ...detailsQuery, tab: 'traffic' })],
  ['Workload Logs', consoleUrl(detailsPath, { ...detailsQuery, tab: 'logs' })],
  ['Workload Inbound Metrics', consoleUrl(detailsPath, { ...detailsQuery, tab: 'in_metrics' })],
  ['Workload Outbound Metrics', consoleUrl(detailsPath, { ...detailsQuery, tab: 'out_metrics' })],
  ['Workload Traces', consoleUrl(detailsPath, { ...detailsQuery, tab: 'traces' })],
  ['Workload Envoy Clusters', envoyUrl('clusters')],
  ['Workload Envoy Listeners', envoyUrl('listeners')],
  ['Workload Envoy Routes', envoyUrl('routes')],
  ['Workload Envoy Bootstrap', envoyUrl('bootstrap')],
  ['Workload Envoy Config', envoyUrl('config')],
  ['Workload Envoy Metrics', envoyUrl('metrics')]
];

test.describe('Workloads performance tests', () => {
  test('Measures All Namespaces Workloads load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.workloadListAll,
      name: 'All Namespaces Workloads',
      ready: listReady,
      section: LIST_SECTION,
      url: consoleUrl('workloads', { ...listQuery, namespaces: perfParams.allNamespaces })
    });
  });

  test('Measures Workloads load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.workloadListSelected,
      name: 'Selected Namespaces Workloads',
      ready: listReady,
      section: LIST_SECTION,
      url: consoleUrl('workloads', { ...listQuery, namespaces: perfParams.namespaces })
    });
  });

  test('Measures Workload details load time', async ({ page }, testInfo) => {
    for (const [name, url] of detailsUrls) {
      await measureLoadTime(page, testInfo, {
        baseline: perfBaselines.workloadDetails,
        name,
        ready: detailsReady,
        section: DETAILS_SECTION,
        url
      });
    }
  });
});
