import * as Cy from 'cytoscape';
import { CyNode } from './CytoscapeGraphUtils';
import { NodeType } from '../../types/Graph';
import { JaegerTrace, Span } from 'types/JaegerInfo';
import { getWorkloadFromSpan, searchParentWorkload } from 'components/JaegerIntegration/JaegerHelper';

const getKeyAndType = (node: Cy.NodeSingular) => {
  const namespace = node.data(CyNode.namespace);
  const nodeType = node.data(CyNode.nodeType);
  let key: string | undefined;
  switch (nodeType) {
    case NodeType.SERVICE:
      key = node.data(CyNode.service) + '.' + namespace;
      break;
    case NodeType.WORKLOAD:
      key = node.data(CyNode.workload) + '.' + namespace;
      break;
    case NodeType.APP:
      // Note: it may only work for workloads named using the conventional "$name-$version".
      // If this convention is not used, only service nodes will be highlighted for traces in app-versioned graph.
      key = node.data(CyNode.app) + '-' + node.data(CyNode.version) + '.' + namespace;
      break;
  }
  if (key) {
    return {
      key: key,
      type: nodeType
    };
  }
  return undefined;
};

const addToMap = (key: string, map: Map<String, Span[]>, span: Span) => {
  let spans = map.get(key);
  if (!spans) {
    spans = [];
    map.set(key, spans);
  }
  spans.push(span);
};

export const showTrace = (cy: Cy.Core, trace: JaegerTrace) => {
  if (!cy) {
    return;
  }
  const spansPerService = new Map<String, Span[]>();
  const spansPerWorkload = new Map<String, Span[]>();
  const spansPerEdge = new Map<String, Span[]>();
  trace.spans.forEach(span => {
    // TODO: namespace should be added to map key when it's not present (it's not mandatory in tracing)
    addToMap(span.process.serviceName, spansPerService, span);
    const workloadNs = getWorkloadFromSpan(span);
    if (workloadNs) {
      addToMap(workloadNs.workload + '.' + workloadNs.namespace, spansPerWorkload, span);
      addToMap(span.process.serviceName + '~' + workloadNs.workload + '.' + workloadNs.namespace, spansPerEdge, span);
    }
    const parentWkdNs = searchParentWorkload(span);
    if (parentWkdNs) {
      addToMap(parentWkdNs.workload + '.' + parentWkdNs.namespace + '~' + span.process.serviceName, spansPerEdge, span);
    }
  });

  // TODO: replace with node selectors
  cy.nodes().forEach(ele => {
    ele.data('spans', null);
    const keyAndType = getKeyAndType(ele);
    if (!keyAndType) {
      return;
    }
    switch (keyAndType.type) {
      case NodeType.SERVICE:
        ele.data('spans', spansPerService.get(keyAndType.key));
        break;
      case NodeType.WORKLOAD:
      case NodeType.APP:
        ele.data('spans', spansPerWorkload.get(keyAndType.key));
        break;
    }
  });

  // TODO: replace with edge selectors
  cy.edges().forEach(edge => {
    edge.data('spans', null);
    const sourceKeyType = getKeyAndType(edge.source());
    const destKeyType = getKeyAndType(edge.target());
    if (sourceKeyType && destKeyType) {
      const fullKey = sourceKeyType.key + '~' + destKeyType.key;
      edge.data('spans', spansPerEdge.get(fullKey));
    }
  });
};

export const hideTrace = (cy: Cy.Core) => {
  if (!cy) {
    return;
  }
  cy.nodes().forEach(ele => {
    ele.data('spans', null);
  });
  cy.edges().forEach(ele => {
    ele.data('spans', null);
  });
};
