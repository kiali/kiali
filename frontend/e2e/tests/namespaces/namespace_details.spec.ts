import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { coreCachingAndOffline, coreCachingOnly } from '../../utils/suite-tags';

test.describe('Namespace details core-caching', () => {
  test.beforeEach(async ({ namespaceDetailPage }) => {
    ensureDemoApp('bookinfo');
    await namespaceDetailPage.open('bookinfo');
  });

  test('See namespace detail overview', coreCachingAndOffline, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectOverview('bookinfo');
    await namespaceDetailPage.expectTitle('bookinfo');
  });

  test('See namespace details card attributes', coreCachingAndOffline, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectDetailsCardEntry('Status');
    await namespaceDetailPage.expectDetailsCardEntry('Type');
    await namespaceDetailPage.expectDetailsCardEntry('Mode');
  });

  test('See namespace resources card', coreCachingAndOffline, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectCard('Resources');
    await namespaceDetailPage.expectResourceLink('Applications');
    await namespaceDetailPage.expectResourceLink('Services');
    await namespaceDetailPage.expectResourceLink('Workloads');
    await namespaceDetailPage.expectResourceLink('Istio config');
  });

  test('See namespace labels card', coreCachingAndOffline, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectCard('Labels');
  });

  test('See namespace annotations card', coreCachingAndOffline, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectCard('Annotations');
  });

  test('See namespace minigraph', coreCachingOnly, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectMinigraphVisible();
  });
});
