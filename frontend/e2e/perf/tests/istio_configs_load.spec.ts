import { test } from '@playwright/test';
import { consoleUrl, detailsReady, listReady, measureLoadTime } from '../utils/measure';
import { perfBaselines, perfParams } from '../utils/perfFixtures';

const LIST_SECTION = 'Istio Configs List page';
const DETAILS_SECTION = 'Istio Config details page';

const detailsPath = [
  'namespaces',
  perfParams.detailsNs,
  'istio',
  perfParams.configGroup,
  perfParams.configVersion,
  perfParams.configKind,
  perfParams.configName
].join('/');

test.describe('Istio Configs performance tests', () => {
  test('Measures All Namespaces Istio Configs load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.configListAll,
      name: 'All Namespaces Istio Configs',
      ready: listReady,
      section: LIST_SECTION,
      url: consoleUrl('istio', { namespaces: perfParams.allNamespaces })
    });
  });

  test('Measures Istio Configs load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.configListSelected,
      name: 'Selected Namespaces Istio Configs',
      ready: listReady,
      section: LIST_SECTION,
      url: consoleUrl('istio', { namespaces: perfParams.namespaces })
    });
  });

  test('Measures Istio Config details load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.configDetails,
      name: 'Istio Config Overview',
      ready: detailsReady,
      section: DETAILS_SECTION,
      url: consoleUrl(detailsPath)
    });
  });
});
