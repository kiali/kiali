import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { waypointTracingOnly } from '../../utils/suite-tags';

test.describe('Mesh waypoint tracing', () => {
  // 240s so the 180s waitForTracesViaApi poll fires before the test timeout and
  // its informative error (list size / status) reaches the JUnit report instead of a
  // generic test timeout.
  test.describe.configure({ timeout: 240_000 });

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
