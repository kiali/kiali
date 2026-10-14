import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { waypointTracingOnly } from '../../utils/suite-tags';

test.describe('Mesh waypoint tracing', () => {
  test.describe.configure({ timeout: 180_000 });

  test('User enables waypoints', waypointTracingOnly, async ({ meshPage }) => {
    ensureDemoApp('bookinfo');
    await meshPage.open();
    await meshPage.toggleMeshDisplayMenu(true);
    await meshPage.setMeshDisplayOption('waypoints', true);
    await meshPage.toggleMeshDisplayMenu(false);
    await meshPage.selectMeshNodeByLabel('waypoint');
    await meshPage.expectNodeSidePanel('waypoint');
  });

  test('Test ztunnel', waypointTracingOnly, async ({ meshPage }) => {
    await meshPage.open();
    await meshPage.selectMeshNodeByLabel('ztunnel', undefined, 'infra');
    await meshPage.expectNodeSidePanel('ztunnel');
  });
});
