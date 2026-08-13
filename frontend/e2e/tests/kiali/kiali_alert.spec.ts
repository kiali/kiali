import { test } from '../../fixtures/kialiFixtures';

test.describe('Kiali alerts', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test('Open Kiali notifications', { tag: ['@smoke', '@core-caching'] }, async ({ overviewPage }) => {
    await overviewPage.refreshAndExpectNoIstioComponentStatus();
  });
});
