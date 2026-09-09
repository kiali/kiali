import { test } from '../../fixtures/kialiFixtures';
import { coreCachingOnly } from '../../utils/suite-tags';
import {
  mockAllOverviewApisFail,
  mockAllOverviewApisSlow,
  mockApplicationsFail,
  mockApplicationsFailOnce,
  mockApplicationsRates,
  mockApplicationsSlow,
  mockClustersEmpty,
  mockClustersFailOnce,
  mockControlPlanesFail,
  mockControlPlanesHealthy,
  mockControlPlanesUnhealthy,
  mockIstioConfigsWarnings,
  mockServiceInsightsFail,
  mockServiceInsightsFailOnce,
  mockServiceInsightsRates,
  mockServiceInsightsSlow
} from '../../utils/overviewMocks';

test.describe('Overview cards @core-caching', () => {
  test(
    'View all warning Istio configs includes namespaces and filters',
    coreCachingOnly,
    async ({ page, overviewPage }) => {
      await mockIstioConfigsWarnings(page);
      await overviewPage.open();
      await overviewPage.openIstioConfigsWarningsPopover();
      await overviewPage.clickPopoverAction('View warning Istio configs');
      await overviewPage.expectIstioConfigListWithWarningFilters();
    }
  );

  test(
    'All overview cards show loading state without count or footer link',
    coreCachingOnly,
    async ({ page, overviewPage }) => {
      await mockAllOverviewApisSlow(page);
      await overviewPage.openPending();
      await overviewPage.expectControlPlanesLoadingState();
      await overviewPage.expectClustersLoadingState();
    }
  );

  test(
    'All overview cards show error state with Try Again without count or footer link',
    coreCachingOnly,
    async ({ page, overviewPage }) => {
      await mockAllOverviewApisFail(page);
      await overviewPage.open();
      await overviewPage.expectControlPlanesErrorState();
      await overviewPage.expectClustersErrorState();
    }
  );

  test('Control planes card can retry after error', coreCachingOnly, async ({ page, overviewPage }) => {
    await mockControlPlanesFail(page);
    await overviewPage.open();
    await overviewPage.expectControlPlanesErrorState();
    await mockControlPlanesHealthy(page, 1);
    await overviewPage.clickTryAgainInControlPlanesCard();
    await overviewPage.expectControlPlanesCount(1);
  });

  test(
    'Control plane links in popover navigate to Mesh page with cluster filter',
    coreCachingOnly,
    async ({ page, overviewPage }) => {
      await mockControlPlanesUnhealthy(page, 'Kubernetes');
      await overviewPage.open();
      await overviewPage.openControlPlanesIssuesPopover();
      await overviewPage.clickControlPlaneLinkInPopover('istiod-kubernetes');
      await overviewPage.expectMeshPageWithClusterFilter('Kubernetes');
    }
  );

  test(
    'Data planes footer link navigates to Namespaces list with type filter',
    coreCachingOnly,
    async ({ overviewPage }) => {
      await overviewPage.open();
      await overviewPage.clickViewDataPlanes();
      await overviewPage.expectNamespacesPageWithDataPlaneFilter();
    }
  );

  test('Clusters card can retry after error', coreCachingOnly, async ({ page, overviewPage }) => {
    const clustersRetry = await mockClustersFailOnce(page);
    await overviewPage.open();
    await overviewPage.expectClustersErrorState();
    clustersRetry.allowSuccess();
    await overviewPage.clickTryAgainInClustersCard();
    await overviewPage.expectClustersCountAndFooterLink();
  });

  test('Clusters card shows no data state with dash', coreCachingOnly, async ({ page, overviewPage }) => {
    await mockClustersEmpty(page);
    await overviewPage.open();
    await overviewPage.expectClustersNoDataState();
  });

  test('Clusters card displays cluster count from backend', coreCachingOnly, async ({ overviewPage }) => {
    await overviewPage.open();
    await overviewPage.expectClustersCountAndFooterLink();
  });

  test('Clusters card View Mesh link navigates to mesh page', coreCachingOnly, async ({ overviewPage }) => {
    await overviewPage.open();
    await overviewPage.clickViewMeshInClustersCard();
    await overviewPage.expectMeshPage();
  });

  test(
    'Service insights card shows loading state without tables or footer link',
    coreCachingOnly,
    async ({ page, overviewPage }) => {
      await mockServiceInsightsSlow(page);
      await overviewPage.openPending();
      await overviewPage.expectServiceInsightsLoadingState();
    }
  );

  test(
    'Service insights card shows error state without tables or footer link',
    coreCachingOnly,
    async ({ page, overviewPage }) => {
      await mockServiceInsightsFail(page);
      await overviewPage.open();
      await overviewPage.expectServiceInsightsErrorState();
    }
  );

  test('Service insights card can retry after error', coreCachingOnly, async ({ page, overviewPage }) => {
    await mockServiceInsightsFailOnce(page);
    await overviewPage.open();
    await overviewPage.expectServiceInsightsErrorState();
    await overviewPage.clickTryAgainInServiceInsightsCard();
    await overviewPage.expectServiceInsightsDataAndFooterLink();
  });

  test(
    'Service insights footer link navigates to Services list with all namespaces and sort',
    coreCachingOnly,
    async ({ overviewPage }) => {
      await overviewPage.open();
      await overviewPage.clickViewAllServicesInServiceInsightsCard();
      await overviewPage.expectServicesListWithAllNamespacesAndSorting();
    }
  );

  test('Service insights service link navigates to service details', coreCachingOnly, async ({ overviewPage }) => {
    await overviewPage.open();
    await overviewPage.clickValidServiceInsightsLink();
    await overviewPage.expectServiceDetailsPageFromInsightsLink();
  });

  test('Service insights card shows mock rate table', coreCachingOnly, async ({ page, overviewPage }) => {
    await mockServiceInsightsRates(page);
    await overviewPage.open();
    await overviewPage.expectServiceInsightsMockDataTables();
  });

  test('Applications card shows loading state without footer link', coreCachingOnly, async ({ page, overviewPage }) => {
    await mockApplicationsSlow(page);
    await overviewPage.openPending();
    await overviewPage.expectApplicationsLoadingState();
  });

  test('Applications card shows error state without footer link', coreCachingOnly, async ({ page, overviewPage }) => {
    await mockApplicationsFail(page);
    await overviewPage.open();
    await overviewPage.expectApplicationsErrorState();
  });

  test('Applications card can retry after error', coreCachingOnly, async ({ page, overviewPage }) => {
    await mockApplicationsFailOnce(page);
    await overviewPage.open();
    await overviewPage.expectApplicationsErrorState();
    await overviewPage.clickTryAgainInApplicationsCard();
    await overviewPage.expectApplicationsDataAndFooterLink();
  });

  test('Applications card footer link navigates to Applications list', coreCachingOnly, async ({ overviewPage }) => {
    await overviewPage.open();
    await overviewPage.clickViewAllApplications();
    await overviewPage.expectApplicationsListWithAllNamespaces();
  });

  test('Applications card shows mock rate data', coreCachingOnly, async ({ page, overviewPage }) => {
    await mockApplicationsRates(page);
    await overviewPage.open();
    await overviewPage.expectApplicationsMockRateData();
  });
});
