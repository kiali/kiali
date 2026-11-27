import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { skipUnlessHealthTestMetrics, skipUnlessHealthStatusTestMetrics } from '../../utils/healthTestMetrics';
import { coreCachingOnly } from '../../utils/suite-tags';

test.describe('Apps list caching metrics', () => {
  test.beforeEach(() => {
    ensureDemoApp('bookinfo');
  });

  test('Health cache metrics increase when visiting apps list page', coreCachingOnly, async ({ appsPage, request }) => {
    await skipUnlessHealthTestMetrics(request);
    await appsPage.expectHealthCacheEnabled();
    const before = await appsPage.recordHealthCacheMetrics();
    await appsPage.visitListForNamespace('bookinfo');
    await appsPage.expectHealthCacheHitsIncreased(before, 1);
  });

  test('Health status metric exports health values for apps', coreCachingOnly, async ({ appsPage, request }) => {
    await skipUnlessHealthStatusTestMetrics(request);
    await appsPage.visitListForNamespace('bookinfo');
    await appsPage.expectHealthStatusMetricsNotEmpty();
  });

  test('Health status metric shows healthy apps correctly', coreCachingOnly, async ({ appsPage, request }) => {
    await skipUnlessHealthStatusTestMetrics(request);
    await appsPage.visitListForNamespace('bookinfo');
    await appsPage.expectHealthStatusMetricForApp('bookinfo', 'details', 'Healthy');
  });
});
