import { Controller, Edge, Node } from '@patternfly/react-topology';
import { JaegerTrace, Span } from 'types/JaegerInfo';
import { NodeType, GraphType, SEInfo } from 'types/Graph';
import {
  getAppFromSpan,
  getWorkloadFromSpan,
  searchParentApp,
  searchParentWorkload
} from 'utils/tracing/TracingHelper';
import { edgesOut, elems, select, SelectAnd, selectAnd } from './GraphPFElems';
import { CyNode } from 'components/CytoscapeGraph/CytoscapeGraphUtils';

export const showTrace = (controller: Controller, graphType: GraphType, trace: JaegerTrace) => {
  if (!controller.hasGraph()) {
    return;
  }

  hideTrace(controller);
  trace.spans.forEach(span => showSpanSubtrace(controller, graphType, span));
};

const showSpanSubtrace = (controller: Controller, graphType: GraphType, span: Span) => {
  const split = span.process.serviceName.split('.');
  const app = split[0];
  // From upstream to downstream: Parent app or workload, Inbound Service Entry, Service, App or Workload, Outbound Service Entry
  let lastSelection: Node[] | undefined = undefined;

  const { nodes } = elems(controller);
  if (graphType === GraphType.SERVICE) {
    // In service graph type, parent can be a Service or a Workload (e.g. when it initiates the transaction)
    const sourceAppNs = searchParentApp(span);
    if (sourceAppNs) {
      let parent = selectAnd(nodes, [
        { prop: CyNode.isBox, op: 'falsy' },
        { prop: CyNode.nodeType, val: NodeType.SERVICE },
        { prop: CyNode.app, val: sourceAppNs.app },
        { prop: CyNode.namespace, val: sourceAppNs.namespace }
      ]);
      if (parent.length === 0) {
        // Try workload
        const sourceWlNs = searchParentWorkload(span);
        if (sourceWlNs) {
          parent = selectAnd(nodes, [
            { prop: CyNode.workload, val: sourceWlNs.workload },
            { prop: CyNode.namespace, val: sourceWlNs.namespace }
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
        { prop: CyNode.nodeType, val: NodeType.APP },
        { prop: CyNode.app, val: sourceAppNs.app },
        { prop: CyNode.namespace, val: sourceAppNs.namespace }
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
        { prop: CyNode.workload, val: sourceWlNs.workload },
        { prop: CyNode.namespace, val: sourceWlNs.namespace }
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
    { prop: CyNode.nodeType, val: NodeType.SERVICE },
    { prop: CyNode.app, val: app }
  ];
  if (split.length > 1) {
    selector.push({ prop: CyNode.namespace, val: split[1] });
  }
  lastSelection = nextHop(span, selectAnd(nodes, selector) as Node[], lastSelection);

  if (graphType === GraphType.APP) {
    // Main app
    const destAppNs = getAppFromSpan(span);
    if (destAppNs) {
      const selector: SelectAnd = [
        { prop: CyNode.nodeType, val: NodeType.APP },
        { prop: CyNode.app, val: destAppNs.app },
        { prop: CyNode.namespace, val: destAppNs.namespace }
      ];
      lastSelection = nextHop(span, selectAnd(nodes, selector) as Node[], lastSelection);
    }
  } else {
    // Main workload
    const destWlNs = getWorkloadFromSpan(span);
    if (destWlNs) {
      const selector: SelectAnd = [
        { prop: CyNode.app, val: destWlNs.workload },
        { prop: CyNode.namespace, val: destWlNs.namespace }
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
  ele.setData({ ...data, hasSpans: hasSpans });
};

export const hideTrace = (controller: Controller) => {
  if (!controller.hasGraph()) {
    return;
  }
  // unhighlight old span-hits
  const { nodes, edges } = elems(controller);
  select(edges, { prop: 'hasSpans', op: 'truthy' }).forEach(e => e.setData({ ...e.getData(), hasSpans: undefined }));
  select(nodes, { prop: 'hasSpans', op: 'truthy' }).forEach(e => e.setData({ ...e.getData(), hasSpans: undefined }));
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
  const serviceNodes = select(nodes, { prop: CyNode.nodeType, val: NodeType.SERVICE }) as Node[];
  return serviceNodes.filter(node => {
    const seInfo: SEInfo | undefined = node.getData()[CyNode.isServiceEntry];
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
  return last;
};
