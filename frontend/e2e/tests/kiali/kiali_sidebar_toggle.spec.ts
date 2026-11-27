import { test } from '../../fixtures/kialiFixtures';
import { coreCachingOnly, smokeAndCoreCaching } from '../../utils/suite-tags';

test.describe('Sidebar toggle', () => {
  test.beforeEach(async ({ sidebarPage }) => {
    await sidebarPage.openOverview();
  });

  test('Close the sidebar', coreCachingOnly, async ({ sidebarPage }) => {
    await sidebarPage.ensureSidebarOpen();
    await sidebarPage.toggleNavigation();
    await sidebarPage.expectSidebarHidden();
  });

  test('Open the sidebar', smokeAndCoreCaching, async ({ sidebarPage }) => {
    await sidebarPage.ensureSidebarClosed();
    await sidebarPage.toggleNavigation();
    await sidebarPage.expectSidebarVisible();
  });
});
