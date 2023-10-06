import * as React from 'react';
import { Provider } from 'react-redux';
import { mount, shallow } from 'enzyme';
import screenfull, { Screenfull } from 'screenfull';
import { WorkloadPodLogsComponent } from '../WorkloadPodLogs';
import { store } from '../../../store/ConfigStore';
import axios from 'axios';
import axiosMockAdapter from 'axios-mock-adapter';
import MockAdapter from 'axios-mock-adapter';
import { Dropdown, DropdownItem } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';

const defaultProps = () => ({
  kiosk: '',
  lastRefreshAt: 200,
  timeRange: {},
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
      containers: [{ name: 'busybox', image: 'busybox:v1', isProxy: false, isReady: true }],
      istioContainers: [{ name: 'istio-proxy', image: 'istio:latest', isProxy: true, isReady: true }],
      serviceAccountName: 'namespace-testingpod'
    }
  ]
});

describe('WorkloadPodLogsComponent', () => {
  let axiosMock: MockAdapter;

  beforeAll(() => {
    // Mock axios just to avoid any network trip.
    axiosMock = new axiosMockAdapter(axios);
  });

  afterAll(() => {
    axiosMock.restore();
  });

  beforeEach(() => {
    jest.mock('screenfull');

    (screenfull as Screenfull).onchange = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    axiosMock.reset();
  });

  it('renders', () => {
    axiosMock.onGet('api/namespaces/namespace/pods/testingpod/logs').reply(200, {});

    const wrapper = shallow(<WorkloadPodLogsComponent {...defaultProps()} />);
    expect(wrapper.exists()).toBeTruthy();
  });

  it('renders a kebab toggle dropdown', () => {
    axiosMock.onGet('api/namespaces/namespace/pods/testingpod/logs').reply(200, {});

    // using 'mount' since the kebab toggle is children of the dropdown
    const wrapper = mount(
      <Provider store={store}>
        <WorkloadPodLogsComponent {...defaultProps()} />
      </Provider>
    );

    expect(wrapper.find(Dropdown).exists()).toBeTruthy();
    expect(wrapper.find(KialiIcon.KebabToggle).exists()).toBeTruthy();
  });

  it('renders a log level action in the kebab', () => {
    axiosMock.onGet('api/namespaces/namespace/pods/testingpod/logs').reply(200, {});

    // using 'mount' since the dropdown items are children of the dropdown
    const wrapper = mount(
      <Provider store={store}>
        <WorkloadPodLogsComponent {...defaultProps()} />
      </Provider>
    );
    wrapper.find(KialiIcon.KebabToggle).simulate('click');
    expect(
      wrapper
        .find(DropdownItem)
        .findWhere(n => n.key() === 'setLogLevelDebug')
        .exists()
    ).toBeTruthy();
  });

  it('does not render log level actions in the kebab when proxy not present', () => {
    axiosMock.onGet('api/namespaces/namespace/pods/testingpod/logs').reply(200, {});

    let props = defaultProps();
    props.pods[0].istioContainers = [];
    const wrapper = mount(
      <Provider store={store}>
        <WorkloadPodLogsComponent {...props} />
      </Provider>
    );
    wrapper.find(KialiIcon.KebabToggle).simulate('click');
    expect(
      wrapper
        .find(DropdownItem)
        .findWhere(n => n.key() === 'setLogLevelDebug')
        .exists()
    ).toBeFalsy();
  });

  it('calls set log level when action selected', () => {
    axiosMock.onGet('api/namespaces/namespace/pods/testingpod/logs').reply(200, {});

    const api = require('../../../services/Api');
    const spy = jest.spyOn(api, 'setPodEnvoyProxyLogLevel');

    const wrapper = mount(
      <Provider store={store}>
        <WorkloadPodLogsComponent {...defaultProps()} />
      </Provider>
    );
    wrapper.find(KialiIcon.KebabToggle).simulate('click');
    wrapper
      .find(DropdownItem)
      .findWhere(n => n.key() === 'setLogLevelDebug')
      .find('button')
      .simulate('click');
    expect(spy).toHaveBeenCalled();
  });
});
