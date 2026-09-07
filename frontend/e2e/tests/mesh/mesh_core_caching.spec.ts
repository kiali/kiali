import { test } from '../../fixtures/kialiFixtures';
import { hasGrafanaDeployment } from '../../utils/kialiConfig';
import { coreCachingOnly } from '../../utils/suite-tags';

const isOssmc = (): boolean => process.env.PLAYWRIGHT_OSSMC === 'true';

test.describe('Mesh page core-caching', () => {
  test.beforeEach(async ({ meshPage }) => {
    await meshPage.open();
  });

  test('Open mesh Tour', coreCachingOnly, async ({ meshPage }) => {
    await meshPage.openMeshTour();
    await meshPage.expectMeshTourVisible(true);
  });

  test('Close mesh Tour', coreCachingOnly, async ({ meshPage }) => {
    await meshPage.openMeshTour();
    await meshPage.closeMeshTour();
    await meshPage.expectMeshTourVisible(false);
  });

  test('See mesh', coreCachingOnly, async ({ meshPage }) => {
    await meshPage.expectMeshSidePanel();
    await meshPage.expectExpectedMeshInfra();
  });

  test('Test istiod', coreCachingOnly, async ({ meshPage }) => {
    await meshPage.selectMeshNodeByLabel('istiod');
    await meshPage.expectControlPlaneSidePanel();
  });

  test('Grafana Infra', coreCachingOnly, async ({ meshPage }) => {
    test.skip(!hasGrafanaDeployment(), 'Grafana deployment is not installed in istio-system');
    await meshPage.selectMeshNodeByLabel('Grafana');
    await meshPage.expectNodeSidePanel('Grafana');
  });

  test('Tracing Infra', coreCachingOnly, async ({ meshPage }) => {
    await meshPage.selectTracingNode();
    await meshPage.expectTracingSidePanel();
  });

  test('Prometheus Infra', coreCachingOnly, async ({ meshPage }) => {
    await meshPage.selectMeshNodeByLabel('Prometheus');
    await meshPage.expectNodeSidePanel('Prometheus');
  });

  test('Test DataPlane', coreCachingOnly, async ({ meshPage }) => {
    await meshPage.selectMeshNodeByLabel('Data Plane');
    await meshPage.expectDataPlaneSidePanel();
    await meshPage.expandDataPlaneNamespace();
    await meshPage.expectConfigValidationInfo();
  });

  test('Test Cluster', coreCachingOnly, async ({ meshPage }) => {
    await meshPage.selectClusterNode();
    await meshPage.expectClusterSidePanel();
  });

  test('Test istio-system', coreCachingOnly, async ({ meshPage }) => {
    await meshPage.selectMeshNodeByLabel('istio-system');
    await meshPage.expectNamespaceSidePanel('istio-system');
    await meshPage.expectMeshBodyNotContains('dataplane namespaces: 0');
  });

  test('User enables gateways', coreCachingOnly, async ({ meshPage }) => {
    await meshPage.toggleMeshDisplayMenu(true);
    await meshPage.setMeshDisplayOption('gateways', true);
    await meshPage.toggleMeshDisplayMenu(false);
    await meshPage.selectMeshNodeByLabel('bookinfo-gateway');
    await meshPage.expectNodeSidePanel('bookinfo-gateway');
  });

  test('See the Mesh menu link', coreCachingOnly, async ({ sidebarPage }) => {
    test.skip(isOssmc(), 'Mesh sidebar menu is not shown in OSSMC (Cypress @skip-ossmc)');
    await sidebarPage.openOverview();
    await sidebarPage.ensureSidebarOpen();
    await sidebarPage.expectMeshMenuVisible();
  });

  test('See the Mesh link in the about', coreCachingOnly, async ({ overviewPage }) => {
    test.skip(isOssmc(), 'About mesh link is not shown in OSSMC (Cypress @skip-ossmc)');
    await overviewPage.open();
    await overviewPage.openHelpAndAbout();
    await overviewPage.expectModalTitle('Kiali');
    await overviewPage.expectMeshLinkInAboutDialog();
  });

  test('User opens and interacts with the Trace Configuration modal', coreCachingOnly, async ({ meshPage }) => {
    test.setTimeout(180_000);
    await meshPage.selectTracingNode();
    await meshPage.openTraceConfigurationModal();
    await meshPage.expectTraceConfigurationModal();
    await meshPage.expectTraceConfigTabs();
    await meshPage.expectTraceConfigFooterActions();
    await meshPage.expectDiscoveryInformation();
    await meshPage.clickRediscover();
    await meshPage.expectDiscoveryInformation();
    await meshPage.switchToTesterTab();
    await meshPage.toggleTracingProviderInTester();
    await meshPage.toggleUseGrpcInTester();
    await meshPage.clickTestConfiguration();
    await meshPage.expectTesterResult('incorrect');
    await meshPage.toggleTracingProviderInTester();
    await meshPage.toggleUseGrpcInTester();
    await meshPage.clickTestConfiguration();
    await meshPage.expectTesterResult('correct');
  });
});
