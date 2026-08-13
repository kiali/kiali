import { test } from '../../fixtures/kialiFixtures';

const smokeCoreCaching = { tag: ['@smoke', '@core-caching'] as const };

test.describe('Services list toggles', () => {
  test.beforeEach(async ({ servicesPage }) => {
    await servicesPage.openList();
  });

  test('See all Services toggles', smokeCoreCaching, async ({ servicesPage }) => {
    await servicesPage.expectAllTogglesChecked();
  });

  test('Toggle Services configuration toggle', smokeCoreCaching, async ({ servicesPage }) => {
    await servicesPage.setToggle('configuration', false);
    await servicesPage.expectColumn('Configuration', false);

    await servicesPage.setToggle('configuration', true);
    await servicesPage.expectColumn('Configuration', true);
  });
});
