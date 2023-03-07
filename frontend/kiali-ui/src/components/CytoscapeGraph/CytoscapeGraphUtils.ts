import * as LayoutDictionary from './graphs/LayoutDictionary';
import {
  CytoscapeGlobalScratchData,
  CytoscapeGlobalScratchNamespace,
  DecoratedGraphEdgeData,
  DecoratedGraphEdgeWrapper,
  DecoratedGraphElements,
  DecoratedGraphNodeData,
  DecoratedGraphNodeWrapper,
  Layout
} from '../../types/Graph';
import * as Cy from 'cytoscape';
import { GraphStyles } from './graphs/GraphStyles';

export const CyEdge = {
  destPrincipal: 'destPrincipal',
  grpc: 'grpc',
  grpcErr: 'grpcErr',
  grpcNoResponse: 'grpcNoResponse',
  grpcPercentErr: 'grpcPercentErr',
  grpcPercentReq: 'grpcPercentReq',
  hasTraffic: 'hasTraffic',
  healthStatus: 'healthStatus',
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
  tcp: 'tcp',
  throughput: 'throughput'
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
  hasFaultInjection: 'hasFaultInjection',
  hasMirroring: 'hasMirroring',
  hasMissingSC: 'hasMissingSC',
  hasRequestRouting: 'hasRequestRouting',
  hasRequestTimeout: 'hasRequestTimeout',
  hasTCPTrafficShifting: 'hasTCPTrafficShifting',
  hasTrafficShifting: 'hasTrafficShifting',
  hasVS: 'hasVS',
  hasWorkloadEntry: 'hasWorkloadEntry',
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
  rank: 'rank',
  service: 'service',
  tcpIn: 'tcpIn',
  tcpOut: 'tcpOut',
  version: 'version',
  workload: 'workload'
};

export const ZoomOptions = {
  fitPadding: 40,
  maxZoom: 2.5
};

export const safeFit = (cy: Cy.Core, centerElements?: Cy.Collection) => {
  cy.fit(centerElements, ZoomOptions.fitPadding);
  if (cy.zoom() > ZoomOptions.maxZoom) {
    cy.zoom(ZoomOptions.maxZoom);
    !!centerElements && !!centerElements.length ? cy.center(centerElements) : cy.center();
  }
  // 'kiali-fit' is a custom event that we emit allowing us to reset cytoscapeGraph.customViewport
  cy.emit('kiali-fit');
};

// IMPORTANT! Layouts should be performed while zoom-handling is being ignored:
//   - call cy.emit('kiali-zoomignore', [true]) at some point prior to this call
//   - call cy.emit('kiali-zoomignore', [false]) in the promise handler
export const runLayout = (cy: Cy.Core, layout: Layout, namespaceLayout: Layout): Promise<any> => {
  // generate all labels so the layout algorithm can take them into consideration
  refreshLabels(cy, true);

  const layoutOptions = LayoutDictionary.getLayout(layout);
  let promise: Promise<any>;
  let cyLayout: Cy.Layouts;
  if (cy.nodes('$node > node').length > 0) {
    // if there is any parent (i.e. box) node, run the box-layout
    cyLayout = cy.layout({
      ...layoutOptions,
      name: 'box-layout',
      appBoxLayout: namespaceLayout.name, // app and namespace will share same layout
      namespaceBoxLayout: namespaceLayout.name,
      defaultLayout: layout.name
    });
  } else {
    cyLayout = cy.layout(layoutOptions);
  }
  promise = cyLayout.promiseOn('layoutstop');
  cyLayout.run();
  return promise;
};

// This should be called to ensure labels are up to date on-screen.  It may be needed to ensure cytoscape
// displays up-to-date labels, even if the label content has not changed.
// Note: the leaf-to-root approach here should mirror what is done in GraphStyles.ts#htmlNodeLabels()
export const refreshLabels = (cy: Cy.Core, force: boolean) => {
  const scratch = cy.scratch(CytoscapeGlobalScratchNamespace);
  if (force) {
    if (scratch) {
      cy.scratch(CytoscapeGlobalScratchNamespace, { ...scratch, forceLabels: true } as CytoscapeGlobalScratchData);
    }
  }

  // update labels from leaf to node (i.e. inside out with respect to nested boxing).  This (in theory) ensures
  // that outer nodes will always be able to incorporate inner nodes' true bounding-box (one adjusted for the label).
  let nodes = cy.nodes('[^isBox]:visible');
  while (nodes.length > 0) {
    (cy as any).nodeHtmlLabel().updateNodeLabel(nodes);
    nodes = nodes.parents();
  }

  cy.edges().each(e => {
    e.data('label', GraphStyles.getEdgeLabel(e, e.selected()));
  });

  if (force) {
    if (scratch) {
      cy.scratch(CytoscapeGlobalScratchNamespace, { ...scratch, forceLabels: false } as CytoscapeGlobalScratchData);
    }
  }
};

// It is common that when updating the graph that the element topology (nodes, edges) remain the same,
// only their activity changes (rates, etc). When the topology remains the same we may be able to optimize
// some behavior.  This returns true if the topology changes, false otherwise.
// 1) Quickly compare the number of nodes and edges, if different return true.
// 2) Compare the ids
export const elementsChanged = (
  prevElements: DecoratedGraphElements,
  nextElements: DecoratedGraphElements
): boolean => {
  if (prevElements === nextElements) {
    return false;
  }

  if (
    !prevElements ||
    !nextElements ||
    !prevElements.nodes ||
    !prevElements.edges ||
    !nextElements.nodes ||
    !nextElements.edges ||
    prevElements.nodes.length !== nextElements.nodes.length ||
    prevElements.edges.length !== nextElements.edges.length
  ) {
    return true;
  }

  return !(
    nodeOrEdgeArrayHasSameIds(nextElements.nodes, prevElements.nodes) &&
    nodeOrEdgeArrayHasSameIds(nextElements.edges, prevElements.edges)
  );
};

const nodeOrEdgeArrayHasSameIds = <T extends DecoratedGraphNodeWrapper | DecoratedGraphEdgeWrapper>(
  a: Array<T>,
  b: Array<T>
): boolean => {
  const aIds = a.map(e => e.data.id).sort();
  return b
    .map(e => e.data.id)
    .sort()
    .every((eId, index) => eId === aIds[index]);
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

export const toSafeCyFieldName = (fieldName: string): string => {
  const alnumString = /^[a-zA-Z0-9]*$/;
  const unsafeChar = /[^a-zA-Z0-9]/g;

  if (fieldName.match(alnumString)) {
    return fieldName;
  }

  return fieldName.replace(unsafeChar, '_');
};
