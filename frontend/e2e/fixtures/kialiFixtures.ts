import { test as base } from '@playwright/test';
import { OverviewPage } from '../pages/OverviewPage';
import { ServicesPage } from '../pages/ServicesPage';
import { GraphPage } from '../pages/GraphPage';
import { SidebarPage } from '../pages/SidebarPage';
import { IstioConfigPage } from '../pages/IstioConfigPage';
import { MeshPage } from '../pages/MeshPage';

type KialiFixtures = {
  graphPage: GraphPage;
  istioConfigPage: IstioConfigPage;
  meshPage: MeshPage;
  overviewPage: OverviewPage;
  servicesPage: ServicesPage;
  sidebarPage: SidebarPage;
};

/**
 * Kiali page-object fixtures. Extend this as more POMs are migrated.
 */
export const test = base.extend<KialiFixtures>({
  overviewPage: async ({ page }, use) => {
    await use(new OverviewPage(page));
  },
  servicesPage: async ({ page }, use) => {
    await use(new ServicesPage(page));
  },
  graphPage: async ({ page }, use) => {
    await use(new GraphPage(page));
  },
  sidebarPage: async ({ page }, use) => {
    await use(new SidebarPage(page));
  },
  istioConfigPage: async ({ page }, use) => {
    await use(new IstioConfigPage(page));
  },
  meshPage: async ({ page }, use) => {
    await use(new MeshPage(page));
  }
});

export { expect } from '@playwright/test';
