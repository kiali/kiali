import WorkloadListPage from './pages/WorkloadList/WorkloadListPage';
import ServiceListPage from './pages/ServiceList/ServiceListPage';
import IstioConfigPage from './pages/IstioConfigList/IstioConfigListPage';
import IstioConfigDetailsPage from './pages/IstioConfigDetails/IstioConfigDetailsPage';
import WorkloadDetailsPage from './pages/WorkloadDetails/WorkloadDetailsPage';
import AppListPage from './pages/AppList/AppListPage';
import AppDetailsPage from './pages/AppDetails/AppDetailsPage';
import OverviewPageContainer from './pages/Overview/OverviewPage';
import { MenuItem, Path } from './types/Routes';
import GraphPageContainer from './pages/Graph/GraphPage';
import { Paths } from './config';
import ServiceDetailsPageContainer from './pages/ServiceDetails/ServiceDetailsPage';
import DefaultSecondaryMasthead from './components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import IstioConfigNewPageContainer from './pages/IstioConfigNew/IstioConfigNewPage';
import ThreeScaleHandlerListPage from './pages/extensions/threescale/ThreeScaleHandlerList/ThreeScaleHandlerListPage';
import ThreeScaleHandlerDetailsPage from './pages/extensions/threescale/ThreeScaleHandlerDetails/ThreeScaleHandlerDetailsPage';
import ExperimentListPage from './pages/extensions/iter8/Iter8ExperimentList/ExperimentListPage';
import ExperimentCreatePageContainer from './pages/extensions/iter8/Iter8ExperimentDetails/ExperimentCreatePage';
import ExperimentDetailsPage from './pages/extensions/iter8/Iter8ExperimentDetails/ExperimentDetailsPage';

/**
 * Return array of objects that describe vertical menu
 * @return {array}
 */
const navItems: MenuItem[] = [
  {
    title: 'Overview',
    to: '/overview',
    pathsActive: [/^\/overview\/(.*)/]
  },
  {
    title: 'Graph',
    to: '/graph/namespaces/',
    pathsActive: [/^\/graph\/(.*)/]
  },
  {
    title: 'Applications',
    to: '/' + Paths.APPLICATIONS,
    pathsActive: [new RegExp('^/namespaces/(.*)/' + Paths.APPLICATIONS + '/(.*)')]
  },
  {
    title: 'Workloads',
    to: '/' + Paths.WORKLOADS,
    pathsActive: [new RegExp('^/namespaces/(.*)/' + Paths.WORKLOADS + '/(.*)')]
  },
  {
    title: 'Services',
    to: '/' + Paths.SERVICES,
    pathsActive: [new RegExp('^/namespaces/(.*)/' + Paths.SERVICES + '/(.*)')]
  },
  {
    title: 'Istio Config',
    to: '/' + Paths.ISTIO,
    pathsActive: [new RegExp('^/namespaces/(.*)/' + Paths.ISTIO + '/(.*)'), new RegExp('/' + Paths.ISTIO + '/new')]
  },
  {
    title: 'Distributed Tracing',
    to: '/jaeger'
  }
];

const extensionsItems: MenuItem[] = [
  {
    title: '3scale Config',
    to: '/extensions/threescale',
    pathsActive: [/^\/extensions\/threescale/]
  },
  {
    title: 'Iter8 Experiments',
    to: '/extensions/iter8',
    pathsActive: [/^\/extensions\/iter8/, new RegExp('^/extensions/namespaces/(.*)/iter8')]
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
    path: '/' + Paths.ISTIO + '/new',
    component: IstioConfigNewPageContainer
  },
  {
    path: '/' + Paths.ISTIO,
    component: IstioConfigPage
  },
  {
    path: '/' + Paths.JAEGER,
    component: undefined
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
  },
  {
    path: '/extensions/iter8',
    component: DefaultSecondaryMasthead
  }
];

const extensionsRoutes: Path[] = [
  // Keep routes ordered with the more specific URLs first
  {
    path: '/extensions/threescale/new',
    component: ThreeScaleHandlerDetailsPage
  },
  {
    path: '/extensions/threescale/:handlerName',
    component: ThreeScaleHandlerDetailsPage
  },
  {
    path: '/extensions/threescale',
    component: ThreeScaleHandlerListPage
  },
  // Extension will follow /extensions/<extension>/namespaces/:namespace/experiments/:name pattern
  // To make RenderPage.tsx routes easy to filter without regex
  {
    path: '/extensions/namespaces/:namespace/iter8/:name',
    component: ExperimentDetailsPage
  },
  {
    path: '/extensions/iter8/new',
    component: ExperimentCreatePageContainer
  },
  {
    path: '/extensions/iter8',
    component: ExperimentListPage
  }
];

export { defaultRoute, navItems, extensionsItems, pathRoutes, secondaryMastheadRoutes, extensionsRoutes };
