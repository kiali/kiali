import { test } from '../../fixtures/kialiFixtures';
import { skipUnlessGraphTestMetrics } from '../../utils/healthTestMetrics';
import { isOssmc } from '../../utils/kialiConfig';
import { coreCachingOnly } from '../../utils/suite-tags';

test.describe('Graph display cache core-caching', () => {
  test(
    'Graph cache metrics increase across repeated graph API requests',
    coreCachingOnly,
    async ({ graphPage, request }) => {
      test.skip(isOssmc(), 'Graph cache metrics are unavailable in OSSMC kiosk mode');
      await skipUnlessGraphTestMetrics(request);

      await graphPage.expectGraphCacheEnabled();
      const before = await graphPage.readGraphCacheMetrics();
      await graphPage.openGraphWithRefresh('bookinfo', 60_000);
      await graphPage.refreshGraphTimes(3);
      await graphPage.expectGraphCacheMetricsIncreased(before, 1, 2);
    }
  );
});
