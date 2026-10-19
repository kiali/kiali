import { test } from '../../fixtures/kialiFixtures';
import { gotoConsolePage } from '../../utils/navigation';
import { selectNamespace } from '../../utils/namespace';
import { loginBookinfoLimitedUser, skipUnlessOpenIdAuth } from '../../utils/limitedUserAuth';
import { authorizationOnly } from '../../utils/suite-tags';

// Empty storageState: auth.setup saves the admin's Keycloak SSO cookies, and with an
// active SSO session Keycloak skips the login form, so the limited-user login either
// fails to parse the form or silently leaves the admin session in place.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Kiali authorization (limited user)', () => {
  test.beforeEach(async ({ page, request }) => {
    await skipUnlessOpenIdAuth(request);
    await loginBookinfoLimitedUser(page);
  });

  test('Bookinfo namespace visible only on east', authorizationOnly, async ({ namespacesPage, overviewPage }) => {
    await namespacesPage.openList();
    await namespacesPage.filterBy('Namespace', 'bookinfo');
    await namespacesPage.expectNamespaceVirtualItem('east', 'bookinfo');
    await namespacesPage.expectNamespaceVirtualItemAbsent('west', 'bookinfo');
    await namespacesPage.expectNamespaceVirtualItemAbsent('east', 'istio-system');
    await namespacesPage.expectNamespaceVirtualItemAbsent('west', 'istio-system');
    await overviewPage.open();
    await overviewPage.expectMeshNavAbsent();
  });

  test('No mesh link in About dialog', authorizationOnly, async ({ overviewPage }) => {
    await overviewPage.open();
    await overviewPage.openHelpAndAbout();
    await overviewPage.expectMeshLinkAbsentInAboutDialog();
  });

  test('Istio config list shows east bookinfo only', authorizationOnly, async ({ istioConfigPage, page }) => {
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
    await istioConfigPage.expectBookinfoVirtualServiceOnClusterVisible('east', 'west');
  });

  test('Forbidden when opening west gateway as limited user', authorizationOnly, async ({ istioConfigPage, page }) => {
    await gotoConsolePage(page, 'namespaces/bookinfo/istio/networking.istio.io/v1/Gateway/bookinfo-gateway', {
      clusterName: 'west'
    });
    await istioConfigPage.expectForbiddenIstioConfigEmptyState();
  });
});
