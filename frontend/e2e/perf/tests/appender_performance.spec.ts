import { test } from '@playwright/test';
import { consoleUrl, graphReady, measureLoadTime } from '../utils/measure';
import { perfBaselines, perfParams } from '../utils/perfFixtures';

const SECTION = 'Graph Appender Performance - Issue #8524';

const graphQuery = {
  duration: perfParams.duration,
  graphType: perfParams.graphType,
  layout: perfParams.layout,
  namespaces: perfParams.namespaces,
  refresh: perfParams.refresh,
  traffic: perfParams.traffic
};

const appenderUrl = (appenders: string[]): string =>
  consoleUrl('graph/namespaces', { ...graphQuery, appenders: appenders.join(',') });

test.describe('Graph Appender performance tests - Issue #8524', () => {
  test('Measures Issue Baseline (Full List) load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.graphIssueBaseline,
      name: 'Issue Baseline (Full List)',
      ready: graphReady,
      section: SECTION,
      url: appenderUrl(['deadNode', 'istio', 'serviceEntry', 'meshCheck', 'workloadEntry', 'health'])
    });
  });

  test('Measures Without Istio (Test Fix) load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.graphWithoutIstio,
      name: 'Without Istio (Test Fix)',
      ready: graphReady,
      section: SECTION,
      url: appenderUrl(['deadNode', 'serviceEntry', 'meshCheck', 'workloadEntry', 'health'])
    });
  });

  test('Measures Only Istio (Isolate Problem) load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.graphOnlyIstio,
      name: 'Only Istio (Isolate Problem)',
      ready: graphReady,
      section: SECTION,
      url: appenderUrl(['istio'])
    });
  });

  test('Measures Core Appenders Only load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.graphCore,
      name: 'Core Appenders Only',
      ready: graphReady,
      section: SECTION,
      url: appenderUrl(['deadNode', 'serviceEntry'])
    });
  });
});
