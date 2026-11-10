import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DecoratedGraphNodeData, GraphNodeData } from '../../../types/Graph';
import { GraphType, NodeType } from '../../../types/Graph';
import { SummaryPanelNodeComponent } from '../SummaryPanelNode';
import type { SummaryPanelNodeComponentProps } from '../SummaryPanelNode';
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

  it.each([
    { entries: [{ name: 'first_we' }], countText: '1 workload entry' },
    { entries: [{ name: 'first_we' }, { name: 'second_we' }], countText: '2 workload entries' }
  ])('shows $countText in a popover with resource links', async ({ entries, countText }) => {
    nodeData = { ...nodeData, workload: 'ratings-v1', hasWorkloadEntry: entries };
    const user = userEvent.setup();
    renderPanel();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'first_we' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: countText }));

    const popover = await screen.findByRole('dialog');
    expect(within(popover).getByText('Workload Entries')).toBeInTheDocument();
    for (const entry of entries) {
      expect(within(popover).getByRole('link', { name: entry.name })).toHaveAttribute(
        'href',
        `/namespaces/bookinfo/istio/networking.istio.io/v1/WorkloadEntry/${entry.name}`
      );
    }
  });

  it('renders a single link to workload', () => {
    nodeData = { ...nodeData, workload: 'ratings-v1' };
    const { container } = renderPanel();
    const wlLinks = container.querySelectorAll('a[href*="workload"]');
    expect(wlLinks.length).toBe(1);
  });

  it('renders a workload details link when the node is a waypoint proxy', () => {
    nodeData = {
      ...nodeData,
      app: '',
      isWaypoint: true,
      nodeType: NodeType.WORKLOAD,
      workload: 'waypoint'
    };
    const { container } = renderPanel();
    expect(container.querySelector('a[href$="/namespaces/bookinfo/workloads/waypoint"]')).toBeInTheDocument();
  });

  it('shows the VS host count inline and opens its popover with the keyboard', async () => {
    nodeData = {
      ...nodeData,
      hasRequestRouting: true,
      hasVS: { hostnames: ['ratings.bookinfo.svc.cluster.local'] }
    };
    const user = userEvent.setup();
    renderPanel();

    const trigger = screen.getByRole('button', { name: '1 host' });
    expect(screen.getByText('Has Request Routing')).toHaveTextContent('Has Request Routing (1 host)');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    trigger.focus();
    await user.keyboard('{Enter}');

    const popover = await screen.findByRole('dialog');
    expect(within(popover).getByText('VirtualService Hosts')).toBeInTheDocument();
    expect(within(popover).getByText('ratings.bookinfo.svc.cluster.local')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('lists multiple VS hosts in the popover, including the wildcard description', async () => {
    nodeData = {
      ...nodeData,
      hasRequestRouting: true,
      hasVS: { hostnames: ['ratings.bookinfo.svc.cluster.local', '*'] }
    };
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByText('Has Request Routing')).toHaveTextContent('Has Request Routing (2 hosts)');
    await user.click(screen.getByRole('button', { name: '2 hosts' }));

    const popover = await screen.findByRole('dialog');
    expect(within(popover).getByText('ratings.bookinfo.svc.cluster.local')).toBeInTheDocument();
    expect(within(popover).getByText('* (all hosts)')).toBeInTheDocument();
  });

  it('shows the fallback VirtualService hosts inline in a popover', async () => {
    nodeData = { ...nodeData, hasVS: { hostnames: ['ratings.bookinfo.svc.cluster.local', '*'] } };
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByText('Has Virtual Service')).toHaveTextContent('Has Virtual Service (2 hosts)');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '2 hosts' }));

    const popover = await screen.findByRole('dialog');
    expect(within(popover).getByText('VirtualService Hosts')).toBeInTheDocument();
    expect(within(popover).getByText('ratings.bookinfo.svc.cluster.local')).toBeInTheDocument();
    expect(within(popover).getByText('* (all hosts)')).toBeInTheDocument();
  });

  it.each(['ingressInfo', 'egressInfo', 'gatewayAPIInfo'] as const)(
    'shows %s gateway hosts inline in a popover',
    async gatewayType => {
      nodeData = {
        ...nodeData,
        isGateway: { [gatewayType]: { hostnames: ['bookinfo.example.com', '*'] } },
        isK8sGatewayAPI: gatewayType === 'gatewayAPIInfo'
      };
      const user = userEvent.setup();
      renderPanel();

      expect(screen.getByText('Is Gateway', { exact: false })).toHaveTextContent(
        `Is Gateway${gatewayType === 'gatewayAPIInfo' ? ' (K8s GW API)' : ''} (2 hosts)`
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '2 hosts' }));

      const popover = await screen.findByRole('dialog');
      expect(within(popover).getByText('Gateway Hosts')).toBeInTheDocument();
      expect(within(popover).getByText('bookinfo.example.com')).toBeInTheDocument();
      expect(within(popover).getByText('* (all hosts)')).toBeInTheDocument();
    }
  );

  it.each([
    { name: 'missing', hostnames: undefined },
    { name: 'empty', hostnames: [] }
  ])('omits the VS host-count link when hostnames are $name', ({ hostnames }) => {
    nodeData = { ...nodeData, hasRequestRouting: true, hasVS: { hostnames } };
    renderPanel();

    expect(screen.getByText('Has Request Routing')).toBeInTheDocument();
    expect(screen.queryByTestId('vs-hosts-popover-toggle')).not.toBeInTheDocument();
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
