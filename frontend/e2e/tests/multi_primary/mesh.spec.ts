import { test } from '../../fixtures/kialiFixtures';
import { EAST, WEST } from '../../utils/multiCluster';
import { multiPrimaryOnly } from '../../utils/suite-tags';

test.describe('Mesh multi-primary', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ meshPage }) => {
    await meshPage.open();
  });

  test('One dataplane and one controlplane per cluster with edges', multiPrimaryOnly, async ({ meshPage }) => {
    await meshPage.expectInfraNodeCount('dataplane', EAST, 1);
    await meshPage.expectInfraNodeCount('dataplane', WEST, 1);
    await meshPage.expectInfraNodeCount('istiod', EAST, 1);
    await meshPage.expectInfraNodeCount('istiod', WEST, 1);
    await meshPage.expectIstiodDataplaneEdgesPerCluster();
  });

  test('Each namespace panel shows only its own control plane donut', multiPrimaryOnly, async ({ meshPage }) => {
    await meshPage.selectMeshNodeByLabel('istio-system', EAST);
    await meshPage.expectNamespaceSidePanel('istio-system');
    await meshPage.expectControlPlaneDonutInNamespacePanel();
    await meshPage.expectNamespacePanelOwnControlPlane(EAST);
  });

  test('Namespace panel shows correct cluster badge', multiPrimaryOnly, async ({ meshPage }) => {
    await meshPage.selectMeshNodeByLabel('istio-system', WEST);
    await meshPage.expectNamespaceSidePanel('istio-system');
    await meshPage.expectNamespacePanelClusterBadge(WEST);
  });

  test('No ambient badge on sidecar control planes', multiPrimaryOnly, async ({ meshPage }) => {
    await meshPage.selectNonAmbientIstiod();
    await meshPage.expectControlPlaneAmbientBadge(false);
  });
});
