import React from 'react';
import { shallow } from 'enzyme';
import { Provider } from 'react-redux';
import { WorkloadListPage } from '../WorkloadListPage';
import { ClusterWorkloadsResponse } from '../../../types/Workload';
import { InstanceType } from '../../../types/Common';
import * as API from '../../../services/Api';
import { store } from '../../../store/ConfigStore';

jest.mock('../../../services/Api', () => ({
  getClustersWorkloads: jest.fn()
}));

jest.mock('../../../utils/PerformanceUtils', () => ({
  startPerfTimer: jest.fn(),
  endPerfTimer: jest.fn()
}));

describe('WorkloadListPage shallow render', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without errors when validations.workload is empty', () => {
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

    const wrapper = shallow(
      <Provider store={store}>
        <WorkloadListPage />
      </Provider>
    );

    expect(wrapper.exists()).toBeTruthy();
  });

  it('should render without errors when validations object is empty (no workload key)', () => {
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

    const wrapper = shallow(
      <Provider store={store}>
        <WorkloadListPage />
      </Provider>
    );

    expect(wrapper.exists()).toBeTruthy();
  });
});
