import * as Cy from 'cytoscape';
import { CyNode } from './CytoscapeGraphUtils';
import { JaegerTrace, Span } from 'types/JaegerInfo';
import {
  getWorkloadFromSpan,
  searchParentWorkload,
  searchParentApp,
  getAppFromSpan
} from 'components/JaegerIntegration/JaegerHelper';
import { NodeType, DestService, GraphType } from 'types/Graph';

export const showTrace = (cy: Cy.Core, graphType: GraphType, trace: JaegerTrace) => {
  if (!cy) {
    return;
  }

  cy.startBatch();
  hideTrace(cy);
  trace.spans.forEach(span => showSpanSubtrace(cy, graphType, span));
  cy.endBatch();
};

const showSpanSubtrace = (cy: Cy.Core, graphType: GraphType, span: Span) => {
  const split = span.process.serviceName.split('.');
  const app = split[0];

  // From upstream to downstream: Parent app or workload, Inbound Service Entry, Service, App or Workload, Outbound Service Entry
  let lastSelection: Cy.NodeCollection | undefined = undefined;

  if (graphType === GraphType.APP) {
    // Parent app
    const sourceAppNs = searchParentApp(span);
    if (sourceAppNs) {
      const selector = `node[!${CyNode.isGroup}][${CyNode.nodeType}="${NodeType.APP}"][${CyNode.app}="${sourceAppNs.app}"][${CyNode.namespace}="${sourceAppNs.namespace}"]`;
      lastSelection = nextHop(span, cy.elements(selector), lastSelection);
    }
  } else {
    // Parent workload
    const sourceWlNs = searchParentWorkload(span);
    if (sourceWlNs) {
      const selector = `node[${CyNode.workload}="${sourceWlNs.workload}"][${CyNode.namespace}="${sourceWlNs.namespace}"]`;
      lastSelection = nextHop(span, cy.elements(selector), lastSelection);
    }
  }

  // Inbound service entry (experimental)
  const seSelectionIncoming = getServiceEntrySelection(span, cy, 'from_addr');
  lastSelection = nextHop(span, seSelectionIncoming, lastSelection);

  // Main service
  const nsSelector = split.length > 1 ? `[${CyNode.namespace}="${split[1]}"]` : '';
  const selector = `[${CyNode.nodeType}="${NodeType.SERVICE}"][${CyNode.app}="${app}"]${nsSelector}`;
  lastSelection = nextHop(span, cy.elements(selector), lastSelection);

  if (graphType === GraphType.APP) {
    // Main app
    const destAppNs = getAppFromSpan(span);
    if (destAppNs) {
      const selector = `node[!${CyNode.isGroup}][${CyNode.nodeType}="${NodeType.APP}"][${CyNode.app}="${destAppNs.app}"][${CyNode.namespace}="${destAppNs.namespace}"]`;
      console.log(cy.elements(selector));
      lastSelection = nextHop(span, cy.elements(selector), lastSelection);
    }
  } else {
    // Main workload
    const destWlNs = getWorkloadFromSpan(span);
    if (destWlNs) {
      const selector = `node[${CyNode.workload}="${destWlNs.workload}"][${CyNode.namespace}="${destWlNs.namespace}"]`;
      lastSelection = nextHop(span, cy.elements(selector), lastSelection);
    }
  }

  // Outbound service entry (experimental)
  const seSelection = getServiceEntrySelection(span, cy, 'to_addr');
  nextHop(span, seSelection, lastSelection);
};

const singleEdge = (edges: Cy.EdgeCollection): Cy.EdgeSingular | undefined => {
  if (edges.length > 1) {
    console.debug(`Expected singleton, found [${edges.length}] edges. Using first.`);
  }
  return edges.length > 0 ? edges[0] : undefined;
};

const singleNode = (nodes: Cy.NodeCollection): Cy.NodeSingular | undefined => {
  if (nodes.length > 1) {
    console.debug(`Expected singleton, found [${nodes.length}] nodes. Using first.`);
  }
  return nodes.length > 0 ? nodes[0] : undefined;
};

const addSpan = (ele: Cy.NodeSingular | Cy.EdgeSingular | undefined, span: Span): void => {
  if (!ele) {
    return;
  }

  if (ele.hasClass('span')) {
    ele.data('spans').push(span);
  } else {
    ele.addClass('span');
    ele.data('spans', [span]);
  }
};

export const hideTrace = (cy: Cy.Core) => {
  if (!cy) {
    return;
  }
  // unhighlight old span-hits
  const spanHits = cy.elements('*.span');
  spanHits.removeClass('span');
  spanHits.data('spans', undefined);
};

const getServiceEntrySelection = (span: Span, cy: Cy.Core, key: string): Cy.NodeCollection | undefined => {
  const addr = span.tags.find(tag => tag.key === key);
  if (addr) {
    const addrHost = addr.value.split(':')[0];
    return cy.elements(`[${CyNode.nodeType}="${NodeType.SERVICE}"]`).filter(ele => {
      const destServices: DestService[] | undefined = ele.data(CyNode.destServices);
      if (destServices) {
        // TODO: improve host matching, as "startsWith" allows false-positives
        if (destServices.some(s => s.name.startsWith(addrHost))) {
          return true;
        }
      }
      return false;
    });
  }
  return undefined;
};

const nextHop = (
  span: Span,
  next: Cy.NodeCollection | undefined,
  last: Cy.NodeCollection | undefined
): Cy.NodeCollection | undefined => {
  if (!!next && next.length !== 0) {
    const node = singleNode(next);
    addSpan(node, span);
    if (last) {
      // Try both inbound and outbound, because of TCP edges where direction might not be correctly represented in graph
      let edge = last.edgesTo(next);
      if (!edge || edge.length === 0) {
        edge = next.edgesTo(last);
      }
      addSpan(singleEdge(edge), span);
    }
    return next;
  }
  return last;
};
