import { expect, test } from '../../fixtures/kialiFixtures';
import { expectEmptyMinigraph } from '../../utils/detailsPage';
import { EAST, WEST, clickMiniGraphNode, expectMiniGraphHasClusterNode } from '../../utils/multiCluster';
import { multiClusterOnly } from '../../utils/suite-tags';

test.describe('Details minigraph multi-cluster', () => {
  test.describe.configure({ timeout: 180_000 });

  test('App minigraph shows west reviews', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'reviews', { clusterName: WEST });
    await appDetailsPage.expectMinigraphVisible();
    await expectMiniGraphHasClusterNode(page, 'app', WEST);
  });

  test('App minigraph empty for west details', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'details', { clusterName: WEST });
    await expectEmptyMinigraph(page);
  });

  test('Navigate via app minigraph to west reviews app', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'productpage', { clusterName: EAST });
    await appDetailsPage.expectMinigraphVisible();
    await clickMiniGraphNode(page, 'reviews', 'app', WEST);
    await expect(page).toHaveURL(new RegExp(`/applications/reviews.*clusterName=${WEST}`));
  });

  test('Navigate via app minigraph to west reviews service', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'productpage', { clusterName: EAST });
    await appDetailsPage.expectMinigraphVisible();
    await clickMiniGraphNode(page, 'reviews', 'service', WEST);
    await expect(page).toHaveURL(new RegExp(`/services/reviews.*clusterName=${WEST}`));
  });

  test('Navigate via app minigraph to west reviews-v3 workload', multiClusterOnly, async ({ appDetailsPage, page }) => {
    await appDetailsPage.openApp('bookinfo', 'productpage', { clusterName: EAST });
    await appDetailsPage.expectMinigraphVisible();
    await clickMiniGraphNode(page, 'reviews-v3', 'workload', WEST);
    await expect(page).toHaveURL(new RegExp(`/workloads/reviews-v3.*clusterName=${WEST}`));
  });

  test('Service minigraph shows west ratings', multiClusterOnly, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open('bookinfo', 'ratings', { clusterName: WEST });
    await serviceDetailsPage.expectMinigraphVisible();
    await expectMiniGraphHasClusterNode(page, 'service', WEST);
  });

  test('Service minigraph empty for west details', multiClusterOnly, async ({ serviceDetailsPage, page }) => {
    await serviceDetailsPage.open('bookinfo', 'details', { clusterName: WEST });
    await expectEmptyMinigraph(page);
  });

  test('Workload minigraph shows west reviews-v2', multiClusterOnly, async ({ workloadDetailsPage, page }) => {
    await workloadDetailsPage.open('bookinfo', 'reviews-v2', { clusterName: WEST });
    await workloadDetailsPage.expectMinigraphVisible();
    await expectMiniGraphHasClusterNode(page, 'service', WEST);
  });

  test('Workload minigraph empty for west details-v1', multiClusterOnly, async ({ workloadDetailsPage, page }) => {
    await workloadDetailsPage.open('bookinfo', 'details-v1', { clusterName: WEST });
    await expectEmptyMinigraph(page);
  });

  test(
    'Navigate via workload minigraph to west reviews service',
    multiClusterOnly,
    async ({ workloadDetailsPage, page }) => {
      await workloadDetailsPage.open('bookinfo', 'productpage-v1', { clusterName: EAST });
      await workloadDetailsPage.expectMinigraphVisible();
      await clickMiniGraphNode(page, 'reviews', 'service', WEST);
      await expect(page).toHaveURL(new RegExp(`/services/reviews.*clusterName=${WEST}`));
    }
  );

  test(
    'Navigate via workload minigraph to west reviews-v3',
    multiClusterOnly,
    async ({ workloadDetailsPage, page }) => {
      await workloadDetailsPage.open('bookinfo', 'productpage-v1', { clusterName: EAST });
      await workloadDetailsPage.expectMinigraphVisible();
      await clickMiniGraphNode(page, 'reviews-v3', 'workload', WEST);
      await expect(page).toHaveURL(new RegExp(`/workloads/reviews-v3.*clusterName=${WEST}`));
    }
  );
});
