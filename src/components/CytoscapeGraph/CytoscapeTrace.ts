import * as Cy from 'cytoscape';
import { CyNode } from './CytoscapeGraphUtils';
import { JaegerTrace, Span } from 'types/JaegerInfo';
import {
  getWorkloadFromSpan,
  searchParentWorkload as getParentWorkloadFromSpan
} from 'components/JaegerIntegration/JaegerHelper';
import { NodeType } from 'types/Graph';

export const showTrace = (cy: Cy.Core, trace: JaegerTrace) => {
  if (!cy) {
    return;
  }

  cy.startBatch();
  hideTrace(cy);

  trace.spans.forEach(span => {
    const split = span.process.serviceName.split('.');
    const service = split[0];
    // TODO: add ns when missing
    let selector = `[${CyNode.nodeType}="${NodeType.SERVICE}"][${CyNode.service}="${service}"]`;
    selector = split.length > 1 ? `${selector}[${CyNode.namespace}="${split[1]}"]` : selector;
    const serviceSelection = cy.elements(selector);
    if (!!serviceSelection) {
      const serviceNode = singleNode(serviceSelection);
      addSpan(serviceNode, span);
    }

    const sourceWlNs = getParentWorkloadFromSpan(span);
    let sourceWlSelection: any;
    if (sourceWlNs) {
      const selector = `node[${CyNode.workload}="${sourceWlNs.workload}"][${CyNode.namespace}="${sourceWlNs.namespace}"]`;
      sourceWlSelection = !!serviceSelection ? serviceSelection.incomers(selector) : cy.elements(selector);
      if (!!sourceWlSelection) {
        addSpan(singleNode(sourceWlSelection), span);
        if (!!serviceSelection) {
          addSpan(singleEdge(sourceWlSelection.edgesTo(serviceSelection)), span);
        }
      }
    }

    const destWlNs = getWorkloadFromSpan(span);
    let destWlSelection: any;
    if (destWlNs) {
      const selector = `node[${CyNode.workload}="${destWlNs.workload}"][${CyNode.namespace}="${destWlNs.namespace}"]`;
      destWlSelection = !!serviceSelection ? serviceSelection.outgoers(selector) : cy.elements(selector);
      if (!!destWlSelection) {
        addSpan(singleNode(destWlSelection), span);
        if (!!serviceSelection) {
          addSpan(singleEdge(serviceSelection.edgesTo(destWlSelection)), span);
        }
      }
    }
  });

  cy.endBatch();
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
