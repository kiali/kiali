import { test } from '../../fixtures/kialiFixtures';
import { ambientMultiPrimaryOnly } from '../../utils/suite-tags';

test.describe('Ambient multi-primary', () => {
  test('Graph shows ambient workloads across clusters', ambientMultiPrimaryOnly, async ({ graphPage }) => {
    test.setTimeout(180_000);
    await graphPage.graphNamespaces('bookinfo', '0', '600s');
    await graphPage.selectGraphType('WORKLOAD');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
    await graphPage.openTrafficMenu();
    await graphPage.setTrafficOption('http', false);
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficEdgesAtLeast(7);
    await graphPage.expectWorkloadClustersAtLeast(2);
  });

  test('Ambient badge shown on ambient control planes', ambientMultiPrimaryOnly, async ({ meshPage }) => {
    await meshPage.open();
    await meshPage.selectAmbientIstiod();
    await meshPage.expectControlPlaneAmbientBadge(true);
  });

  test('Mesh page shows ambient control planes in both clusters', ambientMultiPrimaryOnly, async ({ meshPage }) => {
    await meshPage.open();
    await meshPage.expectClusterCount(2);
    await meshPage.expectZtunnelInBothClusters();
    await meshPage.expectAmbientDataPlanesInBothClusters();
  });

  test('See ambient label for service', ambientMultiPrimaryOnly, async ({ serviceDetailsPage }) => {
    await serviceDetailsPage.open('bookinfo', 'productpage');
    await serviceDetailsPage.expectAmbientBadge();
  });

  test('Services page shows ambient services across clusters', ambientMultiPrimaryOnly, async ({ servicesPage }) => {
    await servicesPage.openListWithNamespace('bookinfo');
    await servicesPage.expectServiceFromCluster('productpage', 'east', 'bookinfo');
    await servicesPage.expectServiceFromCluster('productpage', 'west', 'bookinfo');
  });

  test(
    'Workloads page shows ambient workloads from both clusters',
    ambientMultiPrimaryOnly,
    async ({ workloadsPage }) => {
      await workloadsPage.openListWithNamespace('bookinfo');
      await workloadsPage.expectWorkloadFromCluster('productpage-v1', 'east', 'bookinfo');
      await workloadsPage.expectWorkloadFromCluster('productpage-v1', 'west', 'bookinfo');
    }
  );

  test('See ambient label for workload', ambientMultiPrimaryOnly, async ({ workloadDetailsPage }) => {
    await workloadDetailsPage.open('bookinfo', 'details-v1');
    await workloadDetailsPage.expectAmbientBadge();
    await workloadDetailsPage.expectMissingSidecarBadge(false, 'bookinfo', 'details-v1');
  });
});
