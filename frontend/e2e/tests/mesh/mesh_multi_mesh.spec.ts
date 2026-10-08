import { test } from '../../fixtures/kialiFixtures';
import { multiMeshOnly } from '../../utils/suite-tags';

test.describe('Mesh page multi-mesh', () => {
  test.beforeEach(async ({ meshPage }) => {
    await meshPage.open();
  });

  test('mesh panel shows correct mesh count in tabs', multiMeshOnly, async ({ meshPage }) => {
    await meshPage.expectMeshSidePanel();
    await meshPage.expectMeshTabCountMatchesControlPlanes();
  });

  test('single mesh infra summary shows control planes', multiMeshOnly, async ({ meshPage }) => {
    await meshPage.expectMeshSidePanel();
    await meshPage.expectMeshBodyNotContains('dataplane namespaces: 0');
  });

  test('control plane summary shows cluster name', multiMeshOnly, async ({ meshPage }) => {
    await meshPage.expectMeshSidePanel();
    await meshPage.expectControlPlaneSummaryClusterNames();
  });
});
