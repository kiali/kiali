import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { coreCachingOnly } from '../../utils/suite-tags';

test.describe('Service details graph core-caching', () => {
  test.beforeEach(async ({ serviceDetailsPage }) => {
    ensureDemoApp('bookinfo');
    await serviceDetailsPage.open('bookinfo', 'productpage');
  });

  test('See service minigraph for details app', coreCachingOnly, async ({ serviceDetailsPage }) => {
    await serviceDetailsPage.expectMinigraphVisible();
  });

  test(
    'Verify that the Graph type dropdown is disabled when changing to Show node graph',
    coreCachingOnly,
    async ({ serviceDetailsPage }) => {
      await serviceDetailsPage.expectMinigraphVisible();
      await serviceDetailsPage.chooseShowNodeGraph();
      await serviceDetailsPage.expectGraphTypeDisabled();
    }
  );
});
