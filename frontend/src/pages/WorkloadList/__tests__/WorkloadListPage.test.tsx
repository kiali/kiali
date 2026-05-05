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

jest.mock('../../../hooks/refresh', () => ({
  useRefreshInterval: () => ({ lastRefreshAt: 1 })
}));

jest.mock('../../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead', () => ({
  DefaultSecondaryMasthead: ({ children }: { children?: React.ReactNode }) => (
    <div data-test="DefaultSecondaryMasthead">{children}</div>
  )
}));

jest.mock('components/Time/HealthComputeDurationMastheadToolbar', () => ({
  HealthComputeDurationMastheadToolbar: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

jest.mock('../../../services/Api', () => ({
  getClustersWorkloads: jest.fn()
}));

jest.mock('../../../utils/PerformanceUtils', () => ({
  startPerfTimer: jest.fn(),
  endPerfTimer: jest.fn()
}));

jest.mock('app/History', () => ({
  ...(jest as any).requireActual('app/History'),
  HistoryManager: {
    getBooleanParam: jest.fn(),
    getDuration: jest.fn(),
    getNumericParam: jest.fn(),
    getParam: jest.fn(),
    getRefresh: jest.fn(() => 0)
  }
}));

describe('WorkloadListPage shallow render', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    (API.getClustersWorkloads as jest.Mock).mockResolvedValue({ data: mockResponse });

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

    (API.getClustersWorkloads as jest.Mock).mockResolvedValue({ data: mockResponse });

    const { container } = renderPage();
    await waitFor(() => {
      expect(API.getClustersWorkloads).toHaveBeenCalled();
    });
    expect(container).toBeTruthy();
  });
});
