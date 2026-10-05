import { test } from '../../fixtures/kialiFixtures';
import { getAuthStrategy } from '../../utils/auth-strategy';
import { skipUnlessHealthyIstioComponents } from '../../utils/istioStatus';
import { cluster1Context, EAST, scaleDeploymentOnContext } from '../../utils/multiCluster';
import { multiClusterOnly } from '../../utils/suite-tags';

test.describe('Overview and masthead multi-cluster', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test('Debug info shows 2 clusters', multiClusterOnly, async ({ overviewPage }) => {
    await overviewPage.open();
    await overviewPage.openHelpMenu();
    await overviewPage.openHelpMenuItem('View Debug Info');
    await overviewPage.expectModalTitle('Debug information');
    await overviewPage.expectDebugInfoClusterCount(2);
  });

  test('No Istio component status alerts', multiClusterOnly, async ({ overviewPage, request }) => {
    await overviewPage.open();
    await skipUnlessHealthyIstioComponents(request);
    await overviewPage.refreshAndExpectNoIstioComponentStatus();
  });

  test('Masthead cluster label healthy for east/west', multiClusterOnly, async ({ overviewPage }) => {
    await overviewPage.open();
    await overviewPage.expectClusterLabelWithIcon(EAST, 'success');
    await overviewPage.hoverClusterLabelWithIcon('success');
    await overviewPage.expectComponentStatusTooltipContains(EAST, 'west');
    await overviewPage.expectComponentStatusTooltipExcludes('Not', 'Unreachable');
  });

  test('Masthead warning when grafana scaled down', multiClusterOnly, async ({ overviewPage }) => {
    try {
      scaleDeploymentOnContext(cluster1Context(), 'istio-system', 'grafana', 0);
      await overviewPage.open();
      await overviewPage.expectClusterLabelWithIcon(EAST, 'warning');
      await overviewPage.hoverClusterLabelWithIcon('warning');
      await overviewPage.expectComponentStatusTooltipContains('Unreachable');
    } finally {
      scaleDeploymentOnContext(cluster1Context(), 'istio-system', 'grafana', 1);
    }
    await overviewPage.open();
    await overviewPage.expectClusterLabelWithIcon(EAST, 'success');
    await overviewPage.hoverClusterLabelWithIcon('success');
    await overviewPage.expectComponentStatusTooltipExcludes('Not', 'Unreachable');
  });

  test('Clusters card shows unhealthy clusters when istiod scaled down', multiClusterOnly, async ({ overviewPage }) => {
    try {
      scaleDeploymentOnContext(cluster1Context(), 'istio-system', 'istiod', 0);
      await overviewPage.open();
      await overviewPage.expectUnhealthyClusters();
      await overviewPage.openClustersIssuesPopover();
      await overviewPage.expectClustersPopoverShowsIssues();
    } finally {
      scaleDeploymentOnContext(cluster1Context(), 'istio-system', 'istiod', 1);
    }
    await overviewPage.open();
    await overviewPage.expectAllClustersHealthy();
  });

  test('OpenShift dual-cluster login is skipped on anonymous', multiClusterOnly, async ({ page }) => {
    const strategy = await getAuthStrategy(page);
    test.skip(strategy !== 'openshift', 'Dual-cluster OpenShift login requires openshift auth');
  });
});
