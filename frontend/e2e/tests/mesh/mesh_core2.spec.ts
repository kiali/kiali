import { test } from '../../fixtures/kialiFixtures';
import { hasGrafanaDeployment, hasSailIstioCr } from '../../utils/kialiConfig';
import { kubectlScaleDeployment } from '../../utils/kubectl';
import { applySharedMeshConfig, restoreSharedMeshConfig } from '../../utils/sharedMeshConfig';
import { core2 } from '../../utils/suite-tags';

test.describe('Mesh page core-2', () => {
  test.afterEach(() => {
    try {
      kubectlScaleDeployment('istio-system', 'grafana', 1);
    } catch {
      // Best-effort restore after Grafana upscale test (matches Cypress @component-health-upscale).
    }
  });

  test('Grafana Infra unreachable', core2, async ({ meshPage }) => {
    test.skip(!hasGrafanaDeployment(), 'Grafana deployment is not installed in istio-system');

    await meshPage.open();
    await meshPage.selectMeshNodeByLabel('Grafana');
    await meshPage.expectNodeSidePanel('Grafana');
    test.skip(
      await meshPage.usesLocalGrafanaPortForward(),
      'Grafana uses a local port-forward URL; scaling the deployment does not make it unreachable locally'
    );

    kubectlScaleDeployment('istio-system', 'grafana', 0);
    await meshPage.refreshPage();
    await meshPage.waitForInfraHealth('Grafana', health => health !== 'Healthy');
    await meshPage.selectMeshNodeByLabel('Grafana');
    await meshPage.expectNodeSidePanel('Grafana');
    await meshPage.expectSidePanelContains('Version: unknown');
    await meshPage.expectSidePanelIcon('error');

    kubectlScaleDeployment('istio-system', 'grafana', 1);
    await meshPage.refreshPage();
    await meshPage.waitForInfraHealth('Grafana', health => health === 'Healthy');
    await meshPage.selectMeshNodeByLabel('Grafana');
    await meshPage.expectNodeSidePanel('Grafana');
    await meshPage.expectSidePanelIcon('correct');
    await meshPage.expectNoSidePanelIcon('error');
    await meshPage.expectNoSidePanelIcon('warning');
  });

  test('Shared mesh config is seen on istiod panel', core2, async ({ meshPage, request }) => {
    test.skip(!hasSailIstioCr(), 'Sail Istio CR is required for shared mesh config (@shared-mesh-config)');
    test.setTimeout(240_000);

    await applySharedMeshConfig(request);
    try {
      await meshPage.open();
      await meshPage.selectMeshNodeByLabel('istiod');
      await meshPage.expectControlPlaneSidePanel();
      await meshPage.expectConfigTabs('effective,standard,shared');
      await meshPage.expectConfigTabContains('effective', 'mode: REGISTRY_ONLY');
      await meshPage.expectConfigTabContains('shared', 'mode: REGISTRY_ONLY');
      await meshPage.expectConfigTabNotContains('standard', 'mode: REGISTRY_ONLY');
    } finally {
      restoreSharedMeshConfig();
    }
  });
});
