import { test } from '../../fixtures/kialiFixtures';
import { smokeAndCoreCaching } from '../../utils/suite-tags';

test.describe('Kiali alerts', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test('Open Kiali notifications', smokeAndCoreCaching, async ({ overviewPage }) => {
    await overviewPage.refreshAndExpectNoIstioComponentStatus();
  });
});
