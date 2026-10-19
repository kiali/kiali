import { test } from '../../fixtures/kialiFixtures';
import { selectNamespace } from '../../utils/namespace';
import { multiPrimaryOnly } from '../../utils/suite-tags';

test.describe('Istio config list multi-primary', () => {
  test(
    'See bookinfo objects on east and west with cluster column',
    multiPrimaryOnly,
    async ({ istioConfigPage, page }) => {
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await istioConfigPage.expectColumn('Cluster', true);
      await istioConfigPage.expectMulticlusterBookinfoGatewayAndVirtualService();
      // Row-level assertions must be scoped per cluster: bookinfo-gateway exists on both
      // east and west, so a name-only row filter resolves to two rows.
      await istioConfigPage.expectGatewayRowColumns('bookinfo-gateway', 'bookinfo', 'east');
      await istioConfigPage.expectGatewayRowColumns('bookinfo-gateway', 'bookinfo', 'west');
    }
  );
});
