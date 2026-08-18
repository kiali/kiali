import { test } from '../../fixtures/kialiFixtures';
import { core1 } from '../../utils/suite-tags';

test.describe('Graph toolbar', () => {
  test('Namespace selector is sorted alphabetically', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('');
    await graphPage.expectNamespaceDropdownSorted();
  });

  test('Graph alpha namespace with query params', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha', '900000', '300');
    await graphPage.expectNamespaceInSummaryPanel('alpha');
    await graphPage.expectSelectedDuration('Last 5m');
    await graphPage.expectSelectedRefresh('Every 15m');
  });

  test('Open graph Tour', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.clickGraphTour();
    await graphPage.expectGraphTourVisible();
  });

  test('Close graph Tour', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.clickGraphTour();
    await graphPage.closeGraphTour();
    await graphPage.expectGraphTourHidden();
  });

  test('Open traffic dropdown', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.openTrafficMenu();
    await graphPage.expectTrafficMenuVisible();
  });

  test('Disable all traffic', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.openTrafficMenu();
    await graphPage.disableAllTraffic();
    await graphPage.expectNoTraffic();
  });

  test('Enable http traffic', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.openTrafficMenu();
    await graphPage.disableAllTraffic();
    await graphPage.setTrafficOption('http', true);
    await graphPage.expectTrafficProtocol('http', true);
    await graphPage.expectTrafficProtocol('tcp', false);
    await graphPage.expectTrafficProtocol('grpc', false);
  });

  test('Close traffic dropdown', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.openTrafficMenu();
    await graphPage.closeTrafficMenu();
    await graphPage.expectTrafficMenuHidden();
  });

  test('User resets to factory default from toolbar', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.resetFactoryDefault();
    await graphPage.openTrafficMenu();
    await graphPage.expectTrafficMenuVisible();
  });

  test('Open duration dropdown', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.clickDurationMenu();
    await graphPage.expectDurationMenuVisible();
  });

  test('Close duration dropdown', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.clickDurationMenu();
    await graphPage.clickDurationMenu();
    await graphPage.expectDurationMenuHidden();
  });

  test('Set duration dropdown', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.selectGraphDuration('600');
    await graphPage.expectSelectedDuration('Last 10m');
  });

  test('Open refresh dropdown', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.clickRefreshMenu();
    await graphPage.expectRefreshMenuVisible();
  });

  test('Close refresh dropdown', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.clickRefreshMenu();
    await graphPage.clickRefreshMenu();
    await graphPage.expectRefreshMenuHidden();
  });

  test('Set refresh dropdown', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.selectGraphRefresh('0');
    await graphPage.expectSelectedRefresh('Pause');
  });

  test('graph type app', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.selectGraphType('APP');
    await graphPage.expectGraphType('app');
  });

  test('graph type service', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.selectGraphType('SERVICE');
    await graphPage.expectGraphType('service');
  });

  test('graph type versioned app', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.selectGraphType('VERSIONED_APP');
    await graphPage.expectGraphType('versionedApp');
  });

  test('graph type workload', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha');
    await graphPage.selectGraphType('WORKLOAD');
    await graphPage.expectGraphType('workload');
  });
});
