import { test } from '../../fixtures/kialiFixtures';
import { ensureDemoApp } from '../../utils/demoApps';
import { coreCachingOnly } from '../../utils/suite-tags';

test.describe('Namespace details core-caching', () => {
  test.beforeEach(async ({ namespaceDetailPage }) => {
    ensureDemoApp('bookinfo');
    await namespaceDetailPage.open('bookinfo');
  });

  test('See namespace detail overview', coreCachingOnly, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectOverview('bookinfo');
    await namespaceDetailPage.expectTitle('bookinfo');
  });

  test('See namespace details card attributes', coreCachingOnly, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectDetailsCardEntry('Status');
    await namespaceDetailPage.expectDetailsCardEntry('Type');
    await namespaceDetailPage.expectDetailsCardEntry('Mode');
  });

  test('See namespace resources card', coreCachingOnly, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectCard('Resources');
    await namespaceDetailPage.expectResourceLink('Applications');
    await namespaceDetailPage.expectResourceLink('Services');
    await namespaceDetailPage.expectResourceLink('Workloads');
    await namespaceDetailPage.expectResourceLink('Istio config');
  });

  test('See namespace labels card', coreCachingOnly, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectCard('Labels');
  });

  test('See namespace annotations card', coreCachingOnly, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectCard('Annotations');
  });

  test('See namespace minigraph', coreCachingOnly, async ({ namespaceDetailPage }) => {
    await namespaceDetailPage.expectMinigraphVisible();
  });
});
