/* eslint-disable import/first */
import * as React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';

let mockKioskValue = '';

jest.mock('store/ConfigStore', () => ({
  store: {
    getState: () => ({ globalState: { kiosk: mockKioskValue } }),
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    replaceReducer: jest.fn()
  },
  persistor: { persist: jest.fn() }
}));

jest.mock('config/ServerConfig', () => ({
  isMultiCluster: false,
  serverConfig: { ambientEnabled: false }
}));

import { store } from '../../../store/ConfigStore';
import { DetailDescription } from '../DetailDescription';
import { AppWorkload } from '../../../types/App';

let postMessageSpy: jest.SpyInstance;

beforeEach(() => {
  postMessageSpy = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
});

afterEach(() => {
  mockKioskValue = '';
  postMessageSpy.mockRestore();
});

const makeWorkload = (name: string, kind: string): AppWorkload => ({
  gvk: { Group: 'apps', Kind: kind, Version: 'v1' },
  isAmbient: false,
  isGateway: false,
  isWaypoint: false,
  isZtunnel: false,
  istioSidecar: true,
  labels: { app: name },
  namespace: 'bookinfo',
  serviceAccountNames: ['default'],
  workloadName: name
});

describe('DetailDescription workload kioskParams', () => {
  beforeEach(() => {
    mockKioskValue = 'https://console.example.com';
  });

  it('sends postMessage with type=Deployment for a Deployment workload', () => {
    const workloads = [makeWorkload('reviews-v1', 'Deployment')];

    const { getByText } = render(
      <Provider store={store as any}>
        <MemoryRouter>
          <DetailDescription namespace="bookinfo" workloads={workloads} />
        </MemoryRouter>
      </Provider>
    );

    fireEvent.click(getByText('reviews-v1'));

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining('type=Deployment'),
      'https://console.example.com'
    );
  });

  it('sends postMessage with type=ReplicaSet for a ReplicaSet workload', () => {
    const workloads = [makeWorkload('traffic-generator', 'ReplicaSet')];

    const { getByText } = render(
      <Provider store={store as any}>
        <MemoryRouter>
          <DetailDescription namespace="bookinfo" workloads={workloads} />
        </MemoryRouter>
      </Provider>
    );

    fireEvent.click(getByText('traffic-generator'));

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining('type=ReplicaSet'),
      'https://console.example.com'
    );
  });

  it('sends postMessage with type=StatefulSet for a StatefulSet workload', () => {
    const workloads = [makeWorkload('my-db', 'StatefulSet')];

    const { getByText } = render(
      <Provider store={store as any}>
        <MemoryRouter>
          <DetailDescription namespace="bookinfo" workloads={workloads} />
        </MemoryRouter>
      </Provider>
    );

    fireEvent.click(getByText('my-db'));

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining('type=StatefulSet'),
      'https://console.example.com'
    );
  });
});

describe('DetailDescription waypoint kioskParams', () => {
  beforeEach(() => {
    mockKioskValue = 'https://console.example.com';
  });

  it('sends postMessage with type when waypoint has a type', () => {
    const { getByTestId } = render(
      <Provider store={store as any}>
        <MemoryRouter>
          <DetailDescription
            namespace="bookinfo"
            waypointWorkloads={[
              { cluster: 'cluster-default', name: 'waypoint-gw', namespace: 'bookinfo', type: 'Deployment' }
            ]}
          />
        </MemoryRouter>
      </Provider>
    );

    fireEvent.click(getByTestId('waypoint-link'));

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining('type=Deployment'),
      'https://console.example.com'
    );
  });

  it('sends postMessage without type when waypoint has no type', () => {
    const { getByTestId } = render(
      <Provider store={store as any}>
        <MemoryRouter>
          <DetailDescription
            namespace="bookinfo"
            waypointWorkloads={[{ cluster: 'cluster-default', name: 'waypoint-gw', namespace: 'bookinfo' }]}
          />
        </MemoryRouter>
      </Provider>
    );

    fireEvent.click(getByTestId('waypoint-link'));

    expect(postMessageSpy).toHaveBeenCalledWith(expect.not.stringContaining('type='), 'https://console.example.com');
  });
});
