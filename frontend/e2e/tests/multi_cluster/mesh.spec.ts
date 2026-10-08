import { test } from '../../fixtures/kialiFixtures';
import { EAST, WEST } from '../../utils/multiCluster';
import { multiClusterOnly } from '../../utils/suite-tags';

test.describe('Mesh multi-cluster primary-remote', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ meshPage }) => {
    await meshPage.open();
  });

  test('Primary-remote dataplane and istiod topology', multiClusterOnly, async ({ meshPage }) => {
    await meshPage.expectInfraNodeCount('dataplane', EAST, 1);
    await meshPage.expectInfraNodeCount('dataplane', WEST, 1);
    await meshPage.expectInfraNodeCount('istiod', EAST, 1);
    await meshPage.expectInfraConnectedTo('istiod', 'dataplane', 2);
  });

  test('East istio-system namespace panel shows control plane donut', multiClusterOnly, async ({ meshPage }) => {
    await meshPage.selectMeshNodeByLabel('istio-system', EAST);
    await meshPage.expectNamespaceSidePanel('istio-system');
    await meshPage.expectControlPlaneDonutInNamespacePanel();
  });

  test('West cluster managed by remote east control plane', multiClusterOnly, async ({ meshPage }) => {
    await meshPage.selectClusterNodeOnCluster(WEST);
    await meshPage.expectManagedByRemoteControlPlane(EAST);
  });
});
