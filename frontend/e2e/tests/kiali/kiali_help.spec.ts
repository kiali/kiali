import { test } from '../../fixtures/kialiFixtures';
import { smokeAndCoreCaching } from '../../utils/suite-tags';

test.describe('Kiali help dropdown', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
    await overviewPage.openHelpMenu();
  });

  test('Open Kiali help dropdown', smokeAndCoreCaching, async ({ overviewPage }) => {
    await overviewPage.expectHelpMenuOptions(['Documentation', 'View Debug Info', 'About']);
  });

  test('User opens the View Debug Info section', smokeAndCoreCaching, async ({ overviewPage }) => {
    await overviewPage.openHelpMenuItem('View Debug Info');
    await overviewPage.expectModalTitle('Debug information');
    await overviewPage.expectDebugInfoClusterCount(1);
  });
});
