import { test } from '../../fixtures/kialiFixtures';
import {
  EAST,
  WEST,
  applyAuthorizationPolicyOnCluster,
  deleteGeneratedTrafficPolicies,
  deleteIstioOnClusters,
  expectGeneratedTrafficPoliciesOnCluster
} from '../../utils/multiCluster';
import { selectNamespace } from '../../utils/namespace';
import { multiClusterOnly } from '../../utils/suite-tags';
import { useBookinfoRoutingLockPerTest } from '../../utils/bookinfoRoutingLock';

// The AuthorizationPolicy editor tests live here, not in wizards.spec.ts: the namespace
// traffic-policy update/delete actions wipe every AuthorizationPolicy in bookinfo on the
// target cluster, so they must not run in a sibling file that CI can schedule in parallel.
test.describe.serial('Traffic policies multi-cluster (east local)', () => {
  // The AuthorizationPolicy editor chain (applyAuthorizationPolicyOnCluster poll +
  // openConfigByCluster 120s + saveYamlAndWaitForPatch 90s) can sum well past 240s in
  // degraded CI; budget above the realistic sum so helper errors surface.
  test.describe.configure({ timeout: 480_000 });
  // These tests mutate shared bookinfo routing/policies on EAST; serialize across
  // parallel workers (graph.spec.ts / wizards.spec.ts touch the same objects).
  useBookinfoRoutingLockPerTest();

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

  test('Edit AuthorizationPolicy on east', multiClusterOnly, async ({ istioConfigPage, request }) => {
    const policy = 'east-auth-pol-edit';
    await applyAuthorizationPolicyOnCluster(request, policy, 'bookinfo', EAST);
    await istioConfigPage.openConfigByCluster(EAST, 'bookinfo', 'AuthorizationPolicy', policy);
    await istioConfigPage.expectEditorVisible();
    await istioConfigPage.editYaml();
    await istioConfigPage.saveYamlAndWaitForPatch(policy);
    await deleteIstioOnClusters(
      request,
      `/api/namespaces/bookinfo/istio/security.istio.io/v1/AuthorizationPolicy/${policy}`,
      [EAST]
    );
  });

  test('Delete AuthorizationPolicy on east', multiClusterOnly, async ({ istioConfigPage, page, request }) => {
    const policy = 'east-auth-pol-delete';
    await applyAuthorizationPolicyOnCluster(request, policy, 'bookinfo', EAST);
    await istioConfigPage.openConfigByCluster(EAST, 'bookinfo', 'AuthorizationPolicy', policy);
    await istioConfigPage.expectEditorVisible();
    await istioConfigPage.deleteObjectFromEditor();
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
    await istioConfigPage.expectObjectNotListedOnCluster('AuthorizationPolicy', policy, 'bookinfo', EAST);
  });
});
