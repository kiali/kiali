import { Controller, Edge, Node } from '@patternfly/react-topology';
import { JaegerTrace, Span } from 'types/TracingInfo';
import { NodeType, GraphType, SEInfo, NodeAttr } from 'types/Graph';
import {
  getAppFromSpan,
  getSourceWorkloadFromWaypointSpan,
  getWorkloadFromSpan,
  isWaypointProxySpan,
  searchParentApp,
  searchParentWorkload
} from 'utils/tracing/TracingHelper';
import { edgesOut, elems, nodesIn, nodesOut, select, SelectAnd, selectAnd, setObserved } from 'helpers/GraphHelpers';

/**
 * Extracts service name and namespace from span operationName or serviceName.
 * Handles different formats:
 * - "service.namespace.svc.cluster.local:port/path" (waypoint/gateway)
 * - "router outbound|port||service.namespace.svc.cluster.local; egress" (envoy client)
 * - "service.namespace" (standard)
 * @returns [serviceName, namespace]
 */
const extractServiceAndNsFromSpan = (span: Span): [string, string] => {
  const op = span.operationName;

  // Handle envoy router format: "router outbound|9080||productpage.bookinfo.svc.cluster.local; egress"
  if (op.includes('outbound|') && op.includes('||')) {
    const parts = op.split('||');
    if (parts.length >= 2) {
      // Extract "productpage.bookinfo.svc.cluster.local" part
      const serviceFqdn = parts[1].split(';')[0].trim();
      const fqdnParts = serviceFqdn.split('.');
      if (fqdnParts.length >= 2) {
        return [fqdnParts[0], fqdnParts[1]];
      }
    }
  }

  // Handle standard service FQDN format: "service.namespace.svc.cluster.local:port/path"
  if (op.includes('.svc.cluster.local') || (op.includes('.') && op.includes(':'))) {
    const parts = op.split('.');
    if (parts.length >= 2) {
      return [parts[0], parts[1]];
    }
  }

  // Fallback to process.serviceName
  const parts = span.process.serviceName.split('.');
  return [parts[0], parts.length > 1 ? parts[1] : ''];
};

const resolveDestinationWorkload = (
  nodes: Node[],
  span: Span,
  app: string,
  namespace: string,
  lastSelection: Node[] | undefined
): Node[] => {
  const spanKind = String(span.tags.find(tag => tag.key === 'span.kind')?.value || '');
  const canUseDirectWorkload = spanKind === 'server' || spanKind === 'consumer' || isWaypointProxySpan(span);

  // Direct workload extraction is reliable for server/consumer spans (or waypoint spans).
  // For envoy client/producer spans, node_id usually points to source proxy/workload.
  if (canUseDirectWorkload) {
    const destWlNs = getWorkloadFromSpan(span);
    if (destWlNs?.workload) {
      const selector: SelectAnd = [
        { prop: NodeAttr.workload, val: destWlNs.workload },
        { prop: NodeAttr.namespace, val: destWlNs.namespace }
      ];
      const selected = selectAnd(nodes, selector) as Node[];
      const selectedByApp = selected.filter(n => {
        const data = n.getData();
        return data[NodeAttr.app] === app && (namespace === '' || data[NodeAttr.namespace] === namespace);
      });
      if (selectedByApp.length > 0) {
        return selectedByApp;
      }
    }
  }

  // Gateway/waypoint spans may not include destination workload tags.
  // In that case infer the destination workload from the selected service outgoing edges.
  if (lastSelection && lastSelection.length > 0) {
    const adjacentCandidates = [...nodesOut(lastSelection), ...nodesIn(lastSelection)];
    const adjacentWorkloads = adjacentCandidates.filter(n => {
      const data = n.getData();
      return (
        !!data[NodeAttr.workload] &&
        data[NodeAttr.app] === app &&
        (namespace === '' || data[NodeAttr.namespace] === namespace)
      );
    });
    // Avoid false positives on sidecar/non-ambient traces where a service fan-outs to multiple versions.
    // In that case the client span does not tell us the exact destination workload.
    if (adjacentWorkloads.length === 1) {
      return adjacentWorkloads;
    }
  }

  const fallbackSelector: SelectAnd = [
    { prop: NodeAttr.workload, op: 'truthy' },
    { prop: NodeAttr.app, val: app }
  ];
  if (namespace) {
    fallbackSelector.push({ prop: NodeAttr.namespace, val: namespace });
  }
  const fallback = selectAnd(nodes, fallbackSelector) as Node[];
  return fallback.length === 1 ? fallback : [];
};

export const showTrace = (controller: Controller, graphType: GraphType, trace: JaegerTrace): void => {
  if (!controller.hasGraph()) {
    return;
  }

  hideTrace(controller);
  trace.spans.forEach(span => showSpanSubtrace(controller, graphType, span));
};

const showSpanSubtrace = (controller: Controller, graphType: GraphType, span: Span): void => {
  // For proxy spans (waypoint, gateway, router), the operationName contains the destination service.
  const operationHasServiceInfo =
    span.operationName.includes('.svc.cluster.local') ||
    span.operationName.includes('outbound|') ||
    isWaypointProxySpan(span);

  let app: string;
  let namespace: string;

  if (operationHasServiceInfo) {
    // Extract service and namespace from operationName for proxies (waypoint, gateway, router)
    [app, namespace] = extractServiceAndNsFromSpan(span);
  } else {
    const split = span.process.serviceName.split('.');
    app = split[0];
    namespace = split.length > 1 ? split[1] : '';
  }
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
        // Try workload: for waypoint spans, source is in own tags; for others, search parent
        const sourceWlNs = isWaypointProxySpan(span)
          ? getSourceWorkloadFromWaypointSpan(span)
          : searchParentWorkload(span);
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
    // Parent workload: for waypoint spans, source is in own tags; for others, search parent
    let sourceWlNs = isWaypointProxySpan(span) ? getSourceWorkloadFromWaypointSpan(span) : searchParentWorkload(span);
    if (!sourceWlNs) {
      const spanKind = String(span.tags.find(tag => tag.key === 'span.kind')?.value || '');
      if (spanKind === 'client' || spanKind === 'producer') {
        // Root client spans (like ingress gateway -> service) have no parent span.
        // In that case, node_id/process data points to the source workload itself.
        sourceWlNs = getWorkloadFromSpan(span);
      }
    }
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
  if (namespace) {
    selector.push({ prop: NodeAttr.namespace, val: namespace });
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
    // Main workload (graph nodes store deployment name on `workload`, not `app`)
    const workloadSelection = resolveDestinationWorkload(nodes, span, app, namespace, lastSelection);
    if (workloadSelection.length > 0) {
      lastSelection = nextHop(span, workloadSelection, lastSelection);
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

const edgeProtocol = (edge: Edge): string | undefined => {
  const protocol = edge.getData()?.traffic?.protocol;
  return typeof protocol === 'string' ? protocol.toLowerCase() : undefined;
};

const spanProtocol = (span: Span): string | undefined => {
  if (span.tags.some(tag => tag.key.startsWith('http.'))) {
    return 'http';
  }
  if (span.tags.some(tag => tag.key.startsWith('peer.'))) {
    return 'tcp';
  }
  return undefined;
};

const pickEdgeForSpan = (edges: Edge[], span: Span): Edge | undefined => {
  if (edges.length === 0) {
    return undefined;
  }
  const protocol = spanProtocol(span);
  if (protocol) {
    const matching = edges.filter(e => edgeProtocol(e) === protocol);
    if (matching.length > 0) {
      return singleEdge(matching);
    }
  }
  return singleEdge(edges);
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
      addSpan(pickEdgeForSpan(edge, span), span);
    }
    return next;
  }
  if (last) {
    addSpan(singleNode(last), span);
  }
  return last;
};
