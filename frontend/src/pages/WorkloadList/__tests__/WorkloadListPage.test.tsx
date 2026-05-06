import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { WorkloadListPage } from '../WorkloadListPage';
import { ClusterWorkloadsResponse } from '../../../types/Workload';
import { InstanceType } from '../../../types/Common';
import * as API from '../../../services/Api';
import { store } from '../../../store/ConfigStore';
import { NamespaceActions } from '../../../actions/NamespaceAction';
import { serverConfig, setServerConfig } from '../../../config/ServerConfig';
import type { Mock } from '@rstest/core';

rstest.mock('../../../hooks/refresh', () => ({
  useRefreshInterval: () => ({ lastRefreshAt: 1 })
}));

rstest.mock('../../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead', () => ({
  DefaultSecondaryMasthead: ({ children }: { children?: React.ReactNode }) => (
    <div data-test="DefaultSecondaryMasthead">{children}</div>
  )
}));

rstest.mock('components/Time/HealthComputeDurationMastheadToolbar', () => ({
  HealthComputeDurationMastheadToolbar: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

rstest.mock('../../../services/Api', () => ({
  getClustersWorkloads: rstest.fn()
}));

rstest.mock('../../../utils/PerformanceUtils', () => ({
  startPerfTimer: rstest.fn(),
  endPerfTimer: rstest.fn()
}));

rstest.mock('app/History', () => ({
  HistoryManager: {
    getBooleanParam: rstest.fn(),
    getClusterName: rstest.fn(),
    getDuration: rstest.fn(),
    getNumericParam: rstest.fn(),
    getParam: rstest.fn(),
    getRefresh: rstest.fn(() => 0),
    setParam: rstest.fn()
  },
  URLParam: {
    BY_LABELS: 'bylbl',
    DIRECTION: 'direction',
    DURATION: 'duration',
    NAMESPACES: 'namespaces',
    REFRESH_INTERVAL: 'refresh',
    SORT: 'sort'
  },
  location: {
    getPathname: () => '/',
    getSearch: () => ''
  },
  router: { navigate: rstest.fn(), state: { location: { pathname: '/', search: '' } }, basename: '' }
}));

describe('WorkloadListPage shallow render', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    store.dispatch(NamespaceActions.setActiveNamespaces([{ name: 'test-namespace' }]));
    serverConfig.clusters = {
      'test-cluster': {
        accessible: true,
        apiEndpoint: '',
        isKialiHome: true,
        kialiInstances: [],
        name: 'test-cluster',
        secretName: ''
      }
    };
    setServerConfig(serverConfig);
  });

  const renderPage = (): ReturnType<typeof render> =>
    render(
      <Provider store={store}>
        <MemoryRouter>
          <WorkloadListPage />
        </MemoryRouter>
      </Provider>
    );

  it('should render without errors when validations.workload is empty', async () => {
    const mockResponse: ClusterWorkloadsResponse = {
      cluster: 'test-cluster',
      validations: {
        workload: {}
      } as any,
      workloads: [
        {
          cluster: 'test-cluster',
          namespace: 'test-namespace',
          name: 'test-workload',
          instanceType: InstanceType.Workload,
          gvk: { Group: 'apps', Version: 'v1', Kind: 'Deployment' },
          appLabel: true,
          versionLabel: false,
          istioSidecar: true,
          isAmbient: false,
          isGateway: false,
          isWaypoint: false,
          isZtunnel: false,
          istioReferences: [],
          labels: { app: 'test' },
          health: {} as any
        }
      ]
    };

    (API.getClustersWorkloads as Mock).mockResolvedValue({ data: mockResponse });

    const { container } = renderPage();
    await waitFor(() => {
      expect(API.getClustersWorkloads).toHaveBeenCalled();
    });
    expect(container).toBeTruthy();
  });

  it('should render without errors when validations object is empty (no workload key)', async () => {
    const mockResponse: ClusterWorkloadsResponse = {
      cluster: 'test-cluster',
      validations: {} as any,
      workloads: [
        {
          cluster: 'test-cluster',
          namespace: 'test-namespace',
          name: 'test-workload',
          instanceType: InstanceType.Workload,
          gvk: { Group: 'apps', Version: 'v1', Kind: 'Deployment' },
          appLabel: true,
          versionLabel: false,
          istioSidecar: true,
          isAmbient: false,
          isGateway: false,
          isWaypoint: false,
          isZtunnel: false,
          istioReferences: [],
          labels: { app: 'test' },
          health: {} as any
        }
      ]
    };

    (API.getClustersWorkloads as Mock).mockResolvedValue({ data: mockResponse });

    const { container } = renderPage();
    await waitFor(() => {
      expect(API.getClustersWorkloads).toHaveBeenCalled();
    });
    expect(container).toBeTruthy();
  });
});
