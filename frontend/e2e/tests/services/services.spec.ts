import { test } from '../../fixtures/kialiFixtures';

/**
 * Migrated from cypress/integration/featureFiles/services.feature (@smoke scenarios).
 */
test.describe('Services list toggles', () => {
  test.beforeEach(async ({ servicesPage }) => {
    await servicesPage.openList();
  });

  test('See all Services toggles @smoke @core-caching', async ({ servicesPage }) => {
    await servicesPage.expectAllTogglesChecked();
  });

  test('Toggle Services configuration toggle @smoke @core-caching', async ({ servicesPage }) => {
    await servicesPage.setToggle('configuration', false);
    await servicesPage.expectColumn('Configuration', false);

    await servicesPage.setToggle('configuration', true);
    await servicesPage.expectColumn('Configuration', true);
  });
});
