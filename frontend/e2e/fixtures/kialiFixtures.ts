import { test as base } from '@playwright/test';
import { AppsPage } from '../pages/AppsPage';
import { AppDetailsPage } from '../pages/AppDetailsPage';
import { OverviewPage } from '../pages/OverviewPage';
import { ServicesPage } from '../pages/ServicesPage';
import { GraphPage } from '../pages/GraphPage';
import { SidebarPage } from '../pages/SidebarPage';
import { IstioConfigPage } from '../pages/IstioConfigPage';
import { MeshPage } from '../pages/MeshPage';
import { WorkloadsPage } from '../pages/WorkloadsPage';

type KialiFixtures = {
  appDetailsPage: AppDetailsPage;
  appsPage: AppsPage;
  graphPage: GraphPage;
  istioConfigPage: IstioConfigPage;
  meshPage: MeshPage;
  overviewPage: OverviewPage;
  servicesPage: ServicesPage;
  sidebarPage: SidebarPage;
  workloadsPage: WorkloadsPage;
};

/**
 * Kiali page-object fixtures. Extend this as more POMs are migrated.
 */
export const test = base.extend<KialiFixtures>({
  appDetailsPage: async ({ page }, use) => {
    await use(new AppDetailsPage(page));
  },
  appsPage: async ({ page }, use) => {
    await use(new AppsPage(page));
  },
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
  },
  workloadsPage: async ({ page }, use) => {
    await use(new WorkloadsPage(page));
  }
});

export { expect } from '@playwright/test';
