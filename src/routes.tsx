import { lazy } from 'react';
import { MenuItem, Path } from './types/Routes';
import { icons, Paths } from './config';
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

const graphPage = lazy(() => import('./pages/Graph/GraphPage'));
const istioConfigDetailsPage = lazy(() => import('./pages/IstioConfigDetails/IstioConfigDetailsPage'));

const pathRoutes: Path[] = [
  {
    path: '/overview',
    component: lazy(() => import('./pages/Overview/OverviewPage'))
  },
  {
    path: '/graph/node/namespaces/:namespace/' + Paths.APPLICATIONS + '/:app/versions/:version',
    component: graphPage
  },
  {
    path: '/graph/node/namespaces/:namespace/' + Paths.APPLICATIONS + '/:app',
    component: graphPage
  },
  {
    path: '/graph/node/namespaces/:namespace/' + Paths.SERVICES + '/:service',
    component: graphPage
  },
  {
    path: '/graph/node/namespaces/:namespace/' + Paths.WORKLOADS + '/:workload',
    component: graphPage
  },
  {
    path: '/graph/namespaces',
    component: graphPage
  },
  {
    path: '/namespaces/:namespace/' + Paths.SERVICES + '/:service',
    component: lazy(() => import('./pages/ServiceDetails/ServiceDetailsPage'))
  },
  // NOTE that order on routes is important
  {
    path: '/namespaces/:namespace/' + Paths.ISTIO + '/:objectType/:objectSubtype/:object',
    component: istioConfigDetailsPage
  },
  {
    path: '/namespaces/:namespace/' + Paths.ISTIO + '/:objectType/:object',
    component: istioConfigDetailsPage
  },
  {
    path: '/' + Paths.SERVICES,
    component: lazy(() => import('./pages/ServiceList/ServiceListPage'))
  },
  {
    path: '/' + Paths.APPLICATIONS,
    component: lazy(() => import('./pages/AppList/AppListPage'))
  },
  {
    path: '/namespaces/:namespace/' + Paths.APPLICATIONS + '/:app',
    component: lazy(() => import('./pages/AppDetails/AppDetailsPage'))
  },
  {
    path: '/' + Paths.WORKLOADS,
    component: lazy(() => import('./pages/WorkloadList/WorkloadListPage'))
  },
  {
    path: '/namespaces/:namespace/' + Paths.WORKLOADS + '/:workload',
    component: lazy(() => import('./pages/WorkloadDetails/WorkloadDetailsPage'))
  },
  {
    path: '/' + Paths.ISTIO,
    component: lazy(() => import('./pages/IstioConfigList/IstioConfigListPage'))
  },
  {
    path: '/' + Paths.JAEGER,
    component: lazy(() => import('./pages/ServiceJaeger/ServiceJaegerPage'))
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
