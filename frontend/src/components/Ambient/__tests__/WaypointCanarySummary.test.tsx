// Assisted-by: Codex
import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { createStore } from 'redux';
import { location } from 'app/History';
import { serverConfig, setServerConfig } from 'config/ServerConfig';
import { WaypointType } from 'types/Ambient';
import type { GatewayWaypointTrafficSplitConfig } from 'types/WaypointTraffic';
import { emptyWorkload, type Workload } from 'types/Workload';
import { WaypointCanaryInfoPanel, WaypointGatewayCanaryPanel } from '../WaypointCanarySummary';
import { WaypointConfig } from '../WaypointConfig';

const store = createStore(() => ({ globalState: { kiosk: '' } }));
const originalServerConfig = serverConfig;

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Provider store={store}>
    <MemoryRouter>{children}</MemoryRouter>
  </Provider>
);

const makeConfig = (configLevel: string, canaryWeight: number): GatewayWaypointTrafficSplitConfig => ({
  configLevel,
  namespace: 'bookinfo',
  serviceName: configLevel === 'service' ? 'reviews' : undefined,
  split: {
    canary: { cluster: 'remote', name: 'waypoint-v2', namespace: 'infra', role: 'canary' },
    canaryWeight,
    configLevel,
    primary: { cluster: 'remote', name: 'waypoint', namespace: 'infra', role: 'primary' },
    primaryWeight: 100 - canaryWeight
  }
});

const panelProps = { workloadCluster: 'remote', workloadName: 'waypoint-v2', workloadNamespace: 'infra' };
const servicesHref = '/namespaces/infra/workloads/waypoint-v2?tab=waypoint&waypointTab=service';

describe('waypoint traffic split summary', () => {
  afterEach(() => {
    rstest.restoreAllMocks();
    setServerConfig(originalServerConfig);
  });

  it.each([false, true])('shows namespace rows and a separate Service notice (compact=%s)', compact => {
    render(
      <WaypointCanaryInfoPanel
        {...panelProps}
        compact={compact}
        configs={[makeConfig('namespace', 30), makeConfig('service', 10)]}
      />,
      { wrapper: Wrapper }
    );

    const table = screen.getByRole('grid', { name: 'Traffic split' });
    expect(screen.queryByText('Namespace traffic splits') !== null).toBe(compact);
    expect(within(table).getByText('primary (70%)')).toBeInTheDocument();
    expect(within(table).getByText('canary (30%)')).toBeInTheDocument();
    expect(within(table).queryByText('primary (90%)')).not.toBeInTheDocument();
    expect(within(table).queryByText('canary (10%)')).not.toBeInTheDocument();
    expect(screen.getByText('Service-level traffic splits are configured.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Services' })).toHaveAttribute('href', servicesHref);
  });

  it.each([false, true])('keeps the Service notice without a namespace table (compact=%s)', compact => {
    render(<WaypointCanaryInfoPanel {...panelProps} compact={compact} configs={[makeConfig('service', 10)]} />, {
      wrapper: Wrapper
    });

    expect(screen.queryByRole('grid', { name: 'Traffic split' })).not.toBeInTheDocument();
    expect(screen.queryByText('Namespace traffic splits')).not.toBeInTheDocument();
    expect(screen.getByText('Service-level traffic splits are configured.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Services' })).toHaveAttribute('href', servicesHref);
  });

  it.each([false, true])('sorts namespace groups while keeping each split together (compact=%s)', async compact => {
    const configs = [
      { ...makeConfig('namespace', 10), namespace: 'zeta' },
      { ...makeConfig('namespace', 30), namespace: 'alpha' }
    ];
    const user = userEvent.setup();
    render(<WaypointCanaryInfoPanel {...panelProps} compact={compact} configs={configs} />, { wrapper: Wrapper });
    const table = screen.getByRole('grid', { name: 'Traffic split' });
    const assertFirstSplit = (namespace: string, primary: number, canary: number): void => {
      const rows = within(table).getAllByRole('row');
      expect(within(rows[1]).getByText(namespace)).toBeInTheDocument();
      expect(within(rows[1]).getByText(`primary (${primary}%)`)).toBeInTheDocument();
      expect(within(rows[2]).getByText(`canary (${canary}%)`)).toBeInTheDocument();
    };

    assertFirstSplit('alpha', 70, 30);
    await user.click(within(table).getByRole('button', { name: 'Namespace' }));
    assertFirstSplit('zeta', 90, 10);
    expect(within(table).getByRole('columnheader', { name: 'Namespace' })).toHaveAttribute('aria-sort', 'descending');

    await user.click(within(table).getByRole('button', { name: 'Namespace' }));
    assertFirstSplit('alpha', 70, 30);
    expect(within(table).getByRole('columnheader', { name: 'Namespace' })).toHaveAttribute('aria-sort', 'ascending');
    expect(configs.map(config => config.namespace)).toEqual(['zeta', 'alpha']);
  });

  it('omits the Service notice for namespace-only splits', () => {
    render(<WaypointCanaryInfoPanel {...panelProps} configs={[makeConfig('namespace', 30)]} />, { wrapper: Wrapper });

    expect(screen.getByRole('grid', { name: 'Traffic split' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View Services' })).not.toBeInTheDocument();
  });

  it('renders nothing without any canary splits', () => {
    const config = makeConfig('service', 0);
    config.split!.canary = undefined;
    const { container } = render(<WaypointCanaryInfoPanel {...panelProps} configs={[config]} />, { wrapper: Wrapper });

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the waypoint cluster in the Services link for a multi-cluster mesh', () => {
    const cluster = {
      accessible: true,
      apiEndpoint: '',
      isKialiHome: false,
      kialiInstances: [],
      name: 'remote',
      secretName: ''
    };
    setServerConfig({
      ...originalServerConfig,
      clusters: { home: { ...cluster, isKialiHome: true, name: 'home' }, remote: cluster }
    });
    render(
      <WaypointGatewayCanaryPanel
        cluster="remote"
        configs={[makeConfig('service', 10)]}
        namespace="infra"
        workload="waypoint-v2"
      />,
      {
        wrapper: Wrapper
      }
    );

    expect(screen.queryByRole('grid', { name: 'Traffic split' })).not.toBeInTheDocument();
    const href = screen.getByRole('link', { name: 'View Services' }).getAttribute('href')!;
    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/namespaces/infra/workloads/waypoint-v2');
    expect(url.searchParams.get('clusterName')).toBe('remote');
    expect(url.searchParams.get('tab')).toBe('waypoint');
    expect(url.searchParams.get('waypointTab')).toBe(WaypointType.Service);
  });

  it('opens the Services subtab when the notice is clicked from the mounted waypoint Overview', async () => {
    rstest.spyOn(location, 'getSearch').mockReturnValue('?tab=waypoint&waypointTab=overview');
    const workload: Workload = {
      ...emptyWorkload,
      cluster: 'remote',
      labels: { 'istio.io/waypoint-for': WaypointType.Service },
      name: 'waypoint-v2',
      namespace: 'infra',
      pods: [],
      waypointServices: [
        { cluster: 'remote', name: 'reviews', namespace: 'bookinfo', roleWeight: 10, waypointRole: 'canary' }
      ],
      waypointTrafficSplitConfigs: [makeConfig('service', 10)]
    };
    const user = userEvent.setup();
    render(<WaypointConfig workload={workload} />, { wrapper: Wrapper });

    expect(screen.getAllByText('Namespace traffic splits')).toHaveLength(1);

    await user.click(screen.getByRole('link', { name: 'View Services' }));

    expect(screen.getByRole('tab', { name: 'Services' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('reviews')).toBeInTheDocument();
    expect(screen.getByText('Canary (10%)')).toBeInTheDocument();
  });
});
