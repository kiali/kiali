import ServiceGraphRouteHandler from './pages/ServiceGraph/ServiceGraphRouteHandler';
import WorkloadListPage from './pages/WorkloadList/WorkloadListPage';
import ServiceListPage from './pages/ServiceList/ServiceListPage';
import IstioConfigPage from './pages/IstioConfigList/IstioConfigListPage';
import ServiceJaegerPage from './pages/ServiceJaeger/ServiceJaegerPage';
import ServiceDetailsPage from './pages/ServiceDetails/ServiceDetailsPage';
import IstioConfigDetailsPage from './pages/IstioConfigDetails/IstioConfigDetailsPage';
import WorkloadDetailsPage from './pages/WorkloadDetails/WorkloadDetailsPage';
import { MenuItem, Path } from './types/Routes';

/**
 * Return array of objects that describe vertical menu
 * @return {array}
 */
const navItems: MenuItem[] = [
  {
    iconClass: 'fa pficon-topology',
    title: 'Graph',
    to: '/service-graph/all',
    pathsActive: [/^\/service-graph\/(.*)/]
  },
  {
    iconClass: 'fa pficon-bundle',
    title: 'Workloads',
    to: '/workloads',
    pathsActive: [/^\/namespaces\/(.*)\/workloads\/(.*)/]
  },
  {
    iconClass: 'fa pficon-service',
    title: 'Services',
    to: '/services',
    pathsActive: [/^\/namespaces\/(.*)\/services\/(.*)/]
  },
  {
    iconClass: 'fa pficon-template',
    title: 'Istio Config',
    to: '/istio',
    pathsActive: [/^\/namespaces\/(.*)\/istio\/(.*)/]
  },
  {
    iconClass: 'fa fa-paw',
    title: 'Distributed Tracing',
    to: '/jaeger'
  }
];

const defaultRoute = '/service-graph/all';

const pathRoutes: Path[] = [
  {
    path: '/service-graph/:namespace',
    component: ServiceGraphRouteHandler
  },
  {
    path: '/namespaces/:namespace/services/:service',
    component: ServiceDetailsPage
  },
  {
    path: '/namespaces/:namespace/istio/:objectType/:object',
    component: IstioConfigDetailsPage
  },
  {
    path: '/services',
    component: ServiceListPage
  },
  {
    path: '/workloads',
    component: WorkloadListPage
  },
  {
    path: '/namespaces/:namespace/workloads/:workload',
    component: WorkloadDetailsPage
  },
  {
    path: '/istio',
    component: IstioConfigPage
  },
  {
    path: '/jaeger',
    component: ServiceJaegerPage
  }
];

export { defaultRoute, navItems, pathRoutes };
