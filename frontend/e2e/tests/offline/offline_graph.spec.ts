import { test } from '../../fixtures/kialiFixtures';
import { offlineOnly } from '../../utils/suite-tags';

const DISABLED_WIZARD_ACTIONS = [
  'traffic_shifting',
  'tcp_traffic_shifting',
  'request_routing',
  'request_timeouts'
] as const;

test.describe('Graph actions in offline mode', () => {
  test.beforeEach(async ({ graphPage }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectGraphLoaded();
  });

  for (const action of DISABLED_WIZARD_ACTIONS) {
    test(`Context menu ${action} is disabled when fault injection exists`, offlineOnly, async ({ graphPage }) => {
      await graphPage.openContextMenuForService('reviews');
      await graphPage.expectContextMenuItemDisabledInViewOnly(action);
    });
  }

  test('Existing traffic routing action is enabled in context menu', offlineOnly, async ({ graphPage }) => {
    await graphPage.openContextMenuForService('reviews');
    await graphPage.expectContextMenuItemEnabledInViewOnly('fault_injection');
    await graphPage.clickContextMenuItem('fault_injection');
    await graphPage.expectReadOnlyWizardYaml('fault_injection');
  });

  for (const action of DISABLED_WIZARD_ACTIONS) {
    test(`Side panel ${action} is disabled when fault injection exists`, offlineOnly, async ({ graphPage }) => {
      await graphPage.clickGraphNode('reviews', 'service');
      await graphPage.expectSidePanelClusterBadgeHidden();
      await graphPage.openSidePanelKebab();
      await graphPage.expectSidePanelKebabItemDisabledInViewOnly(action);
    });
  }

  test('Existing traffic routing action is enabled in side panel', offlineOnly, async ({ graphPage }) => {
    await graphPage.clickGraphNode('reviews', 'service');
    await graphPage.expectSidePanelClusterBadgeHidden();
    await graphPage.openSidePanelKebab();
    await graphPage.expectSidePanelKebabItemEnabledInViewOnly('fault_injection');
    await graphPage.clickSidePanelKebabItem('fault_injection');
    await graphPage.expectReadOnlyWizardYaml('fault_injection');
  });
});
