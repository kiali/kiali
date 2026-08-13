import { test } from '../../fixtures/kialiFixtures';
import { smokeAndCoreCaching } from '../../utils/suite-tags';

test.describe('Services list toggles', () => {
  test.beforeEach(async ({ servicesPage }) => {
    await servicesPage.openList();
  });

  test('See all Services toggles', smokeAndCoreCaching, async ({ servicesPage }) => {
    await servicesPage.expectAllTogglesChecked();
  });

  test('Toggle Services configuration toggle', smokeAndCoreCaching, async ({ servicesPage }) => {
    await servicesPage.setToggle('configuration', false);
    await servicesPage.expectColumn('Configuration', false);

    await servicesPage.setToggle('configuration', true);
    await servicesPage.expectColumn('Configuration', true);
  });
});
