import { test } from '../../fixtures/kialiFixtures';
import {
  EAST,
  WEST,
  deleteGeneratedTrafficPolicies,
  expectGeneratedTrafficPoliciesOnCluster
} from '../../utils/multiCluster';
import { selectNamespace } from '../../utils/namespace';
import { multiClusterOnly } from '../../utils/suite-tags';

test.describe.serial('Traffic policies multi-cluster (east local)', () => {
  test.describe.configure({ timeout: 180_000 });

  test(
    'Create traffic policy on east only',
    multiClusterOnly,
    async ({ namespaceDetailPage, istioConfigPage, page, request }) => {
      await deleteGeneratedTrafficPolicies(request);
      await namespaceDetailPage.open('bookinfo', { clusterName: EAST });
      await namespaceDetailPage.applyTrafficPolicyAction('create');
      await namespaceDetailPage.expectInfoMessage('Traffic policies created for bookinfo namespace.');
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await expectGeneratedTrafficPoliciesOnCluster(page, EAST, true);
      await expectGeneratedTrafficPoliciesOnCluster(page, WEST, false);
    }
  );

  test('Update traffic policy on east', multiClusterOnly, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.open('bookinfo', { clusterName: EAST });
    await namespaceDetailPage.applyTrafficPolicyAction('update');
    await namespaceDetailPage.expectInfoMessage('Traffic policies updated for bookinfo namespace.');
  });

  test(
    'Delete traffic policy on east',
    multiClusterOnly,
    async ({ namespaceDetailPage, istioConfigPage, page, request }) => {
      await namespaceDetailPage.open('bookinfo', { clusterName: EAST });
      await namespaceDetailPage.applyTrafficPolicyAction('delete');
      await namespaceDetailPage.expectInfoMessage('Traffic policies deleted for bookinfo namespace.');
      await istioConfigPage.open();
      await selectNamespace(page, 'bookinfo');
      await expectGeneratedTrafficPoliciesOnCluster(page, EAST, false);
      await deleteGeneratedTrafficPolicies(request);
    }
  );
});
