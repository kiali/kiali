import { test } from '../../fixtures/kialiFixtures';
import {
  expectGraphNodesRestrictedInCluster,
  expectMiniGraphNodesRestrictedInCluster
} from '../../utils/graphTopology';
import { loginBookinfoLimitedUser, skipUnlessOpenIdAuth } from '../../utils/limitedUserAuth';
import { EAST, WEST } from '../../utils/multiCluster';
import { multiPrimaryOnly } from '../../utils/suite-tags';

// Empty storageState: auth.setup saves the admin's Keycloak SSO cookies, and with an
// active SSO session Keycloak skips the login form, so the limited-user login either
// fails to parse the form or silently leaves the admin session in place.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Restricted remote graph (limited user)', () => {
  test.beforeEach(async ({ page, request }) => {
    await skipUnlessOpenIdAuth(request);
    await loginBookinfoLimitedUser(page);
  });

  test('West nodes restricted on namespace graph', multiPrimaryOnly, async ({ graphPage, page }) => {
    await graphPage.graphNamespaces('bookinfo');
    await graphPage.expectGraphLoaded();
    await expectGraphNodesRestrictedInCluster(page, WEST);
  });

  test('West minigraph nodes restricted on productpage app', multiPrimaryOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'productpage', { clusterName: EAST });
    await expectMiniGraphNodesRestrictedInCluster(page, WEST);
  });

  test(
    'West minigraph nodes restricted on productpage workload',
    multiPrimaryOnly,
    async ({ workloadDetailsPage, page }) => {
      await workloadDetailsPage.open('bookinfo', 'productpage-v1', { clusterName: EAST });
      await expectMiniGraphNodesRestrictedInCluster(page, WEST);
    }
  );
});
