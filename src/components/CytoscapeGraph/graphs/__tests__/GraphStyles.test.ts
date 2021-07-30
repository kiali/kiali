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

function setupNode(nodeData: any, cyData?: any) {
  const data = cytoscape({
    elements: {
      nodes: [{ data: nodeData }],
      edges: []
    }
  });
  const node = data.nodes()[0];
  node.cy().scratch(CytoscapeGlobalScratchNamespace, {
    activeNamespaces: ['TEST'],
    showVirtualServices: true,
    ...cyData
  });
  return node;
}

describe('GraphStyles test', () => {
  it('has icon for vs', () => {
    const data = { ...nodeData, hasVS: {} };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.virtualService.className);
  });

  it('has icon for circuit breaker', () => {
    const data = { ...nodeData, hasVS: {}, hasCB: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.circuitBreaker.className);
  });

  it('has icon for circuit breaker even when no VS', () => {
    const data = { ...nodeData, hasCB: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.circuitBreaker.className);
  });

  it('hides circuit breaker icon when showVirtualServices is false', () => {
    const data = { ...nodeData, hasVS: {}, hasCB: true };
    const node = setupNode(data, { showVirtualServices: false });
    const label = GraphStyles.getNodeLabel(node);
    expect(label.includes(icons.istio.circuitBreaker.className)).toBe(false);
  });

  it('has icon for fault injection', () => {
    const data = { ...nodeData, hasVS: {}, hasFaultInjection: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.faultInjection.className);
  });

  it('has icon for request routing', () => {
    const data = { ...nodeData, hasVS: {}, hasRequestRouting: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.requestRouting.className);
  });

  it('has icon for request routing', () => {
    const data = { ...nodeData, hasVS: {}, hasRequestRouting: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.requestRouting.className);
  });

  it('has icon for request timeout', () => {
    const data = { ...nodeData, hasVS: {}, hasRequestTimeout: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.requestTimeout.className);
  });

  it('has icon for traffic shifting', () => {
    const data = { ...nodeData, hasVS: {}, hasTrafficShifting: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.trafficShifting.className);
  });

  it('has icon for tcp traffic shifting', () => {
    const data = { ...nodeData, hasVS: {}, hasTCPTrafficShifting: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);
    expect(label).toContain(icons.istio.trafficShifting.className);
  });

  it('always displays root as leftmost icon', () => {
    const data = { ...nodeData, hasVS: {}, hasTCPTrafficShifting: true, isRoot: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);

    const firstSpanBegin = label.search('<span');
    const firstSpanEnd = label.search('</span>');
    expect(label.substring(firstSpanBegin, firstSpanEnd)).toContain(icons.istio.root.className);
  });

  it('displays request routing icon before other kiali scenarios', () => {
    const data = { ...nodeData, hasVS: true, hasTCPTrafficShifting: true, hasRequestRouting: true };
    const node = setupNode(data);
    const label = GraphStyles.getNodeLabel(node);

    const firstSpanBegin = label.search('<span');
    const firstSpanEnd = label.search('</span>');
    expect(label.substring(firstSpanBegin, firstSpanEnd)).toContain(icons.istio.requestRouting.className);
  });
});
