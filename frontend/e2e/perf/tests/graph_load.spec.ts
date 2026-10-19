import { test } from '@playwright/test';
import { consoleUrl, graphReady, measureLoadTime } from '../utils/measure';
import { perfBaselines, perfParams } from '../utils/perfFixtures';

const SECTION = 'Graph page';

const graphQuery = {
  duration: perfParams.duration,
  graphType: perfParams.graphType,
  layout: perfParams.layout,
  refresh: perfParams.refresh,
  traffic: perfParams.traffic
};

test.describe('Graph performance tests', () => {
  test('Measures All Namespaces Graph load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.graphAll,
      name: 'All Namespaces Graph',
      ready: graphReady,
      section: SECTION,
      url: consoleUrl('graph/namespaces', { ...graphQuery, namespaces: perfParams.allNamespaces })
    });
  });

  test('Measures All Namespaces Graph Idle Nodes load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.graphAllIdle,
      name: 'All Namespaces Graph Idle Nodes',
      ready: graphReady,
      section: SECTION,
      url: consoleUrl('graph/namespaces', {
        ...graphQuery,
        idleNodes: 'true',
        namespaces: perfParams.allNamespaces
      })
    });
  });

  test('Measures Graph load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.graphSelected,
      name: 'Selected Namespaces Graph',
      ready: graphReady,
      section: SECTION,
      url: consoleUrl('graph/namespaces', { ...graphQuery, namespaces: perfParams.namespaces })
    });
  });
});
