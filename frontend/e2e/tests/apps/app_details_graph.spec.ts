import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { core1 } from '../../utils/suite-tags';

test.describe('App details graph', () => {
  test('See app minigraph for details app', core1, async ({ appDetailsPage }) => {
    ensureDemoApp('bookinfo');
    await appDetailsPage.openApp('bookinfo', 'details');
    await appDetailsPage.expectMinigraphVisible();
  });

  test('Application detail URL stays under applications after mini graph loads', core1, async ({ appDetailsPage }) => {
    ensureDemoApp('error-rates');
    await appDetailsPage.openApp('alpha', 'a-client');
    await appDetailsPage.expectMinigraphVisible();
    await appDetailsPage.expectUrlIncludes('a-client');
    await appDetailsPage.expectUrlIncludes('/applications/');
    await appDetailsPage.expectUrlExcludes('/workloads/');
  });
});
