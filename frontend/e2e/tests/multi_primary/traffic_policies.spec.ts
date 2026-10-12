import { test } from '../../fixtures/kialiFixtures';
import {
  EAST,
  WEST,
  deleteGeneratedTrafficPolicies,
  expectGeneratedTrafficPoliciesOnCluster
} from '../../utils/multiCluster';
import { selectNamespace } from '../../utils/namespace';
import { multiPrimaryOnly } from '../../utils/suite-tags';

test.describe.serial('Traffic policies multi-primary (west remote)', () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    'Create traffic policy on west only',
    multiPrimaryOnly,
    async ({ namespaceDetailPage, istioConfigPage, page, request }) => {
      await deleteGeneratedTrafficPolicies(request);
      await namespaceDetailPage.open('bookinfo', { clusterName: WEST });
      await namespaceDetailPage.applyTrafficPolicyAction('create');
      await namespaceDetailPage.expectInfoMessage('Traffic policies created for bookinfo namespace.');
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await expectGeneratedTrafficPoliciesOnCluster(page, WEST, true);
      await expectGeneratedTrafficPoliciesOnCluster(page, EAST, false);
    }
  );

  test('Update traffic policy on west', multiPrimaryOnly, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.open('bookinfo', { clusterName: WEST });
    await namespaceDetailPage.applyTrafficPolicyAction('update');
    await namespaceDetailPage.expectInfoMessage('Traffic policies updated for bookinfo namespace.');
  });

  test(
    'Delete traffic policy on west',
    multiPrimaryOnly,
    async ({ namespaceDetailPage, istioConfigPage, page, request }) => {
      await namespaceDetailPage.open('bookinfo', { clusterName: WEST });
      await namespaceDetailPage.applyTrafficPolicyAction('delete');
      await namespaceDetailPage.expectInfoMessage('Traffic policies deleted for bookinfo namespace.');
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await expectGeneratedTrafficPoliciesOnCluster(page, WEST, false);
      await deleteGeneratedTrafficPolicies(request);
    }
  );
});
