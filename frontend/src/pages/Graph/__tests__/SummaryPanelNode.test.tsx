import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { DecoratedGraphNodeData, GraphNodeData, GraphType, NodeType } from '../../../types/Graph';
import { SummaryPanelNodeComponent, SummaryPanelNodeComponentProps } from '../SummaryPanelNode';
import { MemoryRouter } from 'react-router-dom-v5-compat';
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
      data: (destServices?) => (destServices ? [] : nodeData),
      getData: () => {
        return nodeData;
      }
    } as any;
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
      kioskData: undefined,
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
        secretName: 'test-secret'
      }
    };
    setServerConfig(serverConfig);
  });

  const renderPanel = (props: SummaryPanelNodeComponentProps = defaultProps): ReturnType<typeof render> =>
    render(
      <Provider store={store}>
        <MemoryRouter>
          <SummaryPanelNodeComponent {...props} />
        </MemoryRouter>
      </Provider>
    );

  it('renders', () => {
    const { container } = renderPanel();
    expect(container).toBeTruthy();
  });

  it('renders workload entry links', () => {
    nodeData = { ...nodeData, workload: 'ratings-v1', hasWorkloadEntry: [{ name: 'first_we' }, { name: 'second_we' }] };
    const { container } = renderPanel();
    const weLinks = container.querySelectorAll('a[href*="WorkloadEntry"]');
    expect(weLinks.length).toBe(2);
  });

  it('renders expandable dropdown for workload entries', () => {
    nodeData = { ...nodeData, workload: 'ratings-v1', hasWorkloadEntry: [{ name: 'first_we' }, { name: 'second_we' }] };
    const { container } = renderPanel();
    expect(screen.getByRole('button', { name: /2 workload entries/i })).toBeInTheDocument();
    expect(container.querySelectorAll('a[href*="WorkloadEntry"]').length).toBe(2);
  });

  it('renders a single link to workload', () => {
    nodeData = { ...nodeData, workload: 'ratings-v1' };
    const { container } = renderPanel();
    const wlLinks = container.querySelectorAll('a[href*="workload"]');
    expect(wlLinks.length).toBe(1);
  });

  it('shows rank N/A when node rank undefined', () => {
    const props = { ...defaultProps, rankResult: { upperBound: 0 }, showRank: true };
    renderPanel(props);
    expect(screen.getByText(/Rank: N\/A/)).toBeInTheDocument();
  });

  it('shows node rank', () => {
    (nodeData as DecoratedGraphNodeData).rank = 2;
    const props = { ...defaultProps, rankResult: { upperBound: 3 }, showRank: true };
    renderPanel(props);
    expect(screen.getByText(/Rank: 2 \/ 3/)).toBeInTheDocument();
  });

  it('does not render network traffic badge when netobserv is not available', () => {
    renderPanel();
    expect(screen.queryByText(/network traffic/i)).not.toBeInTheDocument();
  });
});
