import * as LayoutDictionary from './graphs/LayoutDictionary';
import {
  CytoscapeGlobalScratchNamespace,
  DecoratedGraphEdgeData,
  DecoratedGraphNodeData,
  Layout
} from '../../types/Graph';
import { DagreGraph } from './graphs/DagreGraph';
import * as Cy from 'cytoscape';

export const CyEdge = {
  grpc: 'grpc',
  grpcErr: 'grpcErr',
  grpcPercentErr: 'grpcPercentErr',
  grpcPercentReq: 'grpcPercentReq',
  hasTraffic: 'hasTraffic',
  http: 'http',
  http3xx: 'http3xx',
  http4xx: 'http4xx',
  http5xx: 'http5xx',
  httpPercentErr: 'httpPercentErr',
  httpPercentReq: 'httpPercentReq',
  id: 'id',
  isMTLS: 'isMTLS',
  protocol: 'protocol',
  responses: 'responses',
  responseTime: 'responseTime',
  tcp: 'tcp'
};

export const CyEdgeResponses = {
  flags: 'flags',
  hosts: 'hosts'
};

export const CyNode = {
  app: 'app',
  destServices: 'destServices',
  grpcIn: 'grpcIn',
  grpcInErr: 'grpcInErr',
  grpcOut: 'grpcOut',
  hasCB: 'hasCB',
  hasMissingSC: 'hasMissingSC',
  hasVS: 'hasVS',
  httpIn: 'httpIn',
  httpIn3xx: 'httpIn3xx',
  httpIn4xx: 'httpIn4xx',
  httpIn5xx: 'httpIn5xx',
  httpOut: 'httpOut',
  id: 'id',
  isDead: 'isDead',
  isGroup: 'isGroup',
  isInaccessible: 'isInaccessible',
  isIstio: 'isIstio',
  isMisconfigured: 'isMisconfigured',
  isOutside: 'isOutside',
  isRoot: 'isRoot',
  isServiceEntry: 'isServiceEntry',
  isUnused: 'isUnused',
  namespace: 'namespace',
  nodeType: 'nodeType',
  service: 'service',
  tcpIn: 'tcpIn',
  tcpOut: 'tcpOut',
  version: 'version',
  workload: 'workload'
};

export const ZoomOptions = {
  fitPadding: 25
};

export const safeFit = (cy: Cy.Core, centerElements?: Cy.Collection) => {
  cy.fit(centerElements, ZoomOptions.fitPadding);
  if (cy.zoom() > 2.5) {
    cy.zoom(2.5);
    cy.center(centerElements);
  }
};

export const runLayout = (cy: Cy.Core, layout: Layout) => {
  // Enable labels when doing a relayout, layouts can be told to take into account the labels to avoid
  // overlap, but we need to have them enabled (nodeDimensionsIncludeLabels: true)
  const showNodeLabels = cy.scratch(CytoscapeGlobalScratchNamespace).showNodeLabels;
  cy.scratch(CytoscapeGlobalScratchNamespace).showNodeLabels = true;

  // Using an extension
  (cy as any).nodeHtmlLabel().updateNodeLabel(cy.nodes());

  const layoutOptions = LayoutDictionary.getLayout(layout);
  if (cy.nodes('$node > node').length > 0) {
    // if there is any parent node, run the group-compound-layout
    cy.layout({
      ...layoutOptions,
      name: 'group-compound-layout',
      realLayout: layout.name,
      // Currently we do not support non discrete layouts for the compounds, but this can be supported if needed.
      compoundLayoutOptions: LayoutDictionary.getLayout(DagreGraph.getLayout())
    }).run();
  } else {
    cy.layout(layoutOptions).run();
  }
  cy.scratch(CytoscapeGlobalScratchNamespace).showNodeLabels = showNodeLabels;
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
