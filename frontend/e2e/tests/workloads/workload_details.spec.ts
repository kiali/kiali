import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { coreCachingOnly } from '../../utils/suite-tags';

test.describe('Workload details core-caching', () => {
  test.beforeEach(async ({ workloadDetailsPage }) => {
    ensureDemoApp('bookinfo');
    await workloadDetailsPage.open('bookinfo', 'details-v1');
  });

  test('See details for workload', coreCachingOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.expectWorkloadDetails();
    await workloadDetailsPage.expectResourcesCard();
    await workloadDetailsPage.expectPodsCard();
    await workloadDetailsPage.expectIstioConfigCard();
    await workloadDetailsPage.expectLabelsCard();
    await workloadDetailsPage.expectAnnotationsCard();
  });

  test('See workload traffic information', coreCachingOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.expectTrafficInformation();
  });

  test('See workload Inbound Metrics', coreCachingOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.expectInboundMetrics();
  });

  test('See workload Outbound Metrics', coreCachingOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.expectOutboundMetrics();
  });

  test('See Envoy clusters configuration for a workload', coreCachingOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.filterEnvoyTab('Port', '9080', 'Clusters');
    await workloadDetailsPage.expectClustersTable();
  });

  test('See Envoy listeners configuration for a workload', coreCachingOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.filterEnvoyTab('Destination', '9090', 'Listeners');
    await workloadDetailsPage.expectListenersTable();
  });

  test('See Envoy routes configuration for a workload', coreCachingOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.filterEnvoyTab('Domains', 'details', 'Routes');
    await workloadDetailsPage.expectRoutesTable();
  });

  test('See Envoy bootstrap configuration for a workload', coreCachingOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.openBootstrapTab();
    await workloadDetailsPage.expectBootstrapEditor();
  });

  test('See Envoy config configuration for a workload', coreCachingOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.openConfigTab();
    await workloadDetailsPage.expectConfigEditor();
  });

  test('See Envoy metrics for a workload', coreCachingOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.expectEnvoyMetrics();
  });
});
