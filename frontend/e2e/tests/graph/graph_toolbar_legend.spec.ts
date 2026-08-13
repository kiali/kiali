import { test } from '../../fixtures/kialiFixtures';
import { core1 } from '../../utils/suite-tags';

const TOOLBAR_BUTTONS = [
  'reset-view',
  'toolbar_edge_mode_unhealthy',
  'toolbar_edge_mode_none',
  'toolbar_layout_dagre',
  'toolbar_layout_grid',
  'toolbar_layout_concentric',
  'toolbar_layout_breadth_first',
  'legend'
] as const;

test.describe('Graph toolbar legend', () => {
  test.beforeEach(async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha,beta');
  });

  for (const id of TOOLBAR_BUTTONS) {
    test(`Toggle button ${id} is enabled`, core1, async ({ graphPage }) => {
      await graphPage.expectToolbarButtonEnabled(id);
    });
  }

  for (const id of [
    'toolbar_edge_mode_unhealthy',
    'toolbar_edge_mode_none',
    'toolbar_layout_dagre',
    'toolbar_layout_grid',
    'toolbar_layout_concentric',
    'toolbar_layout_breadth_first',
    'legend'
  ]) {
    test(`Button ${id} can be turned on`, core1, async ({ graphPage }) => {
      await graphPage.clickToolbarButton(id);
      await graphPage.expectToolbarButtonActive(id, true);
    });
  }

  for (const id of ['toolbar_edge_mode_unhealthy', 'toolbar_edge_mode_none']) {
    test(`Button ${id} can be turned off`, core1, async ({ graphPage }) => {
      await graphPage.prepareToolbarButton(id, true);
      await graphPage.clickToolbarButton(id);
      await graphPage.expectToolbarButtonActive(id, false);
    });
  }

  test('Hide Healthy Edges off when Hide All Edges on', core1, async ({ graphPage }) => {
    await graphPage.prepareToolbarButton('toolbar_edge_mode_unhealthy', false);
    await graphPage.prepareToolbarButton('toolbar_edge_mode_none', false);
    await graphPage.clickToolbarButton('toolbar_edge_mode_unhealthy');
    await graphPage.clickToolbarButton('toolbar_edge_mode_none');
    await graphPage.expectToolbarButtonActive('toolbar_edge_mode_unhealthy', false);
    await graphPage.expectToolbarButtonActive('toolbar_edge_mode_none', true);
  });

  test('Hide All Edges off when Hide Healthy Edges on', core1, async ({ graphPage }) => {
    await graphPage.prepareToolbarButton('toolbar_edge_mode_unhealthy', false);
    await graphPage.prepareToolbarButton('toolbar_edge_mode_none', false);
    await graphPage.clickToolbarButton('toolbar_edge_mode_none');
    await graphPage.clickToolbarButton('toolbar_edge_mode_unhealthy');
    await graphPage.expectToolbarButtonActive('toolbar_edge_mode_unhealthy', true);
    await graphPage.expectToolbarButtonActive('toolbar_edge_mode_none', false);
  });

  test('Graph Layout Style buttons are mutually exclusive', core1, async ({ graphPage }) => {
    await graphPage.prepareToolbarButton('toolbar_layout_dagre', true);
    await graphPage.prepareToolbarButton('toolbar_layout_grid', false);
    await graphPage.prepareToolbarButton('toolbar_layout_concentric', false);
    await graphPage.prepareToolbarButton('toolbar_layout_breadth_first', false);
    await graphPage.clickToolbarButton('toolbar_layout_grid');
    await graphPage.clickToolbarButton('toolbar_layout_concentric');
    await graphPage.clickToolbarButton('toolbar_layout_breadth_first');
    await graphPage.expectToolbarButtonActive('toolbar_layout_dagre', false);
    await graphPage.expectToolbarButtonActive('toolbar_layout_grid', false);
    await graphPage.expectToolbarButtonActive('toolbar_layout_concentric', false);
    await graphPage.expectToolbarButtonActive('toolbar_layout_breadth_first', true);
  });

  test('Show the Legend', core1, async ({ graphPage }) => {
    await graphPage.clickToolbarButton('legend');
    await graphPage.expectLegendVisible();
    await graphPage.expectToolbarButtonActive('legend', true);
  });

  test('Close the Legend using the button', core1, async ({ graphPage }) => {
    await graphPage.clickToolbarButton('legend');
    await graphPage.clickToolbarButton('legend');
    await graphPage.expectLegendHidden();
    await graphPage.expectToolbarButtonActive('legend', false);
  });

  test('Close the Legend using the cross', core1, async ({ graphPage }) => {
    await graphPage.clickToolbarButton('legend');
    await graphPage.closeLegendWithCross();
    await graphPage.expectLegendHidden();
    await graphPage.expectToolbarButtonActive('legend', false);
  });
});
