import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { EnvoyDetails } from '../EnvoyDetails';
import { EnvoyMemory } from '../EnvoyMemory';
import { store } from '../../../store/ConfigStore';
import * as API from '../../../services/Api';

const workload = {
  name: 'details-v1',
  namespace: 'bookinfo',
  cluster: 'cluster-default',
  labels: { app: 'details', version: 'v1' },
  istioSidecar: true,
  isGateway: false,
  isWaypoint: false,
  isZtunnel: false,
  gvk: { Group: 'apps', Version: 'v1', Kind: 'Deployment' }
} as any;

describe('EnvoyMemory', () => {
  beforeEach(() => {
    rstest.spyOn(API, 'getWorkloadEnvoyMemory').mockResolvedValue({
      data: {
        activeClustersMax: 10,
        activeConnections: 5,
        cause: 'ok',
        memoryLimitBytes: 1073741824,
        memoryMaxBytes: 1024,
        memoryThresholdBytes: 751619277,
        memoryUsedPercent: 0.0001,
        proxyType: 'sidecar',
        requestRate: 1.5
      }
    } as any);
    rstest.spyOn(API, 'getCustomDashboard').mockResolvedValue({
      data: { title: 'Envoy Memory', aggregations: [], charts: [], externalLinks: [], rows: 2 }
    } as any);
  });

  afterEach(() => {
    rstest.clearAllMocks();
  });

  it('renders without invalid element type errors', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <EnvoyMemory
            lastRefreshAt={1720526431902}
            namespace="bookinfo"
            timeRange={{ from: 0, to: 1000 }}
            workload={workload}
          />
        </MemoryRouter>
      </Provider>
    );
  });

  it('renders EnvoyDetails memory tab without invalid element type errors', () => {
    const workloadWithPods = {
      ...workload,
      pods: [{ name: 'details-v1-abc123' }],
      runtimes: [{ dashboardRefs: [{ template: 'envoy' }] }]
    };

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/?envoyTab=memory']}>
          <EnvoyDetails
            lastRefreshAt={1720526431902}
            namespace="bookinfo"
            rangeDuration={{ from: 0, to: 1000 }}
            workload={workloadWithPods}
          />
        </MemoryRouter>
      </Provider>
    );
  });

  it('opens memory tab when metrics dashboard is unavailable', async () => {
    const workloadWithPods = {
      ...workload,
      pods: [{ name: 'details-v1-abc123' }],
      runtimes: []
    };

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/?envoyTab=clusters']}>
          <EnvoyDetails
            lastRefreshAt={1720526431902}
            namespace="bookinfo"
            rangeDuration={{ from: 0, to: 1000 }}
            workload={workloadWithPods}
          />
        </MemoryRouter>
      </Provider>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));

    expect(await screen.findByTestId('envoy-memory-tab')).toBeInTheDocument();
  });
});
