import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { hasPersesDeployment, hasPersesExternalLinks } from '../../utils/kialiConfig';
import { persesOnly } from '../../utils/suite-tags';

test.describe('Perses integration', () => {
  test.beforeEach(() => {
    test.skip(!hasPersesDeployment(), 'Perses deployment is not installed in istio-system');
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
