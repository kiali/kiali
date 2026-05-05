import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { WorkloadPodLogsComponent, WorkloadPodLogsProps } from '../WorkloadPodLogs';
import { store } from '../../../store/ConfigStore';
import axios from 'axios';
import axiosMockAdapter from 'axios-mock-adapter';
import MockAdapter from 'axios-mock-adapter';

const defaultProps = (): WorkloadPodLogsProps => ({
  theme: '',
  kiosk: '',
  lastRefreshAt: 200,
  timeRange: {},
  tracingIntegration: false,
  namespace: 'namespace',
  workload: 'workload',
  pods: [
    {
      name: 'testingpod',
      createdAt: 'anytime',
      createdBy: [],
      status: 'any',
      appLabel: false,
      versionLabel: false,
      containers: [{ name: 'busybox', image: 'busybox:v1', isProxy: false, isAmbient: false, isReady: true }],
      istioContainers: [{ name: 'istio-proxy', image: 'istio:latest', isProxy: true, isAmbient: false, isReady: true }],
      serviceAccountName: 'namespace-testingpod'
    }
  ]
});

describe('WorkloadPodLogsComponent', () => {
  let axiosMock: MockAdapter;

  beforeAll(() => {
    axiosMock = new axiosMockAdapter(axios);
  });

  afterAll(() => {
    axiosMock.restore();
  });

  afterEach(() => {
    jest.clearAllMocks();
    axiosMock.reset();
  });

  it('renders', () => {
    axiosMock.onGet('api/namespaces/namespace/pods/testingpod/logs').reply(200, {});

    const { container } = render(
      <Provider store={store}>
        <WorkloadPodLogsComponent {...defaultProps()} />
      </Provider>
    );
    expect(container).toBeTruthy();
  });

  it('renders a kebab toggle dropdown', () => {
    axiosMock.onGet('api/namespaces/namespace/pods/testingpod/logs').reply(200, {});

    render(
      <Provider store={store}>
        <WorkloadPodLogsComponent {...defaultProps()} />
      </Provider>
    );

    expect(screen.getByTestId('log-actions-dropdown')).toBeInTheDocument();
  });

  it('renders a log level action in the kebab', async () => {
    axiosMock.onGet('api/namespaces/namespace/pods/testingpod/logs').reply(200, {});
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <WorkloadPodLogsComponent {...defaultProps()} />
      </Provider>
    );
    await user.click(screen.getByTestId('log-actions-dropdown'));
    expect(document.getElementById('setLogLevelDebug')).toBeInTheDocument();
  });

  it('does not render log level actions in the kebab when proxy not present', async () => {
    axiosMock.onGet('api/namespaces/namespace/pods/testingpod/logs').reply(200, {});
    const user = userEvent.setup();

    const props = defaultProps();
    props.pods[0].istioContainers = [];
    render(
      <Provider store={store}>
        <WorkloadPodLogsComponent {...props} />
      </Provider>
    );
    await user.click(screen.getByTestId('log-actions-dropdown'));
    expect(document.getElementById('setLogLevelDebug')).not.toBeInTheDocument();
  });

  it('calls set log level when action selected', async () => {
    axiosMock.onGet('api/namespaces/namespace/pods/testingpod/logs').reply(200, {});
    const user = userEvent.setup();

    const api = require('../../../services/Api');
    const spy = jest.spyOn(api, 'setPodEnvoyProxyLogLevel');

    render(
      <Provider store={store}>
        <WorkloadPodLogsComponent {...defaultProps()} />
      </Provider>
    );
    await user.click(screen.getByTestId('log-actions-dropdown'));
    await user.click(document.getElementById('setLogLevelDebug')!);
    expect(spy).toHaveBeenCalled();
  });
});
