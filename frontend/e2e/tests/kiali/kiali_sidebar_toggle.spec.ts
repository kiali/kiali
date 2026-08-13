import { test } from '../../fixtures/kialiFixtures';

test.describe('Sidebar toggle', () => {
  test.beforeEach(async ({ sidebarPage }) => {
    await sidebarPage.openOverview();
  });

  test('Close the sidebar @core-caching', async ({ sidebarPage }) => {
    await sidebarPage.ensureSidebarOpen();
    await sidebarPage.toggleNavigation();
    await sidebarPage.expectSidebarHidden();
  });

  test('Open the sidebar @smoke @core-caching', async ({ sidebarPage }) => {
    await sidebarPage.ensureSidebarClosed();
    await sidebarPage.toggleNavigation();
    await sidebarPage.expectSidebarVisible();
  });
});
