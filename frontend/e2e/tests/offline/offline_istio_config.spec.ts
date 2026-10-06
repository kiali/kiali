import { test } from '../../fixtures/kialiFixtures';
import { selectNamespace } from '../../utils/namespace';
import { offlineOnly } from '../../utils/suite-tags';

test.describe('Istio Config list in offline mode', () => {
  test('See all Istio Config objects without Configuration column', offlineOnly, async ({ istioConfigPage, page }) => {
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
    await istioConfigPage.expectBookinfoConfigRows();
    await istioConfigPage.expectColumn('Cluster', false);
    await istioConfigPage.expectColumn('Configuration', false);
    await istioConfigPage.expectIstioObjectNameNamespaceType('bookinfo-gateway');
  });
});
