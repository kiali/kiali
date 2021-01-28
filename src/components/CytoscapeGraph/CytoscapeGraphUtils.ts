import * as LayoutDictionary from './graphs/LayoutDictionary';
import { DecoratedGraphEdgeData, DecoratedGraphNodeData, Layout } from '../../types/Graph';
import * as Cy from 'cytoscape';

export const CyEdge = {
  destPrincipal: 'destPrincipal',
  grpc: 'grpc',
  grpcErr: 'grpcErr',
  grpcNoResponse: 'grpcNoResponse',
  grpcPercentErr: 'grpcPercentErr',
  grpcPercentReq: 'grpcPercentReq',
  hasTraffic: 'hasTraffic',
  http: 'http',
  http3xx: 'http3xx',
  http4xx: 'http4xx',
  http5xx: 'http5xx',
  httpNoResponse: 'httpNoResponse',
  httpPercentErr: 'httpPercentErr',
  httpPercentReq: 'httpPercentReq',
  id: 'id',
  isMTLS: 'isMTLS',
  protocol: 'protocol',
  responses: 'responses',
  responseTime: 'responseTime',
  sourcePrincipal: 'sourcePrincipal',
  tcp: 'tcp'
};

export const CyEdgeResponses = {
  flags: 'flags',
  hosts: 'hosts'
};

export const CyNode = {
  aggregate: 'aggregate',
  aggregateValue: 'aggregateValue',
  app: 'app',
  cluster: 'cluster',
  destServices: 'destServices',
  grpcIn: 'grpcIn',
  grpcInErr: 'grpcInErr',
  grpcInNoResponse: 'grpcInNoResponse',
  grpcOut: 'grpcOut',
  hasCB: 'hasCB',
  hasMissingSC: 'hasMissingSC',
  hasVS: 'hasVS',
  health: 'health',
  healthStatus: 'healthStatus',
  httpIn: 'httpIn',
  httpIn3xx: 'httpIn3xx',
  httpIn4xx: 'httpIn4xx',
  httpIn5xx: 'httpIn5xx',
  httpInNoResponse: 'httpInNoResponse',
  httpOut: 'httpOut',
  id: 'id',
  isBox: 'isBox',
  isDead: 'isDead',
  isIdle: 'isIdle',
  isInaccessible: 'isInaccessible',
  isIstio: 'isIstio',
  isMisconfigured: 'isMisconfigured',
  isOutside: 'isOutside',
  isRoot: 'isRoot',
  isServiceEntry: 'isServiceEntry',
  namespace: 'namespace',
  nodeType: 'nodeType',
  service: 'service',
  tcpIn: 'tcpIn',
  tcpOut: 'tcpOut',
  version: 'version',
  workload: 'workload'
};

export const ZoomOptions = {
  fitPadding: 25,
  maxZoom: 2.5
};

export const safeFit = (cy: Cy.Core, centerElements?: Cy.Collection) => {
  cy.fit(centerElements, ZoomOptions.fitPadding);
  if (cy.zoom() > ZoomOptions.maxZoom) {
    cy.zoom(ZoomOptions.maxZoom);
    !!centerElements && !!centerElements.length ? cy.center(centerElements) : cy.center();
  }
  // 'fit' is a custom event that we emit allowing us to reset cytoscapeGraph.customViewport
  cy.emit('fit');
};

export const runLayout = (cy: Cy.Core, layout: Layout) => {
  // Using an extension
  (cy as any).nodeHtmlLabel().updateNodeLabel(cy.nodes());

  const layoutOptions = LayoutDictionary.getLayout(layout);
  if (cy.nodes('$node > node').length > 0) {
    // if there is any parent (i.e. box) node, run the box-layout
    cy.layout({
      ...layoutOptions,
      name: 'box-layout',
      appBoxLayout: 'dagre',
      defaultLayout: layout.name
    }).run();
  } else {
    cy.layout(layoutOptions).run();
  }
};

export const decoratedEdgeData = (ele: Cy.EdgeSingular): DecoratedGraphEdgeData => {
  return ele.data();
};

export const decoratedNodeData = (ele: Cy.NodeSingular): DecoratedGraphNodeData => {
  return ele.data();
};

export const isCore = (target: Cy.NodeSingular | Cy.EdgeSingular | Cy.Core): target is Cy.Core => {
  return !('cy' in target);
};

export const isNode = (target: Cy.NodeSingular | Cy.EdgeSingular | Cy.Core): target is Cy.NodeSingular => {
  return !isCore(target) && target.isNode();
};

export const isEdge = (target: Cy.NodeSingular | Cy.EdgeSingular | Cy.Core): target is Cy.EdgeSingular => {
  return !isCore(target) && target.isEdge();
};
