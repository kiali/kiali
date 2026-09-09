import { test } from '../../fixtures/kialiFixtures';
import { skipUnlessHealthyIstioComponents } from '../../utils/istioStatus';
import { smokeAndCoreCaching } from '../../utils/suite-tags';

test.describe('Kiali alerts', () => {
  test.beforeEach(async ({ overviewPage }) => {
    await overviewPage.open();
  });

  test('Open Kiali notifications', smokeAndCoreCaching, async ({ overviewPage, request }) => {
    await skipUnlessHealthyIstioComponents(request);
    await overviewPage.refreshAndExpectNoIstioComponentStatus();
  });
});
