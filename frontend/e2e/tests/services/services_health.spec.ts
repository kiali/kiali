import { test } from '../../fixtures/kialiFixtures';
import { waitForServiceHealthStatus } from '../../utils/health';
import { core2 } from '../../utils/suite-tags';

test.describe('Services list health statuses', () => {
  test('The idle status of a service is reported in the list of services', core2, async ({ servicesPage }) => {
    await servicesPage.openListWithNamespace('sleep');
    await servicesPage.expectServiceListedAs('sleep', 'sleep', 'na');
    await servicesPage.expectServiceHealthStatus('sleep', 'sleep', 'n/a');
  });
});

test.describe('Services list error-rates health statuses', () => {
  test(
    'The failing status of a service is reported in the list of services',
    core2,
    async ({ servicesPage, request }) => {
      await waitForServiceHealthStatus(request, 'alpha', 'w-server', 'Failure');
      await servicesPage.openListWithNamespace('alpha');
      await servicesPage.expectServiceListedAs('alpha', 'w-server', 'failure');
      await servicesPage.expectServiceHealthStatus('alpha', 'w-server', 'Failure');
    }
  );

  test(
    'The degraded status of a service is reported in the list of services',
    core2,
    async ({ servicesPage, request }) => {
      await waitForServiceHealthStatus(request, 'alpha', 'y-server', 'Degraded');
      await servicesPage.openListWithNamespace('alpha');
      await servicesPage.expectServiceListedAs('alpha', 'y-server', 'degraded');
      await servicesPage.expectServiceHealthStatus('alpha', 'y-server', 'Degraded');
    }
  );
});
