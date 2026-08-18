import { test } from '../../fixtures/kialiFixtures';
import { core1 } from '../../utils/suite-tags';

test.describe('Graph replay', () => {
  test('Graph alpha and beta namespaces', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha,beta');
    await graphPage.expectNamespaceInSummaryPanel('alpha');
    await graphPage.expectNamespaceInSummaryPanel('beta');
  });

  test('Show Replay controls', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha,beta');
    await graphPage.pressReplay();
    await graphPage.expectReplayCloseVisible();
    await graphPage.pressReplayPlay();
    await graphPage.expectReplaySliderVisible();
    await graphPage.pressReplaySpeed('fast');
    await graphPage.pressReplaySpeed('slow');
    await graphPage.pressReplaySpeed('medium');
    await graphPage.pressReplayPause();
  });

  test('Close Replay', core1, async ({ graphPage }) => {
    await graphPage.graphNamespaces('alpha,beta');
    await graphPage.pressReplay();
    await graphPage.pressReplayClose();
    await graphPage.expectReplaySliderHidden();
  });
});
