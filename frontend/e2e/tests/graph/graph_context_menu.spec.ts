import { test, expect } from '../../fixtures/kialiFixtures';
import { core1 } from '../../utils/suite-tags';

const WIZARD_ACTIONS = [
  'traffic_shifting',
  'tcp_traffic_shifting',
  'request_routing',
  'fault_injection',
  'request_timeouts'
] as const;

test.describe('Graph context menu', () => {
  test.beforeEach(async ({ graphPage }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectGraphLoaded();
  });

  test('Detail action in context menu for service node', core1, async ({ graphPage, page }) => {
    await graphPage.openContextMenuForService('productpage');
    await graphPage.clickContextMenuLink('Details');
    await expect(page).not.toHaveURL(/clusterName=/);
    await page.goBack();
  });

  test('Traffic action in context menu for service node', core1, async ({ graphPage, page }) => {
    await graphPage.openContextMenuForService('productpage');
    await graphPage.clickContextMenuLink('Traffic');
    await expect(page).not.toHaveURL(/clusterName=/);
    await page.goBack();
  });

  test('Inbound Metrics in context menu for service node', core1, async ({ graphPage, page }) => {
    await graphPage.openContextMenuForService('productpage');
    await graphPage.clickContextMenuLink('Inbound Metrics');
    await expect(page).not.toHaveURL(/clusterName=/);
    await page.goBack();
  });

  test('Delete traffic routing in context menu', core1, async ({ graphPage }) => {
    await graphPage.openContextMenuForService('productpage');
    await graphPage.clickContextMenuItem('delete_traffic_routing');
    await graphPage.expectDeleteTrafficRoutingModal();
  });

  for (const action of WIZARD_ACTIONS) {
    test(`Launch ${action} wizard from context menu`, core1, async ({ graphPage }) => {
      await graphPage.openContextMenuForService('reviews');
      await graphPage.clickContextMenuItem(action);
      await graphPage.expectWizardVisible(action);
    });
  }
});
