import { test } from '../../fixtures/kialiFixtures';

test.describe('Kiali alerts', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test('Open Kiali notifications @smoke @core-caching', async ({ overviewPage }) => {
    await overviewPage.refreshAndExpectNoIstioComponentStatus();
  });
});
