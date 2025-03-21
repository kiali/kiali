import { Controller, Edge, Node } from '@patternfly/react-topology';
import { JaegerTrace, Span } from 'types/TracingInfo';
import { NodeType, GraphType, SEInfo, NodeAttr } from 'types/Graph';
import {
  getAppFromSpan,
  getWorkloadFromSpan,
  searchParentApp,
  searchParentWorkload
} from 'utils/tracing/TracingHelper';
import { edgesOut, elems, select, SelectAnd, selectAnd, setObserved } from 'helpers/GraphHelpers';

export const showTrace = (
  controller: Controller,
  graphType: GraphType,
  isAmbient: boolean,
  trace: JaegerTrace
): void => {
  if (!controller.hasGraph()) {
    return;
  }

  hideTrace(controller);
  trace.spans.forEach(span => showSpanSubtrace(controller, graphType, isAmbient, span));
};

const showSpanSubtrace = (controller: Controller, graphType: GraphType, isAmbient: boolean, span: Span): void => {
  let split: string[];
  if (isAmbient) {
    // For Ambient, the service Name will always be the waypoint or the gateway
    split = span.operationName.split('.');
  } else {
    split = span.process.serviceName.split('.');
  }
  const app = split[0];
  // From upstream to downstream: Parent app or workload, Inbound Service Entry, Service, App or Workload, Outbound Service Entry
  let lastSelection: Node[] | undefined = undefined;

  const { nodes } = elems(controller);
  if (graphType === GraphType.SERVICE) {
    // In service graph type, parent can be a Service or a Workload (e.g. when it initiates the transaction)
    const sourceAppNs = searchParentApp(span);
    if (sourceAppNs) {
      let parent = selectAnd(nodes, [
        { prop: NodeAttr.isBox, op: 'falsy' },
        { prop: NodeAttr.nodeType, val: NodeType.SERVICE },
        { prop: NodeAttr.app, val: sourceAppNs.app },
        { prop: NodeAttr.namespace, val: sourceAppNs.namespace }
      ]);
      if (parent.length === 0) {
        // Try workload
        const sourceWlNs = searchParentWorkload(span);
        if (sourceWlNs) {
          parent = selectAnd(nodes, [
            { prop: NodeAttr.workload, val: sourceWlNs.workload },
            { prop: NodeAttr.namespace, val: sourceWlNs.namespace }
          ]);
        }
      }
      if (parent.length !== 0) {
        lastSelection = parent as Node[];
      }
    }
  } else if (graphType === GraphType.APP) {
    // Parent app
    const sourceAppNs = searchParentApp(span);
    if (sourceAppNs) {
      const parent = selectAnd(nodes, [
        { prop: NodeAttr.nodeType, val: NodeType.APP },
        { prop: NodeAttr.app, val: sourceAppNs.app },
        { prop: NodeAttr.namespace, val: sourceAppNs.namespace }
      ]);
      if (parent.length !== 0) {
        lastSelection = parent as Node[];
      }
    }
  } else {
    // Parent workload
    const sourceWlNs = searchParentWorkload(span);
    if (sourceWlNs) {
      const parent = selectAnd(nodes, [
        { prop: NodeAttr.workload, val: sourceWlNs.workload },
        { prop: NodeAttr.namespace, val: sourceWlNs.namespace }
      ]);
      if (parent.length !== 0) {
        lastSelection = parent as Node[];
      }
    }
  }

  // Inbound service entry
  const seSelectionInbound = getInboundServiceEntry(span, nodes);
  lastSelection = nextHop(span, seSelectionInbound, lastSelection);

  // Main service
  const selector: SelectAnd = [
    { prop: NodeAttr.nodeType, val: NodeType.SERVICE },
    { prop: NodeAttr.app, val: app }
  ];
  if (split.length > 1) {
    selector.push({ prop: NodeAttr.namespace, val: split[1] });
  }
  lastSelection = nextHop(span, selectAnd(nodes, selector) as Node[], lastSelection);

  if (graphType === GraphType.APP) {
    // Main app
    const destAppNs = getAppFromSpan(span);
    if (destAppNs) {
      const selector: SelectAnd = [
        { prop: NodeAttr.nodeType, val: NodeType.APP },
        { prop: NodeAttr.app, val: destAppNs.app },
        { prop: NodeAttr.namespace, val: destAppNs.namespace }
      ];
      lastSelection = nextHop(span, selectAnd(nodes, selector) as Node[], lastSelection);
    }
  } else {
    // Main workload
    const destWlNs = getWorkloadFromSpan(span);
    if (destWlNs) {
      const selector: SelectAnd = [
        { prop: NodeAttr.app, val: destWlNs.workload },
        { prop: NodeAttr.namespace, val: destWlNs.namespace }
      ];
      lastSelection = nextHop(span, selectAnd(nodes, selector) as Node[], lastSelection);
    }
  }

  // Outbound service entry
  const seSelection = getOutboundServiceEntry(span, nodes);
  nextHop(span, seSelection, lastSelection);
};

const singleEdge = (edges: Edge[]): Edge | undefined => {
  if (edges.length > 1) {
    console.debug(`Expected singleton, found [${edges.length}] edges. Using first.`);
  }
  return edges.length > 0 ? edges[0] : undefined;
};

const singleNode = (nodes: Node[]): Node | undefined => {
  if (nodes.length > 1) {
    console.debug(`Expected singleton, found [${nodes.length}] nodes. Using first.`);
  }
  return nodes.length > 0 ? nodes[0] : undefined;
};

const addSpan = (ele: Node | Edge | undefined, span: Span): void => {
  if (!ele) {
    return;
  }
  const data = ele.getData();
  let hasSpans = data['hasSpans'];
  if (!!hasSpans) {
    hasSpans.push(span);
  } else {
    hasSpans = [span];
  }
  // must reset Data to get the element to re-render
  setObserved(() => ele.setData({ ...data, hasSpans: hasSpans }));
};

export const hideTrace = (controller: Controller): void => {
  if (!controller.hasGraph()) {
    return;
  }
  // unhighlight old span-hits
  setObserved(() => {
    const { nodes, edges } = elems(controller);
    select(edges, { prop: 'hasSpans', op: 'truthy' }).forEach(e => e.setData({ ...e.getData(), hasSpans: undefined }));
    select(nodes, { prop: 'hasSpans', op: 'truthy' }).forEach(e => e.setData({ ...e.getData(), hasSpans: undefined }));
  });
};

const getOutboundServiceEntry = (span: Span, nodes: Node[]): Node[] | undefined => {
  // see https://github.com/opentracing/specification/blob/master/semantic_conventions.md
  if (span.tags.some(tag => tag.key === 'span.kind' && (tag.value === 'client' || tag.value === 'producer'))) {
    return findServiceEntry(span, nodes);
  }
  return undefined;
};

const getInboundServiceEntry = (span: Span, nodes: Node[]): Node[] | undefined => {
  // see https://github.com/opentracing/specification/blob/master/semantic_conventions.md
  if (span.tags.some(tag => tag.key === 'span.kind' && (tag.value === 'server' || tag.value === 'consumer'))) {
    return findServiceEntry(span, nodes);
  }
  return undefined;
};

const findServiceEntry = (span: Span, nodes: Node[]): Node[] | undefined => {
  const hostname = span.tags.find(tag => tag.key === 'peer.hostname');
  if (hostname && hostname.value !== '') {
    return findSEHost(hostname.value, nodes);
  }
  const addr = span.tags.find(tag => tag.key === 'peer.address');
  if (addr && addr.value !== '') {
    return findSEHost(addr.value.split(':')[0], nodes);
  }
  return undefined;
};

const findSEHost = (hostname: string, nodes: Node[]): Node[] | undefined => {
  const serviceNodes = select(nodes, { prop: NodeAttr.nodeType, val: NodeType.SERVICE }) as Node[];
  return serviceNodes.filter(node => {
    const seInfo: SEInfo | undefined = node.getData()[NodeAttr.isServiceEntry];
    if (seInfo) {
      // TODO: improve host matching, as "startsWith" allows false-positives
      if (seInfo.hosts.some(h => h.startsWith(hostname))) {
        return true;
      }
    }
    return false;
  });
};

const nextHop = (span: Span, next: Node[] | undefined, last: Node[] | undefined): Node[] | undefined => {
  if (!!next && next.length !== 0) {
    const node = singleNode(next);
    addSpan(node, span);
    if (last) {
      // Try both inbound and outbound, because of TCP edges where direction might not be correctly represented in graph
      let edge = edgesOut(last, next);
      if (!edge || edge.length === 0) {
        edge = edgesOut(next, last);
      }
      addSpan(singleEdge(edge), span);
    }
    return next;
  }
  if (last) {
    addSpan(singleNode(last), span);
  }
  return last;
};
