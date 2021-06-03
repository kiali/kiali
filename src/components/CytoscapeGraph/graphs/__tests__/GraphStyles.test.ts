import cytoscape from 'cytoscape';

import { GraphStyles } from '../GraphStyles';
import { CytoscapeGlobalScratchNamespace, NodeType } from '../../../../types/Graph';
import { icons } from '../../../../config';

const nodeData = {
  id: 'n2',
  text: 'details (v1)',
  service: 'details.istio-system.svc.cluster.local',
  version: 'v1',
  cluster: `cluster-1`,
  namespace: 'istio-system',
  nodeType: NodeType.APP
};

function setupNode(nodeData: any) {
  const data = cytoscape({
    elements: {
      nodes: [{ data: nodeData }],
      edges: []
    }
  });
  const node = data.nodes()[0];
  node.cy().scratch(CytoscapeGlobalScratchNamespace, {
    activeNamespaces: ['TEST'],
    showVirtualServices: true
  });
  return node;
}

describe('GraphStyles test', () => {
  it('has icon for vs', () => {
    const data = { ...nodeData, hasVS: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.virtualService.className);
  });

  it('has icon for circuit breaker', () => {
    const data = { ...nodeData, hasVS: true, hasCB: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.circuitBreaker.className);
  });

  it('has icon for fault injection', () => {
    const data = { ...nodeData, hasVS: true, hasFaultInjection: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.faultInjection.className);
  });

  it('has icon for request routing', () => {
    const data = { ...nodeData, hasVS: true, hasRequestRouting: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.requestRouting.className);
  });

  it('has icon for request routing', () => {
    const data = { ...nodeData, hasVS: true, hasRequestRouting: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.requestRouting.className);
  });

  it('has icon for request timeout', () => {
    const data = { ...nodeData, hasVS: true, hasRequestTimeout: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.requestTimeout.className);
  });

  it('has icon for traffic shifting', () => {
    const data = { ...nodeData, hasVS: true, hasTrafficShifting: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.trafficShifting.className);
  });

  it('has icon for tcp traffic shifting', () => {
    const data = { ...nodeData, hasVS: true, hasTCPTrafficShifting: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.trafficShifting.className);
  });

  it('always displays root as leftmost icon', () => {
    const data = { ...nodeData, hasVS: true, hasTCPTrafficShifting: true, isRoot: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);

    const firstSpanBegin = label.search('<span');
    const firstSpanEnd = label.search('</span>');
    expect(label.substring(firstSpanBegin, firstSpanEnd)).toContain(icons.istio.root.className);
  });
});
