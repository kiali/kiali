import { test } from '../../fixtures/kialiFixtures';
import { core1 } from '../../utils/suite-tags';

const WIZARD_ACTIONS = [
  'traffic_shifting',
  'tcp_traffic_shifting',
  'request_routing',
  'fault_injection',
  'request_timeouts'
] as const;

test.describe('Graph side panel', () => {
  test.beforeEach(async ({ graphPage }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectGraphLoaded();
  });

  test('Delete traffic routing from side panel kebab', core1, async ({ graphPage }) => {
    await graphPage.clickGraphNode('productpage', 'service');
    await graphPage.openSidePanelKebab();
    await graphPage.clickSidePanelKebabItem('delete_traffic_routing');
    await graphPage.expectDeleteTrafficRoutingModal();
  });

  for (const action of WIZARD_ACTIONS) {
    test(`Launch ${action} wizard from side panel`, core1, async ({ graphPage }) => {
      await graphPage.clickGraphNode('reviews', 'service');
      await graphPage.openSidePanelKebab();
      await graphPage.clickSidePanelKebabItem(action);
      await graphPage.expectWizardVisible(action);
    });
  }

  test('Validate summary panel edge', core1, async ({ graphPage }) => {
    await graphPage.clickGraphEdge('productpage', 'app', 'details', 'service');
    await graphPage.expectSummaryPanelContains('Edge (HTTP)');
  });
});
