import { expect, test, type Page } from '@playwright/test';
import { consoleUrl, measureLoadTime } from '../utils/measure';
import { perfBaselines } from '../utils/perfFixtures';

const SECTION = 'Overview page';

const OVERVIEW_CARDS = [
  'control-planes-card',
  'clusters-card',
  'data-planes-card',
  'apps-card',
  'service-insights-card'
];

/** Overview is loaded once every summary card has rendered. */
const overviewReady = async (page: Page): Promise<void> => {
  for (const card of OVERVIEW_CARDS) {
    await expect(page.getByTestId(card)).toBeVisible();
  }
};

test.describe('Overview performance tests', () => {
  test('Measures Overview page load time', async ({ page }, testInfo) => {
    await measureLoadTime(page, testInfo, {
      baseline: perfBaselines.overview,
      name: 'Init page',
      ready: overviewReady,
      section: SECTION,
      url: consoleUrl('overview', { refresh: '0' })
    });
  });
});
