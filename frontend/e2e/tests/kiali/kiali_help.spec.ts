import { test } from '../../fixtures/kialiFixtures';

const smokeCoreCaching = { tag: ['@smoke', '@core-caching'] as const };

test.describe('Kiali help dropdown', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
    await overviewPage.openHelpMenu();
  });

  test('Open Kiali help dropdown', smokeCoreCaching, async ({ overviewPage }) => {
    await overviewPage.expectHelpMenuOptions(['Documentation', 'View Debug Info', 'About']);
  });

  test('User opens the View Debug Info section', smokeCoreCaching, async ({ overviewPage }) => {
    await overviewPage.openHelpMenuItem('View Debug Info');
    await overviewPage.expectModalTitle('Debug information');
    await overviewPage.expectDebugInfoClusterCount(1);
  });
});
