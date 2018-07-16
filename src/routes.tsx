import ServiceGraphRouteHandler from './pages/ServiceGraph/ServiceGraphRouteHandler';
import ServiceListPage from './pages/ServiceList/ServiceListPage';
import IstioConfigPage from './pages/IstioConfigList/IstioConfigListPage';
import ServiceJaegerPage from './pages/ServiceJaeger/ServiceJaegerPage';
import ServiceDetailsPage from './pages/ServiceDetails/ServiceDetailsPage';
import IstioConfigDetailsPage from './pages/IstioConfigDetails/IstioConfigDetailsPage';
import { Route, Path } from './types/Routes';

const baseName = '/console';

export const kialiRoute = (route: string) => baseName + route;
/**
 * Return array of objects that describe vertical menu
 * @return {array}
 */
const routes: Route[] = [
  {
    iconClass: 'fa pficon-topology',
    title: 'Graph',
    to: kialiRoute('/service-graph/all'),
    redirect: true,
    component: ServiceGraphRouteHandler,
    pathsActive: [/\/service-graph\/(.*)\//]
  },
  {
    iconClass: 'fa pficon-service',
    title: 'Services',
    to: kialiRoute('/services'),
    component: ServiceListPage,
    pathsActive: [/\/namespaces\/(.*)\/services\/(.*)/]
  },
  {
    iconClass: 'fa pficon-template',
    title: 'Istio Config',
    to: kialiRoute('/istio'),
    component: IstioConfigPage,
    pathsActive: [/\/namespaces\/(.*)\/istio\/(.*)/]
  },
  {
    iconClass: 'fa fa-paw',
    title: 'Distributed Tracing',
    to: kialiRoute('/jaeger'),
    component: ServiceJaegerPage
  }
];

const pathRoutes: Path[] = [
  {
    path: kialiRoute('/service-graph/:namespace'),
    component: ServiceGraphRouteHandler
  },
  {
    path: kialiRoute('/namespaces/:namespace/services/:service'),
    component: ServiceDetailsPage
  },
  {
    path: kialiRoute('/namespaces/:namespace/istio/:objectType/:object'),
    component: IstioConfigDetailsPage
  }
];

export { baseName, routes, pathRoutes };
