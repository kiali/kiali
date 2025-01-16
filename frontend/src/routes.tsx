import * as React from 'react';
import { MenuItem } from './types/Routes';
import { Paths } from './config';
import { WorkloadListPage } from './pages/WorkloadList/WorkloadListPage';
import { ServiceListPage } from './pages/ServiceList/ServiceListPage';
import { IstioConfigListPage } from './pages/IstioConfigList/IstioConfigListPage';
import { AppListPage } from './pages/AppList/AppListPage';
import { OverviewPage } from './pages/Overview/OverviewPage';
import { GraphPage } from 'pages/Graph/GraphPage';
import { MeshPage } from 'pages/Mesh/MeshPage';
import { GraphRoute } from 'routes/GraphRoute';
import { ServiceDetailsRoute } from 'routes/ServiceDetailsRoute';
import { WorkloadDetailsRoute } from 'routes/WorkloadDetailsRoute';
import { AppDetailsRoute } from 'routes/AppDetailsRoute';
import { IstioConfigDetailsRoute } from 'routes/IstioConfigDetailsRoute';
import { IstioConfigNewRoute } from 'routes/IstioConfigNewRoute';
import { GraphRoutePF } from 'routes/GraphRoutePF';
import { GraphPagePF } from 'pages/GraphPF/GraphPagePF';
import { t } from 'utils/I18nUtils';
import { RouteObject } from 'react-router-dom-v5-compat';
import { WildcardRoute } from 'routes/WildcardRoute';

/**
 * Return array of objects that describe vertical menu
 * @return {array}
 */
const navMenuItems: MenuItem[] = [
  {
    id: 'overview',
    title: t('Overview'),
    to: '/overview',
    pathsActive: [/^\/overview\/(.*)/]
  },
  {
    id: 'traffic_graph_cy',
    title: t('Traffic Graph [Cy]'),
    to: '/graph/namespaces/',
    pathsActive: [/^\/graph\/(.*)/]
  },
  {
    id: 'traffic_graph_pf',
    title: t('Traffic Graph [PF]'),
    to: '/graphpf/namespaces/',
    pathsActive: [/^\/graphpf\/(.*)/]
  },
  {
    id: 'applications',
    title: t('Applications'),
    to: `/${Paths.APPLICATIONS}`,
    pathsActive: [new RegExp(`^/namespaces/(.*)/${Paths.APPLICATIONS}/(.*)`)]
  },
  {
    id: 'workloads',
    title: t('Workloads'),
    to: `/${Paths.WORKLOADS}`,
    pathsActive: [new RegExp(`^/namespaces/(.*)/${Paths.WORKLOADS}/(.*)`)]
  },
  {
    id: 'services',
    title: t('Services'),
    to: `/${Paths.SERVICES}`,
    pathsActive: [new RegExp(`^/namespaces/(.*)/${Paths.SERVICES}/(.*)`)]
  },
  {
    id: 'istio',
    title: t('Istio Config'),
    to: `/${Paths.ISTIO}`,
    pathsActive: [new RegExp(`^/namespaces/(.*)/${Paths.ISTIO}/(.*)`), new RegExp(`/${Paths.ISTIO}/new/(.*)`)]
  },
  {
    id: 'tracing',
    title: t('Distributed Tracing'),
    to: '/tracing'
  },
  {
    id: 'mesh',
    title: t('Mesh'),
    to: '/mesh'
  }
];

const pathRoutes: RouteObject[] = [
  {
    path: '/overview',
    element: <OverviewPage />
  },
  {
    path: `/graph/node/namespaces/:namespace/${Paths.AGGREGATES}/:aggregate/:aggregateValue`,
    element: <GraphRoute />
  },
  {
    path: `/graph/node/namespaces/:namespace/${Paths.APPLICATIONS}/:app/versions/:version`,
    element: <GraphRoute />
  },
  {
    path: `/graph/node/namespaces/:namespace/${Paths.APPLICATIONS}/:app`,
    element: <GraphRoute />
  },
  {
    path: `/graph/node/namespaces/:namespace/${Paths.SERVICES}/:service`,
    element: <GraphRoute />
  },
  {
    path: `/graph/node/namespaces/:namespace/${Paths.WORKLOADS}/:workload`,
    element: <GraphRoute />
  },
  {
    path: '/graph/namespaces',
    element: <GraphPage />
  },
  {
    path: `/graphpf/node/namespaces/:namespace/${Paths.AGGREGATES}/:aggregate/:aggregateValue`,
    element: <GraphRoutePF />
  },
  {
    path: `/graphpf/node/namespaces/:namespace/${Paths.APPLICATIONS}/:app/versions/:version`,
    element: <GraphRoutePF />
  },
  {
    path: `/graphpf/node/namespaces/:namespace/${Paths.APPLICATIONS}/:app`,
    element: <GraphRoutePF />
  },
  {
    path: `/graphpf/node/namespaces/:namespace/${Paths.SERVICES}/:service`,
    element: <GraphRoutePF />
  },
  {
    path: `/graphpf/node/namespaces/:namespace/${Paths.WORKLOADS}/:workload`,
    element: <GraphRoutePF />
  },
  {
    path: '/graphpf/namespaces',
    element: <GraphPagePF />
  },
  {
    path: `/namespaces/:namespace/${Paths.SERVICES}/:service`,
    element: <ServiceDetailsRoute />
  },
  {
    path: `/namespaces/:namespace/${Paths.ISTIO}/:objectGroup/:objectVersion/:objectKind/:objectName`,
    element: <IstioConfigDetailsRoute />
  },
  {
    path: `/${Paths.SERVICES}`,
    element: <ServiceListPage />
  },
  {
    path: `/${Paths.APPLICATIONS}`,
    element: <AppListPage />
  },
  {
    path: `/namespaces/:namespace/${Paths.APPLICATIONS}/:app`,
    element: <AppDetailsRoute />
  },
  {
    path: `/${Paths.WORKLOADS}`,
    element: <WorkloadListPage />
  },
  {
    path: `/namespaces/:namespace/${Paths.WORKLOADS}/:workload`,
    element: <WorkloadDetailsRoute />
  },
  {
    path: `/${Paths.ISTIO}/new/:objectGroup/:objectVersion/:objectKind`,
    element: <IstioConfigNewRoute />
  },
  {
    path: `/${Paths.ISTIO}`,
    element: <IstioConfigListPage />
  },
  {
    path: `/${Paths.TRACING}`,
    element: <></>
  },
  {
    path: `/${Paths.MESH}`,
    element: <MeshPage />
  },
  { path: '*', element: <WildcardRoute /> }
];

export { navMenuItems, pathRoutes };
