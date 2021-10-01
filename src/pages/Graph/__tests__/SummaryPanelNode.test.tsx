import * as React from 'react';
import { GraphNodeData, GraphType, NodeType } from '../../../types/Graph';
import { mount } from 'enzyme';
import { SummaryPanelNode, SummaryPanelNodeProps } from '../SummaryPanelNode';
import { MemoryRouter } from 'react-router-dom';
import { Expandable } from '@patternfly/react-core';

let defaultProps: SummaryPanelNodeProps;
let nodeData: GraphNodeData;

describe('SummaryPanelNode', () => {
  beforeEach(() => {
    nodeData = {
      id: '1234',
      app: 'ratings',
      cluster: 'Kubernetes',
      nodeType: NodeType.APP,
      namespace: 'bookinfo',
      destServices: []
    };
    const target = {
      data: (destServices?) => (destServices ? [] : nodeData)
    };
    defaultProps = {
      jaegerState: {},
      data: {
        summaryType: 'node',
        summaryTarget: target
      },
      duration: 15,
      graphType: GraphType.VERSIONED_APP,
      injectServiceNodes: false,
      namespaces: [],
      queryTime: 20,
      rateInterval: '30s',
      step: 15,
      trafficRates: []
    };
  });

  it('renders', () => {
    const wrapper = mount(
      <MemoryRouter>
        <SummaryPanelNode {...defaultProps}></SummaryPanelNode>
      </MemoryRouter>
    );
    expect(wrapper.exists()).toBeTruthy();
  });

  it('renders workload entry links', () => {
    nodeData = { ...nodeData, workload: 'ratings-v1', hasWorkloadEntry: [{ name: 'first_we' }, { name: 'second_we' }] };
    const wrapper = mount(
      <MemoryRouter>
        <SummaryPanelNode {...defaultProps}></SummaryPanelNode>
      </MemoryRouter>
    );
    const weLinks = wrapper.find('a').findWhere(a => a.prop('href') && a.prop('href').includes('workloadentries'));
    expect(weLinks.exists()).toBeTruthy();
    expect(weLinks.length).toEqual(2);
  });

  it('renders expandable dropdown for workload entries', () => {
    nodeData = { ...nodeData, workload: 'ratings-v1', hasWorkloadEntry: [{ name: 'first_we' }, { name: 'second_we' }] };
    const wrapper = mount(
      <MemoryRouter>
        <SummaryPanelNode {...defaultProps}></SummaryPanelNode>
      </MemoryRouter>
    );
    const expandable = wrapper.find(Expandable);
    expect(expandable.exists()).toBeTruthy();
    expect(
      expandable
        .children()
        .find('a')
        .findWhere(a => a.prop('href') && a.prop('href').includes('workloadentries'))
        .exists()
    ).toBeTruthy();
  });

  it('renders a single link to workload', () => {
    nodeData = { ...nodeData, workload: 'ratings-v1' };
    const wrapper = mount(
      <MemoryRouter>
        <SummaryPanelNode {...defaultProps}></SummaryPanelNode>
      </MemoryRouter>
    );
    const weLinks = wrapper.find('a').findWhere(a => a.prop('href') && a.prop('href').includes('workload'));
    expect(weLinks.exists()).toBeTruthy();
    expect(weLinks.length).toEqual(1);
  });
});
