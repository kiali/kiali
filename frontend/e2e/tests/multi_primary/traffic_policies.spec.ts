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
import { multiPrimaryOnly } from '../../utils/suite-tags';

// The AuthorizationPolicy editor tests live here, not in wizards.spec.ts: the namespace
// traffic-policy update/delete actions wipe every AuthorizationPolicy in bookinfo on the
// target cluster, so they must not run in a sibling file that CI can schedule in parallel.
test.describe.serial('Traffic policies multi-primary (west remote)', () => {
  // The AuthorizationPolicy editor chain (applyAuthorizationPolicyOnCluster poll +
  // openConfigByCluster 120s + saveYamlAndWaitForPatch 90s) can sum well past 240s in
  // degraded CI; budget above the realistic sum so helper errors surface.
  test.describe.configure({ timeout: 480_000 });

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

  test('Edit AuthorizationPolicy on west', multiPrimaryOnly, async ({ istioConfigPage, request }) => {
    const policy = 'west-auth-pol-edit';
    await applyAuthorizationPolicyOnCluster(request, policy, 'bookinfo', WEST);
    await istioConfigPage.openConfigByCluster(WEST, 'bookinfo', 'AuthorizationPolicy', policy);
    await istioConfigPage.expectEditorVisible();
    await istioConfigPage.editYaml();
    await istioConfigPage.saveYamlAndWaitForPatch(policy);
    await deleteIstioOnClusters(
      request,
      `/api/namespaces/bookinfo/istio/security.istio.io/v1/AuthorizationPolicy/${policy}`,
      [WEST]
    );
  });

  test('Delete AuthorizationPolicy on west', multiPrimaryOnly, async ({ istioConfigPage, page, request }) => {
    const policy = 'west-auth-pol-delete';
    await applyAuthorizationPolicyOnCluster(request, policy, 'bookinfo', WEST);
    await istioConfigPage.openConfigByCluster(WEST, 'bookinfo', 'AuthorizationPolicy', policy);
    await istioConfigPage.expectEditorVisible();
    await istioConfigPage.deleteObjectFromEditor();
    await istioConfigPage.open();
    await selectNamespace(page, 'bookinfo');
    await istioConfigPage.expectObjectNotListedOnCluster('AuthorizationPolicy', policy, 'bookinfo', WEST);
  });
});
