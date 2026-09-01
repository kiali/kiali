import { test as base } from '@playwright/test';
import { AppDetailsPage } from '../pages/AppDetailsPage';
import { AppsPage } from '../pages/AppsPage';
import { GraphPage } from '../pages/GraphPage';
import { IstioConfigPage } from '../pages/IstioConfigPage';
import { IstioConfigWizardPage } from '../pages/IstioConfigWizardPage';
import { K8sRoutingWizardPage } from '../pages/K8sRoutingWizardPage';
import { MeshPage } from '../pages/MeshPage';
import { NamespaceDetailPage } from '../pages/NamespaceDetailPage';
import { OverviewPage } from '../pages/OverviewPage';
import { ServiceDetailsPage } from '../pages/ServiceDetailsPage';
import { ServicesPage } from '../pages/ServicesPage';
import { SidebarPage } from '../pages/SidebarPage';
import { WorkloadDetailsPage } from '../pages/WorkloadDetailsPage';
import { WorkloadsPage } from '../pages/WorkloadsPage';

type KialiFixtures = {
  appDetailsPage: AppDetailsPage;
  appsPage: AppsPage;
  graphPage: GraphPage;
  istioConfigPage: IstioConfigPage;
  istioConfigWizardPage: IstioConfigWizardPage;
  k8sRoutingWizardPage: K8sRoutingWizardPage;
  meshPage: MeshPage;
  namespaceDetailPage: NamespaceDetailPage;
  overviewPage: OverviewPage;
  serviceDetailsPage: ServiceDetailsPage;
  servicesPage: ServicesPage;
  sidebarPage: SidebarPage;
  workloadDetailsPage: WorkloadDetailsPage;
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
  graphPage: async ({ page }, use) => {
    await use(new GraphPage(page));
  },
  istioConfigPage: async ({ page }, use) => {
    await use(new IstioConfigPage(page));
  },
  istioConfigWizardPage: async ({ page }, use) => {
    await use(new IstioConfigWizardPage(page));
  },
  k8sRoutingWizardPage: async ({ page }, use) => {
    await use(new K8sRoutingWizardPage(page));
  },
  meshPage: async ({ page }, use) => {
    await use(new MeshPage(page));
  },
  namespaceDetailPage: async ({ page }, use) => {
    await use(new NamespaceDetailPage(page));
  },
  overviewPage: async ({ page }, use) => {
    await use(new OverviewPage(page));
  },
  serviceDetailsPage: async ({ page }, use) => {
    await use(new ServiceDetailsPage(page));
  },
  servicesPage: async ({ page }, use) => {
    await use(new ServicesPage(page));
  },
  sidebarPage: async ({ page }, use) => {
    await use(new SidebarPage(page));
  },
  workloadDetailsPage: async ({ page }, use) => {
    await use(new WorkloadDetailsPage(page));
  },
  workloadsPage: async ({ page }, use) => {
    await use(new WorkloadsPage(page));
  }
});

export { expect } from '@playwright/test';
