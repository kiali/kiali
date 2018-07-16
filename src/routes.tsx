import ServiceGraphRouteHandler from './pages/ServiceGraph/ServiceGraphRouteHandler';
import ServiceListPage from './pages/ServiceList/ServiceListPage';
import IstioConfigPage from './pages/IstioConfigList/IstioConfigListPage';
import ServiceJaegerPage from './pages/ServiceJaeger/ServiceJaegerPage';
import ServiceDetailsPage from './pages/ServiceDetails/ServiceDetailsPage';
import IstioConfigDetailsPage from './pages/IstioConfigDetails/IstioConfigDetailsPage';
import { MenuItem, Path } from './types/Routes';

const baseName = '/console';

export const kialiRoute = (route: string) => baseName + route;
/**
 * Return array of objects that describe vertical menu
 * @return {array}
 */
const navItems: MenuItem[] = [
  {
    iconClass: 'fa pficon-topology',
    title: 'Graph',
    to: kialiRoute('/service-graph/all'),
    pathsActive: [/\/service-graph\/(.*)/]
  },
  {
    iconClass: 'fa pficon-service',
    title: 'Services',
    to: kialiRoute('/services'),
    pathsActive: [/\/namespaces\/(.*)\/services\/(.*)/]
  },
  {
    iconClass: 'fa pficon-template',
    title: 'Istio Config',
    to: kialiRoute('/istio'),
    pathsActive: [/\/namespaces\/(.*)\/istio\/(.*)/]
  },
  {
    iconClass: 'fa fa-paw',
    title: 'Distributed Tracing',
    to: kialiRoute('/jaeger')
  }
];

const defaultRoute = kialiRoute('/service-graph/all');

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
  },
  {
    path: kialiRoute('/services'),
    component: ServiceListPage
  },
  {
    path: kialiRoute('/istio'),
    component: IstioConfigPage
  },
  {
    path: kialiRoute('/jaeger'),
    component: ServiceJaegerPage
  }
];

export { baseName, defaultRoute, navItems, pathRoutes };
