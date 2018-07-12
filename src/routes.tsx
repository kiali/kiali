import ServiceGraphRouteHandler from './pages/ServiceGraph/ServiceGraphRouteHandler';
import ServiceListPage from './pages/ServiceList/ServiceListPage';
import IstioConfigPage from './pages/IstioConfigList/IstioConfigListPage';
import ServiceJaegerPage from './pages/ServiceJaeger/ServiceJaegerPage';
import ServiceDetailsPage from './pages/ServiceDetails/ServiceDetailsPage';
import IstioConfigDetailsPage from './pages/IstioConfigDetails/IstioConfigDetailsPage';
import { Route, Path } from './types/Routes';

const baseName = '/console';

/**
 * Return array of objects that describe vertical menu
 * @return {array}
 */
const routes: Route[] = [
  {
    iconClass: 'fa pficon-topology',
    title: 'Graph',
    to: '/service-graph/all',
    redirect: true,
    component: ServiceGraphRouteHandler,
    pathsActive: [/^\/service-graph\/(.*)\//]
  },
  {
    iconClass: 'fa pficon-service',
    title: 'Services',
    to: '/services',
    component: ServiceListPage,
    pathsActive: [/^\/namespaces\/(.*)\/services\/(.*)/]
  },
  {
    iconClass: 'fa pficon-template',
    title: 'Istio Config',
    to: '/istio',
    component: IstioConfigPage,
    pathsActive: [/^\/namespaces\/(.*)\/istio\/(.*)/]
  },
  {
    iconClass: 'fa fa-paw',
    title: 'Distributed Tracing',
    to: '/jaeger',
    component: ServiceJaegerPage
  }
];

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
  }
];

export { baseName, routes, pathRoutes };
