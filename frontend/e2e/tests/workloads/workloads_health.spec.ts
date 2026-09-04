import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { kubectlNamespaceExists, kubectlScale } from '../../utils/kubectl';
import { waitForWorkloadHealthStatus } from '../../utils/health';
import { core2 } from '../../utils/suite-tags';

test.describe('Workloads list idle health', () => {
  test.afterEach(() => {
    if (kubectlNamespaceExists('sleep')) {
      try {
        kubectlScale('sleep', 'sleep', 1);
      } catch {
        // Best-effort restore after scale-down; ignore if deployment is already scaled.
      }
    }
  });

  test(
    'The idle status of a workload is reported in the list of workloads',
    core2,
    async ({ workloadsPage, request }) => {
      ensureDemoApp('sleep');
      kubectlScale('sleep', 'sleep', 0);
      await waitForWorkloadHealthStatus(request, 'sleep', 'sleep', 'Not Ready');
      await workloadsPage.openListWithNamespace('sleep');
      await workloadsPage.expectWorkloadListedAs('sleep', 'sleep', 'idle');
      await workloadsPage.expectWorkloadHealthStatus('sleep', 'sleep', 'Not Ready');
    }
  );
});

test.describe('Workloads list error-rates health statuses', () => {
  test(
    'The failing status of a workload is reported in the list of workloads',
    core2,
    async ({ workloadsPage, request }) => {
      await waitForWorkloadHealthStatus(request, 'alpha', 'v-server', 'Failure');
      await workloadsPage.openListWithNamespace('alpha');
      await workloadsPage.expectWorkloadListedAs('alpha', 'v-server', 'failure');
      await workloadsPage.expectWorkloadHealthStatus('alpha', 'v-server', 'Failure');
    }
  );

  test(
    'The degraded status of a workload is reported in the list of workloads',
    core2,
    async ({ workloadsPage, request }) => {
      await waitForWorkloadHealthStatus(request, 'alpha', 'b-client', 'Degraded');
      await workloadsPage.openListWithNamespace('alpha');
      await workloadsPage.expectWorkloadListedAs('alpha', 'b-client', 'degraded');
      await workloadsPage.expectWorkloadHealthStatus('alpha', 'b-client', 'Degraded');
    }
  );
});
