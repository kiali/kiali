import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
        largeConfigClustersThreshold: 100,
        memoryLimitBytes: 1073741824,
        memoryMaxBytes: 1024,
        memoryThresholdBytes: 751619277,
        memoryUsedPercent: 0.0001,
        proxyType: 'sidecar',
        requestRate: 1.5,
        roughConfigMemoryBytes: 512000
      }
    } as any);
    rstest.spyOn(API, 'getCustomDashboard').mockResolvedValue({
      data: {
        title: 'Envoy Memory',
        aggregations: [],
        charts: [
          {
            name: 'Memory trends',
            metrics: [
              {
                name: 'Envoy allocated',
                labels: {},
                datapoints: [
                  [1720526400, 1024],
                  [1720526430, 2048]
                ]
              }
            ],
            spans: 12,
            startCollapsed: false,
            unit: 'bytes'
          },
          { name: 'Active connections', metrics: [], spans: 12, startCollapsed: false, unit: '' },
          { name: 'Active clusters', metrics: [], spans: 12, startCollapsed: false, unit: '' },
          { name: 'Request rate', metrics: [], spans: 12, startCollapsed: false, unit: 'rps' }
        ],
        externalLinks: [],
        rows: 1
      }
    } as any);
    rstest.spyOn(API, 'getPodEnvoyProxyResourceEntries').mockImplementation((_ns, _pod, resource) => {
      if (resource === 'clusters') {
        return Promise.resolve({ data: { clusters: [{}, {}] } } as any);
      }
      if (resource === 'listeners') {
        return Promise.resolve({ data: { listeners: [{}] } } as any);
      }
      return Promise.resolve({ data: { routes: [{}, {}, {}] } } as any);
    });
  });

  afterEach(() => {
    rstest.clearAllMocks();
  });

  it('renders without invalid element type errors', async () => {
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

    expect(await screen.findByTestId('envoy-memory-status-alert')).toBeInTheDocument();
    expect(screen.getByText('Within normal range')).toBeInTheDocument();
  });

  it('renders Memory Status above metric tiles', async () => {
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

    const metrics = await screen.findByTestId('envoy-memory-summary-metrics');
    const status = await screen.findByTestId('envoy-memory-status-alert');
    expect(status.compareDocumentPosition(metrics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Memory Status')).toBeInTheDocument();
    expect(screen.getByText('Within normal range')).toBeInTheDocument();
    expect(
      screen.queryByText('Envoy proxy memory is within the expected range for this workload type.')
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Warning at/)).not.toBeInTheDocument();
    expect(screen.queryByText('Rough estimate from cluster count')).not.toBeInTheDocument();
  });

  it('requests per-pod series by default and Sum/Max when selected', async () => {
    const workloadWithPods = {
      ...workload,
      pods: [{ name: 'details-v1-abc123' }, { name: 'details-v1-def456' }]
    };

    render(
      <Provider store={store}>
        <MemoryRouter>
          <EnvoyMemory
            lastRefreshAt={1720526431902}
            namespace="bookinfo"
            timeRange={{ from: 0, to: 1000 }}
            workload={workloadWithPods}
          />
        </MemoryRouter>
      </Provider>
    );

    expect(await screen.findByTestId('envoy-memory-chart-view-mode')).toBeInTheDocument();
    expect(screen.getByText('Pod Aggregation')).toBeInTheDocument();
    expect(document.getElementById('envoy-memory-chart-pod-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('envoy-memory-chart-expand')).toBeInTheDocument();
    expect(screen.getByTestId('envoy-memory-status-help')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('envoy-memory-chart-expand'));
    expect(screen.queryByTestId('envoy-memory-status-alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('envoy-memory-summary-metrics')).not.toBeInTheDocument();
    expect(screen.getByTestId('envoy-memory-overlay-chart')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('envoy-memory-chart-expand'));
    expect(await screen.findByTestId('envoy-memory-status-alert')).toBeInTheDocument();
    expect(screen.getByTestId('envoy-memory-summary-metrics')).toBeInTheDocument();

    await waitFor(() => {
      expect(API.getCustomDashboard).toHaveBeenCalledWith(
        'bookinfo',
        'envoy-memory',
        expect.objectContaining({
          byLabels: ['pod'],
          rawDataAggregator: 'max',
          workload: 'details-v1'
        }),
        'cluster-default'
      );
    });

    fireEvent.click(document.getElementById('envoy-memory-chart-view-mode-toggle')!);
    fireEvent.click(screen.getByText('Sum'));

    await waitFor(() => {
      expect(API.getCustomDashboard).toHaveBeenCalledWith(
        'bookinfo',
        'envoy-memory',
        expect.objectContaining({
          byLabels: ['pod'],
          rawDataAggregator: 'sum',
          workload: 'details-v1'
        }),
        'cluster-default'
      );
    });
  });

  it('shows one legend entry per pod with Max or Sum aggregation', async () => {
    const workloadWithPods = {
      ...workload,
      pods: [{ name: 'details-v1-abc123' }, { name: 'details-v1-def456' }]
    };

    rstest.spyOn(API, 'getCustomDashboard').mockResolvedValue({
      data: {
        title: 'Envoy Memory',
        aggregations: [],
        charts: [
          {
            name: 'Memory trends',
            metrics: [
              {
                name: 'Envoy allocated',
                labels: { pod: 'details-v1-abc123' },
                datapoints: [
                  [1720526400, 1024],
                  [1720526430, 1536]
                ]
              },
              {
                name: 'Envoy allocated',
                labels: { pod: 'details-v1-def456' },
                datapoints: [
                  [1720526400, 2048],
                  [1720526430, 2560]
                ]
              }
            ],
            spans: 12,
            startCollapsed: false,
            unit: 'bytes'
          },
          { name: 'Active connections', metrics: [], spans: 12, startCollapsed: false, unit: '' }
        ],
        externalLinks: [],
        rows: 1
      }
    } as any);

    render(
      <Provider store={store}>
        <MemoryRouter>
          <EnvoyMemory
            lastRefreshAt={1720526431902}
            namespace="bookinfo"
            timeRange={{ from: 1720526400000, to: 1720526430000 }}
            workload={workloadWithPods}
          />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Envoy allocated [details-v1-abc123]')).toBeInTheDocument();
    });
    expect(screen.getByText('Envoy allocated [details-v1-def456]')).toBeInTheDocument();
  });

  it('shows Memory limit in the chart legend when summary has a limit', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <EnvoyMemory
            lastRefreshAt={1720526431902}
            namespace="bookinfo"
            timeRange={{ from: 1720526400000, to: 1720526430000 }}
            workload={workload}
          />
        </MemoryRouter>
      </Provider>
    );

    expect(await screen.findByText('Memory limit')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));

    expect(await screen.findByTestId('envoy-memory-tab')).toBeInTheDocument();
  });

  it('navigates to envoy resource tabs from overview links', async () => {
    const onSelectEnvoyTab = rstest.fn();
    const workloadWithPods = {
      ...workload,
      pods: [{ name: 'details-v1-abc123' }]
    };

    render(
      <Provider store={store}>
        <MemoryRouter>
          <EnvoyMemory
            lastRefreshAt={1720526431902}
            namespace="bookinfo"
            onSelectEnvoyTab={onSelectEnvoyTab}
            timeRange={{ from: 0, to: 1000 }}
            workload={workloadWithPods}
          />
        </MemoryRouter>
      </Provider>
    );

    fireEvent.click(await screen.findByTestId('envoy-overview-clusters-link'));
    fireEvent.click(await screen.findByTestId('envoy-overview-listeners-link'));
    fireEvent.click(await screen.findByTestId('envoy-overview-routes-link'));

    expect(onSelectEnvoyTab).toHaveBeenCalledWith('clusters');
    expect(onSelectEnvoyTab).toHaveBeenCalledWith('listeners');
    expect(onSelectEnvoyTab).toHaveBeenCalledWith('routes');
  });
});
