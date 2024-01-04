import * as React from 'react';
import { DecoratedGraphNodeData, GraphNodeData, GraphType, NodeType } from '../../../types/Graph';
import { mount } from 'enzyme';
import { SummaryPanelNodeComponent, SummaryPanelNodeComponentProps } from '../SummaryPanelNode';
import { MemoryRouter } from 'react-router-dom';
import { ExpandableSection } from '@patternfly/react-core';
import { store } from '../../../store/ConfigStore';
import { Provider } from 'react-redux';
import { serverConfig, setServerConfig } from '../../../config/ServerConfig';

let defaultProps: SummaryPanelNodeComponentProps;
let nodeData: GraphNodeData;

describe('SummaryPanelNodeComponent', () => {
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
      tracingState: {},
      data: {
        summaryType: 'node',
        summaryTarget: target
      },
      duration: 15,
      graphType: GraphType.VERSIONED_APP,
      injectServiceNodes: false,
      kiosk: '',
      namespaces: [],
      queryTime: 20,
      rankResult: { upperBound: 0 },
      showRank: false,
      rateInterval: '30s',
      step: 15,
      trafficRates: [],
      gateways: null,
      peerAuthentications: null,
      serviceDetails: null
    };

    serverConfig.clusters = {
      'cluster-default': {
        accessible: true,
        apiEndpoint: '',
        isKialiHome: true,
        kialiInstances: [],
        name: 'cluster-default',
        network: 'test-net',
        secretName: 'test-secret'
      }
    };
    setServerConfig(serverConfig);
  });

  it('renders', () => {
    const wrapper = mount(
      <Provider store={store}>
        <MemoryRouter>
          <SummaryPanelNodeComponent {...defaultProps} />
        </MemoryRouter>
      </Provider>
    );
    expect(wrapper.exists()).toBeTruthy();
  });

  it('renders workload entry links', () => {
    nodeData = { ...nodeData, workload: 'ratings-v1', hasWorkloadEntry: [{ name: 'first_we' }, { name: 'second_we' }] };
    const wrapper = mount(
      <Provider store={store}>
        <MemoryRouter>
          <SummaryPanelNodeComponent {...defaultProps} />
        </MemoryRouter>
      </Provider>
    );
    const weLinks = wrapper.find('a').findWhere(a => a.prop('href') && a.prop('href').includes('workloadentries'));
    expect(weLinks.exists()).toBeTruthy();
    expect(weLinks.length).toEqual(2);
  });

  it('renders expandable dropdown for workload entries', () => {
    nodeData = { ...nodeData, workload: 'ratings-v1', hasWorkloadEntry: [{ name: 'first_we' }, { name: 'second_we' }] };
    const wrapper = mount(
      <Provider store={store}>
        <MemoryRouter>
          <SummaryPanelNodeComponent {...defaultProps} />
        </MemoryRouter>
      </Provider>
    );
    const expandable = wrapper.find(ExpandableSection);
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
      <Provider store={store}>
        <MemoryRouter>
          <SummaryPanelNodeComponent {...defaultProps} />
        </MemoryRouter>
      </Provider>
    );
    const weLinks = wrapper.find('a').findWhere(a => a.prop('href') && a.prop('href').includes('workload'));
    expect(weLinks.exists()).toBeTruthy();
    expect(weLinks.length).toEqual(1);
  });

  it('shows rank N/A when node rank undefined', () => {
    const props = { ...defaultProps, rankResult: { upperBound: 0 }, showRank: true };
    const wrapper = mount(
      <Provider store={store}>
        <MemoryRouter>
          <SummaryPanelNodeComponent {...props} />
        </MemoryRouter>
      </Provider>
    );
    const rankText = wrapper.find('span').findWhere(span => {
      const html = span.render().html();
      return html !== null && html.includes('Rank: N/A');
    });
    expect(rankText.exists()).toBeTruthy();
    expect(rankText.length).toEqual(1);
  });

  it('shows node rank', () => {
    (nodeData as DecoratedGraphNodeData).rank = 2;
    const props = { ...defaultProps, rankResult: { upperBound: 3 }, showRank: true };
    const wrapper = mount(
      <Provider store={store}>
        <MemoryRouter>
          <SummaryPanelNodeComponent {...props} />
        </MemoryRouter>
      </Provider>
    );
    const rankText = wrapper.find('span').findWhere(span => {
      const html = span.render().html();
      return html !== null && html.includes('Rank: 2 / 3');
    });
    expect(rankText.exists()).toBeTruthy();
    expect(rankText.length).toEqual(1);
  });
});
