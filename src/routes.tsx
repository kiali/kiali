import WorkloadListPage from './pages/WorkloadList/WorkloadListPage';
import ServiceListPage from './pages/ServiceList/ServiceListPage';
import IstioConfigPage from './pages/IstioConfigList/IstioConfigListPage';
import ServiceJaegerPage from './pages/ServiceJaeger/ServiceJaegerPage';
import IstioConfigDetailsPage from './pages/IstioConfigDetails/IstioConfigDetailsPage';
import WorkloadDetailsPage from './pages/WorkloadDetails/WorkloadDetailsPage';
import AppListPage from './pages/AppList/AppListPage';
import AppDetailsPage from './pages/AppDetails/AppDetailsPage';
import OverviewPageContainer from './pages/Overview/OverviewPage';
import { MenuItem, Path } from './types/Routes';
import GraphPageContainer from './pages/Graph/GraphPage';
import { icons, Paths } from './config';
import ServiceDetailsPageContainer from './pages/ServiceDetails/ServiceDetailsPage';
import DefaultSecondaryMasthead from './components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';

/**
 * Return array of objects that describe vertical menu
 * @return {array}
 */
const navItems: MenuItem[] = [
  {
    iconClass: icons.menu.overview,
    title: 'Overview',
    to: '/overview',
    pathsActive: [/^\/overview\/(.*)/]
  },
  {
    iconClass: icons.menu.graph,
    title: 'Graph',
    to: '/graph/namespaces/',
    pathsActive: [/^\/graph\/(.*)/]
  },
  {
    iconClass: icons.menu.applications,
    title: 'Applications',
    to: '/' + Paths.APPLICATIONS,
    pathsActive: [new RegExp('^/namespaces/(.*)/' + Paths.APPLICATIONS + '/(.*)')]
  },
  {
    iconClass: icons.menu.workloads,
    title: 'Workloads',
    to: '/' + Paths.WORKLOADS,
    pathsActive: [new RegExp('^/namespaces/(.*)/' + Paths.WORKLOADS + '/(.*)')]
  },
  {
    iconClass: icons.menu.services,
    title: 'Services',
    to: '/' + Paths.SERVICES,
    pathsActive: [new RegExp('^/namespaces/(.*)/' + Paths.SERVICES + '/(.*)')]
  },
  {
    iconClass: icons.menu.istioConfig,
    title: 'Istio Config',
    to: '/' + Paths.ISTIO,
    pathsActive: [new RegExp('^/namespaces/(.*)/' + Paths.ISTIO + '/(.*)')]
  },
  {
    iconClass: icons.menu.distributedTracing,
    title: 'Distributed Tracing',
    to: '/jaeger'
  }
];

const defaultRoute = '/overview';

const pathRoutes: Path[] = [
  {
    path: '/overview',
    component: OverviewPageContainer
  },
  {
    path: '/graph/node/namespaces/:namespace/' + Paths.APPLICATIONS + '/:app/versions/:version',
    component: GraphPageContainer
  },
  {
    path: '/graph/node/namespaces/:namespace/' + Paths.APPLICATIONS + '/:app',
    component: GraphPageContainer
  },
  {
    path: '/graph/node/namespaces/:namespace/' + Paths.SERVICES + '/:service',
    component: GraphPageContainer
  },
  {
    path: '/graph/node/namespaces/:namespace/' + Paths.WORKLOADS + '/:workload',
    component: GraphPageContainer
  },
  {
    path: '/graph/namespaces',
    component: GraphPageContainer
  },
  {
    path: '/namespaces/:namespace/' + Paths.SERVICES + '/:service',
    component: ServiceDetailsPageContainer
  },
  // NOTE that order on routes is important
  {
    path: '/namespaces/:namespace/' + Paths.ISTIO + '/:objectType/:objectSubtype/:object',
    component: IstioConfigDetailsPage
  },
  {
    path: '/namespaces/:namespace/' + Paths.ISTIO + '/:objectType/:object',
    component: IstioConfigDetailsPage
  },
  {
    path: '/' + Paths.SERVICES,
    component: ServiceListPage
  },
  {
    path: '/' + Paths.APPLICATIONS,
    component: AppListPage
  },
  {
    path: '/namespaces/:namespace/' + Paths.APPLICATIONS + '/:app',
    component: AppDetailsPage
  },
  {
    path: '/' + Paths.WORKLOADS,
    component: WorkloadListPage
  },
  {
    path: '/namespaces/:namespace/' + Paths.WORKLOADS + '/:workload',
    component: WorkloadDetailsPage
  },
  {
    path: '/' + Paths.ISTIO,
    component: IstioConfigPage
  },
  {
    path: '/' + Paths.JAEGER,
    component: ServiceJaegerPage
  }
];

const secondaryMastheadRoutes: Path[] = [
  {
    path: '/graph/namespaces',
    component: DefaultSecondaryMasthead
  },
  {
    path: '/' + Paths.APPLICATIONS,
    component: DefaultSecondaryMasthead
  },
  {
    path: '/' + Paths.SERVICES,
    component: DefaultSecondaryMasthead
  },
  {
    path: '/' + Paths.WORKLOADS,
    component: DefaultSecondaryMasthead
  },
  {
    path: '/' + Paths.ISTIO,
    component: DefaultSecondaryMasthead
  },
  {
    path: '/' + Paths.JAEGER,
    component: DefaultSecondaryMasthead
  }
];

export { defaultRoute, navItems, pathRoutes, secondaryMastheadRoutes };
