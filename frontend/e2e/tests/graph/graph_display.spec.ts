import { test } from '../../fixtures/kialiFixtures';
import { core1, smokeAndPrometheusDisabled } from '../../utils/suite-tags';

test.describe('Graph display prometheus', () => {
  test('Graph shows empty state when Prometheus is disabled', smokeAndPrometheusDisabled, async ({ graphPage }) => {
    await graphPage.openWithPrometheusDisabled();
    await graphPage.expectPrometheusDisabledEmptyState();
  });
});

test.describe('Graph display', () => {
  test('Graph no namespaces', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('');
    await graphPage.expectNoNamespaceSelected();
  });

  test('Show empty graph', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('default');
    await graphPage.expectEmptyGraph();
  });

  test('Show idle nodes', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('istio-system');
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('idle nodes', true);
    await graphPage.expectNamespaceInSummaryPanel('istio-system');
    await graphPage.expectIdleNodes('appear');
    await graphPage.closeDisplayMenu();
  });

  test('User disables idle nodes', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('istio-system');
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('idle nodes', true);
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('idle nodes', false);
    await graphPage.expectIdleNodes('do not appear');
    await graphPage.closeDisplayMenu();
  });

  test('Graph bookinfo namespace', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectNamespaceInSummaryPanel('bookinfo');
  });

  test('User clicks Display Menu', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.openDisplayMenu();
    await graphPage.expectDisplayMenuOpen();
    await graphPage.expectDisplayMenuDefaultSettings();
    await graphPage.expectGraphReflectsDefaultSettings();
    await graphPage.closeDisplayMenu();
  });
});

test.describe('Graph display edge labels', () => {
  test.beforeEach(async ({ graphPage }) => {
    await graphPage.graphNamespaces('bookinfo');
  });

  test('Average Response-time edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.enableEdgeLabels('avg', 'responseTime');
    await graphPage.expectEdgeLabelsVisible('responseTime');
    await graphPage.closeDisplayMenu();
  });

  test('Median Response-time edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.enableEdgeLabels('rt50', 'responseTime');
    await graphPage.expectEdgeLabelsVisible('responseTime');
    await graphPage.closeDisplayMenu();
  });

  test('95th Percentile Response-time edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.enableEdgeLabels('rt95', 'responseTime');
    await graphPage.expectEdgeLabelsVisible('responseTime');
    await graphPage.closeDisplayMenu();
  });

  test('99th Percentile Response-time edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.enableEdgeLabels('rt99', 'responseTime');
    await graphPage.expectEdgeLabelsVisible('responseTime');
    await graphPage.closeDisplayMenu();
  });

  test('Disable response time edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setEdgeLabels('responseTime', false);
    await graphPage.expectEdgeLabelOptionClosed('responseTime');
    await graphPage.closeDisplayMenu();
  });

  test('Request Throughput edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.enableEdgeLabels('throughputRequest', 'throughput');
    await graphPage.expectEdgeLabelsVisible('throughput');
    await graphPage.closeDisplayMenu();
  });

  test('Response Throughput edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.enableEdgeLabels('throughputResponse', 'throughput');
    await graphPage.expectEdgeLabelsVisible('throughput');
    await graphPage.closeDisplayMenu();
  });

  test('Disable throughput edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setEdgeLabels('throughput', false);
    await graphPage.expectEdgeLabelOptionClosed('throughput');
    await graphPage.closeDisplayMenu();
  });

  test('Enable Traffic Distribution edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setEdgeLabels('trafficDistribution', true);
    await graphPage.expectEdgeLabelsVisible('trafficDistribution');
    await graphPage.closeDisplayMenu();
  });

  test('Disable Traffic Distribution edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setEdgeLabels('trafficDistribution', false);
    await graphPage.expectEdgeLabelOptionClosed('trafficDistribution');
    await graphPage.closeDisplayMenu();
  });

  test('Enable Traffic Rate edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setEdgeLabels('trafficRate', true);
    await graphPage.expectEdgeLabelsVisible('trafficRate');
    await graphPage.closeDisplayMenu();
  });

  test('Disable Traffic Rate edge labels', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setEdgeLabels('trafficRate', false);
    await graphPage.expectEdgeLabelOptionClosed('trafficRate');
    await graphPage.closeDisplayMenu();
  });

  test('User disables cluster boxes', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('cluster boxes', false);
    await graphPage.expectNoBoxing('Cluster');
    await graphPage.closeDisplayMenu();
  });

  test('User disables Namespace boxes', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('namespace boxes', false);
    await graphPage.expectNoBoxing('Namespace');
    await graphPage.closeDisplayMenu();
  });

  test('User enables idle edges', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('idle edges', true);
    await graphPage.expectIdleEdges('appear');
    await graphPage.closeDisplayMenu();
  });

  test('User disables idle edges', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('idle edges', true);
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('idle edges', false);
    await graphPage.expectIdleEdges('do not appear');
    await graphPage.closeDisplayMenu();
  });

  test('User enables rank', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('rank', true);
    await graphPage.expectRanks('appear');
    await graphPage.closeDisplayMenu();
  });

  test('User disables rank', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('rank', true);
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('rank', false);
    await graphPage.expectRanks('do not appear');
    await graphPage.closeDisplayMenu();
  });

  test('User disables service nodes', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('service nodes', false);
    await graphPage.expectNoServiceNodes();
    await graphPage.closeDisplayMenu();
  });

  test('User enables security', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('security', true);
    await graphPage.expectSecurity('appears');
    await graphPage.expectLockIconFontLoaded();
    await graphPage.closeDisplayMenu();
  });

  test('User disables security', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('security', true);
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('security', false);
    await graphPage.expectSecurity('does not appear');
    await graphPage.closeDisplayMenu();
  });

  test('User disables missing sidecars', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('missing sidecars', false);
    await graphPage.expectDisplayClientOption('missing sidecars', 'does not appear');
    await graphPage.closeDisplayMenu();
  });

  test('User disables virtual services', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('virtual services', false);
    await graphPage.expectDisplayClientOption('virtual services', 'does not appear');
    await graphPage.closeDisplayMenu();
  });

  test('User enables animation', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('traffic animation', true);
    await graphPage.expectDisplayClientOption('traffic animation', 'appears');
    await graphPage.closeDisplayMenu();
  });

  test('User disables animation', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('traffic animation', true);
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('traffic animation', false);
    await graphPage.expectDisplayClientOption('traffic animation', 'does not appear');
    await graphPage.closeDisplayMenu();
  });

  test('User resets to factory default setting', core1, async ({ graphPage }) => {
    await graphPage.resetFactoryDefault();
    await graphPage.openDisplayMenu();
    await graphPage.expectDisplayMenuOpen();
    await graphPage.expectDisplayMenuDefaultSettings();
    await graphPage.closeDisplayMenu();
  });

  test('User observes options when switching to Service graph', core1, async ({ graphPage }) => {
    await graphPage.openDisplayMenu();
    await graphPage.setDisplayOption('service nodes', false);
    await graphPage.setDisplayOption('operation nodes', true);
    await graphPage.selectGraphType('SERVICE');
    await graphPage.openDisplayMenu();
    await graphPage.expectDisplayMenuOpen();
    await graphPage.expectDisplayOptionState('service nodes', 'not be checked', 'disabled');
    await graphPage.expectDisplayOptionState('operation nodes', 'be checked', 'disabled');
    await graphPage.selectGraphType('APP');
    await graphPage.openDisplayMenu();
    await graphPage.expectDisplayMenuOpen();
    await graphPage.expectDisplayOptionState('service nodes', 'not be checked', 'enabled');
    await graphPage.expectDisplayOptionState('operation nodes', 'be checked', 'enabled');
    await graphPage.closeDisplayMenu();
  });

  for (const graphType of ['APP', 'SERVICE', 'VERSIONED_APP', 'WORKLOAD']) {
    test(`Single cluster box for ${graphType} graph`, core1, async ({ graphPage }) => {
      await graphPage.graphNamespaces('bookinfo');
      await graphPage.resetFactoryDefault();
      await graphPage.selectGraphType(graphType);
      await graphPage.expectNamespaceInSummaryPanel('bookinfo');
      await graphPage.expectSingleClusterBoxForBookinfo();
    });
  }
});
