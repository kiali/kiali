import { test } from '../../fixtures/kialiFixtures';

test.describe('Kiali help dropdown', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
    await overviewPage.openHelpMenu();
  });

  test('Open Kiali help dropdown @smoke @core-caching', async ({ overviewPage }) => {
    await overviewPage.expectHelpMenuOptions(['Documentation', 'View Debug Info', 'About']);
  });

  test('User opens the View Debug Info section @smoke @core-caching', async ({ overviewPage }) => {
    await overviewPage.openHelpMenuItem('View Debug Info');
    await overviewPage.expectModalTitle('Debug information');
    await overviewPage.expectDebugInfoClusterCount(1);
  });
});
