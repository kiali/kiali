import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { hasPersesExternalLinks, hasPersesInCluster, isPersesEnabledInKiali } from '../../utils/kialiConfig';
import { persesOnly } from '../../utils/suite-tags';

test.describe('Perses integration', () => {
  test.beforeEach(async ({ request }) => {
    if (await isPersesEnabledInKiali(request)) {
      return;
    }
    const reason = hasPersesInCluster()
      ? 'Perses is running in istio-system but Kiali external_services.perses is not enabled'
      : 'Perses is not installed in istio-system (see hack/setup-kind-in-ci.sh --install-perses true)';
    test.skip(true, reason);
  });

  test('Perses Infra', persesOnly, async ({ meshPage }) => {
    await meshPage.open();
    await meshPage.selectMeshNodeByLabel('Perses');
    await meshPage.expectNodeSidePanel('Perses');
  });

  test('See workload Perses link', persesOnly, async ({ workloadDetailsPage, request }) => {
    test.skip(!(await hasPersesExternalLinks(request)), 'Perses external links are not configured in Kiali');
    ensureDemoApp('bookinfo');
    await workloadDetailsPage.open('bookinfo', 'details-v1');
    await workloadDetailsPage.expectPersesLinkInInboundMetrics();
  });
});
