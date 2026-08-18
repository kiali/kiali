import { test } from '../../fixtures/kialiFixtures';
import { core1 } from '../../utils/suite-tags';

test.describe('Graph find hide', () => {
  test.beforeEach(async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha,beta');
    await graphPage.expectGraphLoaded();
  });

  test('Find unhealthy workloads', core1, async ({ graphPage }) => {
    await graphPage.expectNoHighlightedNodes();
    await graphPage.clearFindHide();
    await graphPage.fillFind('!healthy');
    await graphPage.expectUnhealthyWorkloadsHighlighted();
  });

  test('Hide unhealthy workloads', core1, async ({ graphPage }) => {
    await graphPage.clearFindHide();
    await graphPage.fillHide('!healthy');
    await graphPage.expectNoUnhealthyVisibleWorkloads();
  });

  test('Use preset find option to filter workloads', core1, async ({ graphPage }) => {
    await graphPage.openFindPresets();
    await graphPage.selectFindPreset('Find: unhealthy nodes');
    await graphPage.expectUnhealthyWorkloadsHighlighted();
  });

  test('Use preset hide option to filter workloads', core1, async ({ graphPage }) => {
    await graphPage.openHidePresets();
    await graphPage.selectHidePreset('Hide: healthy nodes');
    await graphPage.expectNoHealthyVisibleWorkloads();
  });

  test('Show Graph Find/Hide help menu', core1, async ({ graphPage }) => {
    await graphPage.openFindHideHelp();
    await graphPage.expectFindHideHelpSections('Examples', 'Nodes', 'Edges', 'Operators', 'Usage Notes');
  });

  test('Filling the find form with nonsense', core1, async ({ graphPage }) => {
    await graphPage.fillFind('hello world');
    await graphPage.expectFindError('Find: No valid operator found in expression');
  });
});
